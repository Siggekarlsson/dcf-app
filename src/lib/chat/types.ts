import type { AssumptionField, Assumptions } from "@/lib/dcf";

export interface AppliedChange {
  field: AssumptionField;
  year: number | null;
  /** Decimal, t.ex. 0.085. */
  value: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  applied?: AppliedChange[];
  /** Värde per aktie före/efter ändringarna (beräknat av DCF-modulen i klienten). */
  before?: number;
  after?: number;
  error?: boolean;
}

export interface ChatRequest {
  sessionId: string;
  ticker: string;
  assumptions: Assumptions;
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface ChatResponse {
  reply: string;
  assumptions: Assumptions;
  applied: AppliedChange[];
}
