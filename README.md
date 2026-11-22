# Värdering — DCF med AI

Next.js + TypeScript + Tailwind. Sök ett börsbolag, se ett motiverat värde per aktie, och justera DCF-antagandena med naturligt språk.

## Gratis drift

Utan `ANTHROPIC_API_KEY` döljs AI-chatten, och resten av appen fungerar fullt ut: klicka på en procentsats i tabellen för att ändra den. Då kostar appen ingenting att köra, till exempel på Vercels Hobby-plan. Lägg till nyckeln senare om du vill ha chatten. Den aktiveras vid nästa deploy.

## Kom igång

```bash
npm install
cp .env.example .env.local   # fyll i ANTHROPIC_API_KEY (och ev. Supabase)
npm run dev
```

```bash
npm test        # enhetstester (vitest)
npm run build   # produktionsbygge
```

## Arkitektur

| Del | Plats | Ansvar |
|---|---|---|
| DCF-modul | `src/lib/dcf/` | **All** beräkning: prognos, FCF, terminalvärde, EV → värde per aktie, känslighetstabell, validering, ändring av antaganden, diff för markering. Rena funktioner, fullt testade. |
| Data | `src/lib/data/` + `src/data/companies.json` | `CompanyDataProvider`-gränssnitt. JSON-implementation nu; byt i `src/lib/data/index.ts` mot ett riktigt API. Data valideras med zod. |
| AI-verktyg | `src/lib/chat/tools.ts` | Verktyget `update_assumption(field, year, value)`. Validerar indata och anropar DCF-modulen. AI:n kan inte ändra något annat. |
| Chatt-API | `src/app/api/chat/route.ts` | Tool-use-loop mot Claude. Returnerar nya antaganden; klienten räknar om med DCF-modulen. |
| Persistens | `src/lib/supabase/`, `supabase/migrations/` | Sparar scenarier och chatthistorik per anonymt sessions-id. Valfritt. |
| UI | `src/components/` | Sök, bolagssida, DCF-tabell, känslighet, chattpanel. |

### DCF-modellen

Drivare per år (procentsatser lagras som decimaler): omsättningstillväxt, EBIT-marginal, skattesats, D&A och CapEx i % av omsättningen, ΔNWC i % av omsättningsförändringen.
Globalt: WACC och terminal tillväxt (Gordon).

```
FCF = EBIT·(1 − skatt) + D&A − CapEx − ΔNWC
EV  = Σ FCFₜ/(1+WACC)ᵗ + FCF₅·(1+g)/(WACC−g) / (1+WACC)⁵
Värde per aktie = (EV − nettoskuld) / antal aktier
```

Diskontering sker vid årets slut. Ingen skatt tas ut på negativ EBIT.

### Supabase

Kör `supabase/migrations/0001_init.sql` i ditt projekt och sätt `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
Tabellerna har RLS påslaget utan policies och nås bara server-side. Sessions-id:t ligger i `localStorage`, så den som har id:t kan läsa scenariot. Det duger för anonym demo, men det bör ersättas med Supabase Auth innan riktig användning.

### Byta till riktig data

Implementera `CompanyDataProvider` (`search`, `getCompany`, `listTickers`) mot ditt API och returnera samma `Company`-form. Grundscenariot (`assumptions`) kan komma från API:t eller genereras från historik och konsensus.
