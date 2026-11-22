import "server-only";
import { createJsonProvider } from "./json-provider";
import { createSnapshotProvider } from "./snapshot-provider";
import type { CompanyDataProvider } from "./types";

export * from "./types";

/**
 * Den enda plats som bestämmer datakälla.
 * Standard: alla svenska börsbolag (Nasdaq-listan) + finansiell data från en daglig ögonblicksbild.
 * DATA_SOURCE=mock ger bara de fem exempelbolagen.
 */
export const companyData: CompanyDataProvider =
  process.env.DATA_SOURCE === "mock" ? createJsonProvider() : createSnapshotProvider();
