import "server-only";
import { createJsonProvider } from "./json-provider";
import type { CompanyDataProvider } from "./types";
import { createYahooProvider } from "./yahoo-provider";

export * from "./types";

/**
 * Den enda plats som bestämmer datakälla.
 * Standard: alla svenska börsbolag via Nasdaq-listan + Yahoo Finance.
 * DATA_SOURCE=mock ger bara de fem exempelbolagen (utan nätverk).
 */
export const companyData: CompanyDataProvider =
  process.env.DATA_SOURCE === "mock" ? createJsonProvider() : createYahooProvider();
