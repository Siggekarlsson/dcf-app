import { z } from "zod";
import { validateAssumptions } from "@/lib/dcf";
import { companyData } from "@/lib/data";
import { assumptionsSchema } from "@/lib/data/types";
import { deleteScenario, loadScenario, saveScenario, sessionIdSchema } from "@/lib/supabase/repo";

const keySchema = z.object({ sessionId: sessionIdSchema, ticker: z.string().min(1).max(20) });

async function parseKey(input: unknown) {
  const key = keySchema.safeParse(input);
  if (!key.success) return null;
  const lookup = await companyData.getCompany(key.data.ticker);
  return lookup.status === "ok" ? { sessionId: key.data.sessionId, ticker: lookup.company.ticker } : null;
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const key = await parseKey({ sessionId: sp.get("sessionId"), ticker: sp.get("ticker") });
  if (!key) return Response.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  return Response.json(await loadScenario(key.sessionId, key.ticker));
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const key = await parseKey(body);
  const assumptions = assumptionsSchema.safeParse(body?.assumptions);
  if (!key || !assumptions.success || validateAssumptions(assumptions.data).length) {
    return Response.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  await saveScenario(key.sessionId, key.ticker, assumptions.data);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const key = await parseKey(body);
  if (!key) return Response.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  await deleteScenario(key.sessionId, key.ticker);
  return Response.json({ ok: true });
}
