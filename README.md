# Valeur

Värdering av svenska börsbolag med en DCF-modell du styr själv.

Next.js + TypeScript + Tailwind. Sök bland alla aktier på Nasdaq Stockholm och First North, se ett motiverat värde per aktie, och justera antagandena själv i tabellen eller med AI.

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
| Data | `src/lib/data/` | `CompanyDataProvider`-gränssnitt. Bolagslistan (`src/data/listings.json`) kommer från Nasdaq Nordic. Finansiella data och kurs hämtas från Yahoo Finance och cachas i några timmar. Grundscenariot byggs av `baseline.ts`. `src/data/companies.json` innehåller exempeldata för fem bolag och fungerar som reserv. |
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

### Data

- **Bolagslista:** kör `npm run listings` för att hämta om alla aktier från Nasdaq Nordic (huvudlistan + First North). Spotlight och NGM ingår inte.
- **Finansiella data:** Yahoo Finance (inofficiellt, gratis). Det kan sluta fungera utan förvarning och är inte avsett för kommersiellt bruk. Om hämtningen misslyckas visas exempeldata för de fem exempelbolagen och ett meddelande för övriga.
- **Grundscenario:** tillväxten utgår från de senaste tre årens CAGR (begränsad till −5–15 %) och klingar av mot 2 % år fem. EBIT-marginal, D&A och CapEx följer snittet för tre år. Skatt kommer från bolagets data, annars 20,6 %. ΔNWC är 10 %. WACC är 9 % på huvudlistan och 10,5 % på First North, och terminal tillväxt är 2 %.
- Banker, försäkrings- och investmentbolag saknar EBIT och visas därför utan värdering.
- `DATA_SOURCE=mock` kör appen helt utan nätverk med bara exempelbolagen.

### Byta datakälla

Implementera `CompanyDataProvider` (`search`, `getCompany`, `listTickers`) mot ditt API och returnera samma `Company`-form. Grundscenariot (`assumptions`) kan komma från API:t eller genereras från historik och konsensus.
