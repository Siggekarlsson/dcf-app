import "server-only";
import { z } from "zod";
import type { Assumptions } from "@/lib/dcf";
import { assumptionsSchema } from "@/lib/data/types";
import { getSupabase } from "./server";

export const sessionIdSchema = z.uuid();

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  applied?: unknown;
}

export async function loadScenario(sessionId: string, ticker: string) {
  const db = getSupabase();
  if (!db) return { assumptions: null, messages: [] as StoredMessage[] };

  const [scenario, messages] = await Promise.all([
    db.from("scenarios").select("assumptions").eq("session_id", sessionId).eq("ticker", ticker).maybeSingle(),
    db
      .from("chat_messages")
      .select("role, content, applied")
      .eq("session_id", sessionId)
      .eq("ticker", ticker)
      .order("created_at", { ascending: true })
      .limit(100),
  ]);
  if (scenario.error) console.error("Supabase scenarios:", scenario.error.message);
  if (messages.error) console.error("Supabase chat_messages:", messages.error.message);

  const parsed = assumptionsSchema.safeParse(scenario.data?.assumptions);
  return {
    assumptions: parsed.success ? (parsed.data as Assumptions) : null,
    messages: (messages.data ?? []) as StoredMessage[],
  };
}

export async function saveScenario(sessionId: string, ticker: string, assumptions: Assumptions) {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db
    .from("scenarios")
    .upsert({ session_id: sessionId, ticker, assumptions, updated_at: new Date().toISOString() });
  if (error) console.error("Supabase saveScenario:", error.message);
}

export async function deleteScenario(sessionId: string, ticker: string) {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db.from("scenarios").delete().eq("session_id", sessionId).eq("ticker", ticker);
  if (error) console.error("Supabase deleteScenario:", error.message);
}

export async function appendMessages(sessionId: string, ticker: string, messages: StoredMessage[]) {
  const db = getSupabase();
  if (!db || messages.length === 0) return;
  const { error } = await db
    .from("chat_messages")
    .insert(messages.map((m) => ({ session_id: sessionId, ticker, role: m.role, content: m.content, applied: m.applied ?? null })));
  if (error) console.error("Supabase appendMessages:", error.message);
}
