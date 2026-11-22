import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { describeState, executeUpdateAssumption, updateAssumptionTool } from "@/lib/chat/tools";
import type { AppliedChange, ChatResponse } from "@/lib/chat/types";
import { type Assumptions, validateAssumptions } from "@/lib/dcf";
import { companyData } from "@/lib/data";
import { assumptionsSchema } from "@/lib/data/types";
import { appendMessages, saveScenario, sessionIdSchema } from "@/lib/supabase/repo";

export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 6;

const requestSchema = z.object({
  sessionId: sessionIdSchema.nullable().optional(),
  ticker: z.string().min(1).max(20),
  assumptions: assumptionsSchema,
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
});

const SYSTEM = `Du är en hjälpsam analytiker som hjälper användaren att justera en DCF-värdering av ett börsbolag.

Regler:
- Du får ENDAST ändra modellen genom verktyget update_assumption. Ändra aldrig något på annat sätt.
- Räkna aldrig själv ut värden, kassaflöden eller uppsida. Alla siffror du nämner om resultatet ska komma från verktygets svar eller från "Nuvarande läge" nedan.
- Om användaren uttrycker en vag åsikt (t.ex. "mer pessimistisk"), välj rimliga, konkreta ändringar och säg vilka du gjorde.
- "Från år 3" betyder år 3, 4 och 5: gör ett anrop per år. Ett anrop med year = null ändrar alla fem åren.
- Om något inte går att uttrycka med de tillgängliga fälten (t.ex. aktiekurs, nettoskuld, antal aktier), förklara det kort i stället för att gissa.
- Om användaren bara ställer en fråga, svara utan att ändra något.
- Svara på svenska, kort och sakligt, högst 2–3 meningar. Ingen markdown.`;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Ogiltig förfrågan.", 400);
  const { sessionId, ticker, messages } = parsed.data;

  const lookup = await companyData.getCompany(ticker);
  if (lookup.status !== "ok") return errorResponse("Bolaget kan inte värderas just nu.", 404);
  const company = lookup.company;
  let assumptions = parsed.data.assumptions as Assumptions;
  if (validateAssumptions(assumptions).length) return errorResponse("Ogiltiga antaganden.", 400);
  if (messages[messages.length - 1].role !== "user") return errorResponse("Sista meddelandet måste vara från användaren.", 400);

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return errorResponse("Chatten är inte konfigurerad (ANTHROPIC_API_KEY saknas).", 503);
  }

  const client = new Anthropic();
  const f = company.fundamentals;
  const applied: AppliedChange[] = [];
  const convo: Anthropic.Beta.BetaMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));

  // Läget beskrivs en gång och hålls oförändrat under loopen; ändringar rapporteras via verktygsresultaten.
  const stateText = `Nuvarande läge (före ändringar i detta svar):\n${describeState(company.name, assumptions, f)}`;
  let reply = "";
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [
          { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
          { type: "text", text: stateText },
        ],
        tools: [updateAssumptionTool],
        messages: convo,
      });

      if (response.stop_reason === "refusal") {
        reply = "Jag kan tyvärr inte hjälpa till med det. Försök formulera om ändringen.";
        break;
      }

      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        reply = text;
        break;
      }
      if (round === MAX_TOOL_ROUNDS) {
        reply = text || "Jag gjorde ändringarna ovan men avbröt för att undvika för många steg.";
        break;
      }

      // Skicka tillbaka hela svaret oförändrat (inkl. thinking-block) och alla verktygsresultat i ett meddelande.
      convo.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tu) => {
        if (tu.name !== updateAssumptionTool.name) {
          return { type: "tool_result", tool_use_id: tu.id, content: `Okänt verktyg: ${tu.name}`, is_error: true };
        }
        const outcome = executeUpdateAssumption(assumptions, f, tu.input);
        if (outcome.ok) {
          assumptions = outcome.assumptions;
          applied.push(outcome.change);
        }
        return { type: "tool_result", tool_use_id: tu.id, content: outcome.content, is_error: !outcome.ok };
      });
      convo.push({ role: "user", content: results });
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return errorResponse("För många förfrågningar just nu. Försök igen strax.", 429);
    if (err instanceof Anthropic.AuthenticationError) return errorResponse("Ogiltig API-nyckel för Claude.", 503);
    if (err instanceof Anthropic.APIConnectionError) return errorResponse("Kunde inte nå AI-tjänsten.", 502);
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API-fel:", err.status, err.message);
      return errorResponse("AI-tjänsten svarade med ett fel. Försök igen.", 502);
    }
    throw err;
  }

  if (!reply) reply = applied.length ? "Klart, modellen är uppdaterad." : "Jag gjorde inga ändringar.";

  if (sessionId) {
    await Promise.all([
      appendMessages(sessionId, company.ticker, [
        { role: "user", content: messages[messages.length - 1].content },
        { role: "assistant", content: reply, applied },
      ]),
      applied.length ? saveScenario(sessionId, company.ticker, assumptions) : Promise.resolve(),
    ]);
  }

  const body: ChatResponse = { reply, assumptions, applied };
  return Response.json(body);
}
