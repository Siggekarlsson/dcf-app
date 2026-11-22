import { createJsonProvider } from "./json-provider";
import type { CompanyDataProvider } from "./types";

export * from "./types";

/**
 * Den enda plats som bestämmer datakälla. Byt mot t.ex. `createApiProvider()` när ett riktigt API finns.
 */
export const companyData: CompanyDataProvider = createJsonProvider();
