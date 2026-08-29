# Working on Tectara

NZ property analysis: paste a listing URL → scrape → Claude vision → a scored,
persona-aware report out of 1,000. Next.js 14 App Router, TypeScript, Tailwind,
Supabase, Mapbox.

This file is **operating rules that stay true across features**. Current state —
what's built, what's blocked, what's being quoted — lives in memory, not here. If
something in this file goes stale, fix it in the same commit.

## Commands

```bash
npm run dev                  # port 3000
./node_modules/.bin/tsc --noEmit   # type check — see the trap below
npm run lint
npm run db:setup-sql         # regenerate supabase/setup.sql from the migrations
npm run verify:billing       # the plan/expiry maths
npm run verify:listing-key   # the "same house?" rules behind report reuse
npm run verify:allowance     # who gets how many reports, and what the wall says
npm run verify:email-key     # which accounts count as one inbox
npm run verify:discovery     # the sitemap/URL parsers behind nightly discovery
npm run verify:dwelling      # is there a building to score, and does the address name one property
npm run verify:farm          # farmland is refused at the door; a lifestyle block never is
npm run verify:floor-area    # advertised floor area vs the rating roll, and what that must never say
npm run verify:foundation    # foundation scoring from type, era and visible movement
npm run verify:viewing       # the gate on the agent letter, and what it may claim about each item
npm run verify:title         # title scored from tenure, and the warnings a buyer must not miss
npm run verify:map-valuation # when the map may show a valuation, and what it must say when it can't
npm run verify:estimated-value # valuing what the photos couldn't show, without inventing it
npm run verify:healthy-homes # the five legal standards, and when we may not claim compliance
npm run verify:valuation-method # which method fits which property — tenure decides, not the label
npm run verify:cross-lease   # what a shared title costs, and the band it may never leave
npm run verify:delisting     # when a crawl has earned the right to say a listing has gone
npm run verify:scoreboard    # grading our own valuations, and when a run of bad ones is a bias
npm run verify:completeness  # when a grey pin has earned the right to become a coloured one
npm run verify:quality-curve # score → value multiplier: no cliffs, no invented sixth number
npm run build:zoning         # regenerate lib/zoning/councils.ts from district-plans.nz
```

**There are almost no tests.** Verification is `tsc`, the health endpoints, and
driving the app. The one exception is `scripts/verify-billing.mjs`, because a
wrong date in `lib/billing/plans.ts` either gives away a plan or takes away a
paid month, and neither throws. If you add anything to `lib/scoring`,
`lib/negotiation` or `lib/reno-costing`, they deserve the same for the same
reason: pure, deterministic, and a wrong number there ends up in a letter to a
vendor's agent.

## Traps that have actually bitten

- **`npx tsc` installs a bogus package.** Always `./node_modules/.bin/tsc --noEmit`.
- **Never `npm run build` while `next dev` is running.** It clobbers `.next` and
  every page renders unstyled. If that happens: `pkill -f "next dev"; rm -rf .next`
  then restart.
- **Supabase types need `Relationships: []` on every table** in
  `lib/supabase/types.ts`. Without it the schema fails supabase-js's
  `GenericSchema` constraint and **every typed query silently resolves to
  `never`** — which is what the scattered `as never` casts were working around.
  If a query types as `never`, check this first.
- **PostgREST silently truncates a read at 1,000 rows.** `.limit(2000)` returns
  1,000 rows and no error, so a full page is indistinguishable from the end of
  the table. It showed the first 1,000 of 1,906 pins on the map, and had the
  discovery job deduplicating against the first 2% of a 41,103-row table — so a
  property somebody had already analysed could quietly gain a second, scoreless
  pin beside it. Use `readAllPages` from `lib/supabase/paged.ts`.
- **A Next.js route file may only export route handlers.** Extra exported types
  or constants fail the generated type check — put them in `lib/`.
- **Folders starting with `_` are private** and never routed.
- **Free Supabase projects pause after ~7 days idle and lose their DNS.** NXDOMAIN
  looks exactly like deletion. Check the dashboard before concluding anything.
- **Screenshots of the scrolled landing page come back blank** in the preview
  browser even when the DOM is correct. Render the component on a temp page at
  scroll 0 instead.
- **`<input type="number">` eats the mouse wheel.** Every one of them takes
  `onWheel={blurOnWheel}` (`lib/ui/number-input.ts`), or scrolling the page
  silently edits the user's numbers.

## Where things live

| Path | What |
| --- | --- |
| `components/landing/` | Landing page sections. **Check here before adding anything to the landing page** — a duplicate map got shipped by grepping for `PropertyMap` and missing `LiveMapSection`. |
| `components/map/` | `MapExperience.tsx` is the whole map; `/map` and `/map/demo` are thin wrappers around it with a `demo` flag. Don't fork it. |
| `components/Negotiation/` | The agent document. |
| `components/Viewing/`, `lib/viewing/` | The viewing checklist and the gate on that document. `status.ts` is dependency-free on purpose. |
| `lib/billing/` | `plans.ts` is pure and safe to import anywhere; `stripe.ts` is server-only. |
| `lib/scoring/` | The 1,000-point engine. `model.ts` is the rubric, `engine.ts` scores, `catalog.ts` is the item list. |
| `lib/map/`, `lib/reports/`, `lib/negotiation/`, `lib/email/`, `lib/auth/` | Feature libs. Server-only modules say so at the top. |
| `lib/map/delisting.ts` | When a crawl may conclude a listing has gone. Dependency-free on purpose. |
| `lib/valuation/` | The scoreboard: our valuations graded against what the market paid. `scoreboard.ts` is dependency-free. |
| `lib/supabase/paged.ts` | `readAllPages` — any read that isn't deliberately one page. See the trap below. |
| `supabase/migrations/` | Source of truth for schema. Regenerate `setup.sql` after adding one. |

## Rules that aren't obvious from the code

**Every demo map pin has its own sample report, and the addresses are fictional
on purpose.** All thirty pins used to open 14 Ferndale Road, so clicking three
properties read the same report three times — a poor advertisement for a product
sold on per-property detail. `lib/scoring/sample-reports.ts` generates one report
per pin through the REAL engine (so the persona toggle recomputes and the numbers
stay consistent with the model) from a profile plus one of nine condition
archetypes — renovated, tired 70s, new build, leaky era, ex-rental, villa,
coastal, brick-and-tile, apartment. Coherence is what makes them read as real: a
2019 build has no rusted roof, a 1908 villa is not on a slab, and the leaky-era
story runs through cladding, windows, soffits and the legal items together.

**The seed addresses were real, and that was a problem.** 24 Victoria Ave,
Remuera is a real property with a real title (NA119C/47), and publishing an
invented condition report against it — rusted roof, mould, possible unconsented
works — is a false and damaging claim about somebody's home. Every street name in
the seed table and the profiles was checked against the LINZ address layer and
matches **zero** addresses nationally. Suburb, price, era and coordinates stay
realistic; the front door belongs to nobody. Don't put a real address back.

**The samples cite photo numbers, and that is deliberate.** "Photo 4 shows rust
bleeding through the ridge flashing" is what separates an assessment from an
opinion, and it is the thing a reader checks for themselves — so the samples
demonstrate the format they'd be paying for. This is safe ONLY because the
properties are fictional: citing a photo of a house that doesn't exist claims
nothing about anyone. Never do it on a real address.

Each property gets its own gallery layout (11–20 shots, sectioned the way a
listing is actually photographed — exterior, living, kitchen, bathroom, bedrooms,
grounds), so thirty reports don't all point at photo 4. Archetype copy is written
with `{photo}` / `{photos}` tokens rather than fixed numbers. `/api/health/samples`
enforces two rules: no citation may exceed that property's photo count, and a
Tier 3 "not visible" item may never cite a photo at all — a citation has to be
true to the finding or it is decoration.

Costs are scaled to each property's floor area and regional rate, because every
`tired70s` sample otherwise showed an identical $48,700 and a reader notices that
before they notice anything else. `/api/health/samples` is the guard: it fails if
any report stops building, if two share an address, if the scores flatten, or if
a property ends up with no costed work at all — which is how the new builds were
caught showing $0.

**Never show the demo report as a real property.** `/report/[id]` falls back to
the demo, so only non-uuid ids (`rpt_*`, `sample-*`) may do that. A real id that
isn't found says so. Map pins publish report ids — rendering 14 Ferndale Rd under
someone else's address is the failure mode this guards against.

**A score of zero is not a score.** It is what comes back when every item landed
in `unassessed`, and there are at least three ways to get there: photographs
that show too little (Tier 3 items no longer score), an analysis interrupted
part-way, or a response truncated at `max_tokens`, which the SDK's partial-JSON
parser hands back looking like a clean result. **They are indistinguishable from
our side, so nothing downstream may name a cause** — 244 Upper Kokatahi Road
looked exactly like unclear photographs and was actually an interrupted run, and
copy blaming the listing would have been a guess about our own failure dressed
up as a finding about somebody's house.

Unguarded, that zero multiplied the suburb rate by the bottom of the quality
curve and valued a $699,000 property at $242,028, and published "0/1000" against
a real address — which reads as the worst house in New Zealand, not as "this
didn't score". `isScorable()` refuses zero and nothing else:
anything above it means at least one item was graded, and a floor above zero
would be a number nobody chose.

It is enforced on the way OUT as well as in (`valuationForScore()`), because the
rows are already in the table — refusing only on the write path would leave that
$242,028 on the map forever. `MapListing.roiqScore` is nullable, and null is not
"not analysed": a report exists and somebody paid for it. The sheet says so.
Investor mode still shows everything, because the rent, repairs and projections
come from the asking price and real feeds and never needed a score.

**Farms are refused at the door, and a lifestyle block never is.** Tectara
values a home and the ground it sits on. A farm is worth what it PRODUCES —
hectares, soil, water take, stock units, supply contracts — and none of that is
in a listing photograph. Running the 1,000-point model over one scores a $3m
dairy unit on the state of its kitchen. `lib/property/farm.ts` refuses it in
`/api/analyze` before a cent is spent, with a 422 and a reason the person who
pasted the link actually sees.

**The signal is the LAND AREA, not the label.** The first real farm anybody
tried went straight through a label-only check: 217 Poerua Valley Road, 489
hectares, advertised by OneRoof as "Rural & Lifestyle" with 17 mentions of
dairy — typed `house` by the scraper, analysed as one, scored 607/1000 on the
state of its rooms. Three things were already wrong together:
`detectPropertyType` maps "rural" AND "lifestyle" to `lifestyle`, so
**`PropertyType.rural` is a value nothing in the scraper ever assigns**; JSON-LD
said "House" before the rural wording was reached; and with the type wrong the
dwelling check assumed a building on a property with no floor area at all. A
number the listing states cannot be got wrong by a mistyped category.

`FARM_LAND_SQM` is a line somebody drew and the code says so. It is drawn far
out on purpose — refusing a lifestyle block turns away the exact customer this
app is for, while missing a small farm costs one analysis, so erring high is the
right direction. Three boundaries now tell one story: **up to 1,650m²** a normal
section with its land value published; **up to 20ha** analysed with the land
value withheld; **beyond** farmland, refused before anything is spent.

**A component nobody could see is ESTIMATED from the building it sits on — and
labelled.** Leaving it at zero was its own distortion: a roof absent from the
photographs is still up there, and on a house finished last year it is almost
certainly a new roof, so dropping it understated the property by the price of a
reroof and read on the map as a worse deal than it was.

The estimator is the building itself, never a table of assumptions — the
RCN-weighted condition of every component that WAS assessed. Same house, same
age, same owner, same maintenance: if thirty-five components present at 8/10,
the four nobody photographed are most likely near 8/10 too, and a tired house
estimates its unseen parts as tired. **Nothing assessed means nothing
estimated**, because then there is no building to reason from and anything
produced is invention. **Capped at the `modern` spec tier** however well the
rest presents — full marks need evidence that premium materials were used, and
an unphotographed component cannot supply it.

`confirmedValue` and `estimatedValue` are reported separately and the Financial
tab draws the split as a donut, with every estimated component nameable. Both
halves are real money; a valuation that quietly blends them is the thing this
app exists not to be.

**A grey pin only becomes a coloured one for a WHOLE report.** A grey pin says
one honest thing: this property is for sale and nobody has analysed it. The
moment it turns coloured it starts making claims — a score, a valuation, a
verdict on the asking price — and those are only worth making if the analysis
behind them happened. It doesn't always: 244 Upper Kokatahi Road had 27 photos
read, 62 sub-items produced and every one unassessable, because the run was
interrupted; a `max_tokens` truncation looks identical and is worse, because the
SDK's partial-JSON parser returns the fragment looking clean. Both wrote a pin,
and both then priced a $699,000 property at $242,028.

`lib/map/report-completeness.ts` refuses three absolutes — no photographs read,
no score, nothing assessed — and `/api/map/from-report` declines with a reason
rather than an error. **Leaving the pin grey costs nothing**: it was already
true, and the user keeps their report either way.

**It deliberately does NOT pick a percentage.** "At least 60% of the points
assessed" would be a number nobody chose, and there is no principled place for
it — a bare-land report assesses only Land and Legal, and every real report
leaves items unseen since Tier 3 stopped scoring. `assessedFraction()` is
reported instead, so a threshold can be set later from evidence. **A missing
valuation is not incompleteness either**: no land area or no comparable sales is
a gap in the world, not in the analysis, and the pin may carry a score and admit
it has no price.

**The map shows the valuation and NOT the score.** A number out of 1,000 sitting
directly above a dollar figure reads as though the two track each other, and
they don't: a 900/1000 twenty-square-metre house is worth less than an 850/1000
five-hundred-square-metre one. The score is a condition verdict, not a price. It
belongs in the report, where there is room to say what it means. `roiqScore` is
still on the pin — the sheet reads it to know whether the analysis assessed
anything — but it is never displayed.

**Never tell a reader WHY something is missing unless the thing telling them can
see it.** This has been got wrong twice in one day. The unscored copy blamed the
listing photos, when the real cause was an interrupted run. The no-valuation
copy blamed thin comparable sales, when the real cause was a report the server
could no longer read. A pin can see two things: a listing with no floor area and
a listing with no land area. Everything else is invisible from there, so the
fall-through names no cause at all.

**Tenure picks the method, not the marketing label.** One method used to be
applied to everything — land + the building on it — which is right for a house
on its own section and silently wrong for an apartment, which has no land at
all. Every apartment in the country came back unvalued with no explanation.
`lib/scoring/valuation-method.ts` chooses: **land-and-building** for freehold
with a section **and for a cross lease whose land share we know**,
**floor-area-comparables** for anything on a unit title, leasehold or licence to
occupy (and for apartments and units whatever the title says), **land-only** for
a bare section, **none** when there is neither a measurement nor ground. A
"townhouse" may be either — freehold on its own section is a house for valuing
purposes, unit title is an apartment with stairs — and only LINZ can tell you
which.

**A cross lease is a HOUSE, and it is worth less than the freehold next door.**
It used to go down the apartment road — which applies NO condition multiplier,
deliberately — so a cross-lease house scoring 250/1000 and one scoring 850/1000
came back at the same figure if they shared a floor area and a suburb. The
product stopped touching the money the moment the title said cross lease. But a
cross-lease flat is not stacked among others: it sits on the ground, has its own
roof and kitchen, and wears out and is renovated exactly like the house over the
fence. Two things then have to happen, in order, and they are not the same thing.

**First the land is divided, and that is a correctness fix rather than a
discount.** OneRoof and the record of title both publish the WHOLE site — 1,200m²
for a two-flat pair — so valuing this flat on 1,200m² hands it the neighbour's
land as well. LINZ gives the share, and `lib/linz/property-records.ts` had been
throwing it away: a cross-lease title carries two or more estates, LINZ returns
the **Leasehold one first**, and the lookup asked for `count = 1` and took it. So
every cross lease in the country read back `share: "1/1", area: null`. It now
fetches all of them and takes the **Fee Simple** estate, which is the one that
owns ground. The share is applied to the AREA, not to the finished land value, so
the diminishing-size curve still sees a section-sized parcel — half of 1,200m² is
a 600m² section to its owner, not half of what 1,200m² fetches.

**Then the tenure is discounted, and the band is held.** Trade Me Property
measures 5–10% below equivalent freehold and the Property Institute puts it up to
7.5%, so `lib/scoring/cross-lease.ts` never returns a figure outside 5–10% — 2,673
combinations are asserted inside it. What moves it within the band is how
entangled the arrangement actually is, because two flats side by side with their
own driveways are a different property from a rear flat up a shared right-of-way,
and both are "cross lease, 1/2". The base comes from the co-owner count (the
research finding is that the discount grows with the number of owners); observed
separateness pulls it down, observed sharing pushes it up.

**An unobserved factor scores nothing** — the Tier 3 rule, applied to the money. A
driveway nobody photographed must not be read as a shared one because shared is
the safer guess, so the analysis is told to OMIT rather than answer, and the
questions are asked only when the title is actually a cross lease.

**And without a share we do not guess one.** No fraction means no way to divide
the site, and valuing it as a house anyway would overstate it by far more than
the discount would ever correct — so the old method stands and the report says
the condition isn't priced. **The parts stay gross on purpose**: `landValue` and
`buildingValue` do not add up to `total`, and `crossLease.deduction` is the
difference, shown as its own line. Scaling the two halves down instead would
leave a reader looking at a land value quietly 8% under the section across the
fence with nothing on the page saying why — and the arithmetic would still add
up, which is exactly what would stop anyone asking.

**A house median may never value an apartment.** They are different markets in
the same street. `SuburbValue` records the type its comparables were filtered to
— `lib/ai/comparables.ts` already searches per type — and `comparablesMatch()`
refuses a mismatch outright rather than reaching for the figure to hand. That
reach is how a 342m² West Coast building was once valued at $1.17m.

**The apartment figure carries NO condition multiplier, deliberately.** The
condition read exists and the report shows it; what does not exist is any
evidence for what a condition point is worth per m² in an apartment market, and
picking one would be the same invented staircase this codebase has already
deleted once. So the number says what a TYPICAL property of that type and size
fetches, `typicalForType` is set, and the caveat is printed. Real sales replace
the assumption; nothing else may.

**One property, one valuation, one place it comes from.** There were two. The
report added an itemised building value to a land value; the map ran its own
`suburb $/m² × condition × floor area`, with no land term in it at all. Same
house, two answers — 230 Sewell Street was $697,648 in the report and $657,233
on the map, and a buyer clicking a pin into the report saw both, unexplained. On
an odd property the gap was far worse: 75 Revell Street has a 342m² building on
the West Coast, and the floor-area-only formula valued it at $1.17m against a
$659,000 asking price, because nothing in it knows $/m² falls as a building
grows.

`lib/scoring/property-value.ts` is now the only place a property gets a value.
The report shows it, `contributionFrom()` carries it onto the pin, and
`from-analysis.ts` copies it across rather than working anything out. **A pin
carries the report's valuation or it carries none** — there is no fallback left
to reconcile.

`qualityMultiplier()` and `roiqFairValue()` are deleted, not deprecated. A rival
valuation formula sitting unused in the codebase is how this comes back. If you
find yourself about to write `× floor area` to reach a price, that is the
mistake. (This also retired `verify:quality-curve`, whose curve no longer
exists; its `isScorable` assertions moved to `verify:map-valuation`.)

**The app grades itself, and a run of bad calls is not yet a bias.** Every
property we valued that later sells is a scored prediction; until
`/api/health/valuation` existed, the answer went in the bin. The two traps it
exists to avoid are both ways of fooling yourself. First, **a handful of sales
is not a bias**: valuations scatter, three sections selling 20% over our number
is a reason to LOOK, and chasing the last few sales gives a rate that lurches
about and is wrong in a new direction every month — under `MIN_SAMPLE` (25) the
verdict is `insufficient` no matter how damning the median. Second, **an offset
and a spread are different faults**: a median error of −20% means the rate is
wrong and moving it fixes everything; a median of zero with sales scattered ±35%
means the rate is fine and the model is missing a variable, and moving it there
makes things worse. They are named separately (`biased-low` / `noisy`) so nobody
treats one as the other. Everything is median-based — one $4m sale in a suburb
of $600k houses would drag a mean somewhere useless.

**Read `bareLand` first.** A section has no building to estimate, so the sale
price IS the land value — the cleanest test there is, and the only one with no
guesswork in it. A systematic miss on sections means the land RATE is wrong, and
that same rate is buried inside every house valuation in the suburb where you
can't see it.

**Two refusals in the grader.** A valuation made AFTER the property sold is a
fit, not a prediction — it read the answer off the page, and grading it would
report the model as excellent because it was copying. And a sale price with no
`sale_source` is not evidence. Both are skipped with a reason rather than
quietly included.

**And `shouldDisclose` is the promise.** Serving a valuation we have MEASURED as
systematically wrong, without saying so, is the same fault as the map calling a
house we had never valued a "fair price" — worse, because a buyer acting on a
number we knew ran 20% low loses every auction they enter. When that flips true,
the reports owe their readers a sentence.

**The scoreboard reads valuations through `realValuation()`, never the raw
column.** Rows written before the map fix hold the ASKING PRICE in
`roiq_valuation`. Grading those would mark the vendor's own number as our
prediction — and since a property tends to sell near its asking price, it would
score us as accurate exactly where we had never valued anything.

**A listing leaving the index is recorded, and it is not recorded as a sale.**
Every pin used to claim it was for sale forever. Now a complete crawl that
can't find a listing notes it (`missing_since`), and the NEXT complete crawl
that still can't find it writes `listing_status = 'removed'`, `delisted_at`, and
`last_asking_price` — frozen, because the page is gone within days and a sale
price arriving months later has nothing to compare against unless we kept it.
That pairing is the whole point: a bought sale price says what a house sold for
and cannot say what condition it was in. We can, but only for properties we had
already analysed, and only if the record exists before the price arrives.

`removed`, never `sold`. From outside, a sale and a withdrawal are identical.
`sale_price` / `sale_date` / `sale_source` are written by a sale feed and by
nothing else.

**Most of `lib/map/delisting.ts` is refusals, and that is the feature.** Absence
is also exactly what a broken crawl looks like — an empty shard, a short index,
a `regions=` someone forgot they passed — and the resulting write is not
undoable in any useful sense: once four thousand houses are stamped as having
left the market, nothing in the data says which ones really did. So a crawl may
only conclude if it read BOTH sitemaps, with no `since` filter, no region
filter and no failed shard, and still found at least half the pins we hold. A
refused sweep is a normal outcome and the run log says which refusal. In
practice the nightly incremental run never sweeps; the weekly `?sweep=1` cron
does. Sweep mode deliberately skips the listing upserts, the geocoding and the
market refresh — a full crawl plus 41,000 upserts plus a 150-second geocoding
budget does not fit in the route's 300-second ceiling, and the step that would
get cut short is the one that matters.

**A pin that isn't in the index we crawled is not a missing pin.** A property
analysed from a Trade Me link has no entry in OneRoof's sitemap and never will.
`HeldPin.indexKey` is null for those and they are skipped outright — treating
"not in the index we read" as "gone from the market" would delist every one of
them on the first sweep.

**A valuation we couldn't make is not a fair price.** Our valuation needs a
suburb $/m² from recent sales AND a floor area, and neither is guaranteed — a
bare section has no floor area, and thin suburbs return no sales to median. When
that happened the valuation fell back to the **asking price**, which is not a
fallback: it is the vendor's number handed back as ours. The gap came out at 0%,
the pin coloured orange, and the sheet said "Fair price — close to Tectara's
estimated value" about a property nobody had valued — the same class of
invention as a $0 valuation on an unanalysed pin, and harder to spot because it
looked like a finding. `MapListing.roiqValuation` is nullable, a null gets the
`unvalued` pin state (grey, no percentage, alongside `unanalysed`), and the
sheet says which input was missing. Investor mode is untouched: it is built from
the asking price, the repairs and the rent, and never needed a valuation.
`realValuation()` also withholds the rows written in the old era, which are
identifiable because they match the asking price to the dollar.

**And the verdict is attributed, not asserted.** The sheet used to open with
"Great deal" and "Overpriced" — verdicts on somebody's house stated as fact, off
a figure modelled from suburb sales per m² with no comparable-sales feed behind
it yet. Same number, now clearly ours ("Asking 77% under Tectara's estimate"),
with a line under it saying what it was built from and that it is not a
registered valuation. When the sold-sales feed lands, that line changes; the
shape doesn't.

**Seed listings are a display fallback, never data.** They exist so an empty map
isn't blank. Writing them to `map_listings` makes invented properties
indistinguishable from real ones on the next read.

**Map writes go through the service role** (`lib/supabase/admin.ts` →
`lib/map/persist.ts`). `map_listings` has a read-everyone RLS policy and
deliberately no write policy: the anon key ships to every browser, so an insert
policy would let anyone write to the map.

**The agent letter invents nothing.** Every item, defect, photo reference,
confidence tier and cost is copied from the report. If the analysis didn't find
it, the document doesn't say it — and when nothing is critical or urgent it says
that plainly rather than manufacturing a case. It also carries **no valuation
claim**, and the share link carries **only the document**, never the report: the
Financial tab holds the buyer's walk-away price and the recipient is the vendor's
agent.

**And it is locked until somebody has been to the house.** The letter used to
build itself the moment the report did: a costed schedule of defects, read off
marketing photographs, ready to send to a vendor before anyone had walked
through the property. `lib/viewing/checklist.ts` collects everything the analysis
could NOT settle — items it refused to score, findings graded from a Tier 2/3
read rather than a photograph, documents nobody has uploaded, and the gaps it
flagged in its own words — and the "For the agent" tab stays shut until every
line is answered **and** a viewing date is recorded. Both halves are required:
answering the form at a desk is not a viewing, and the date is the one sentence
in the letter that says a person stood in the house.

**The gate follows the paywall's shop-window rule, with one difference.** A
sample id and the embedded landing demo describe fictional properties nobody can
go and view, so the letter is open on both — a padlock where the product is
supposed to be sells nothing, and the checklist there says plainly that a real
report holds it shut. A SHARED report stays gated: the viewing is owner-scoped,
so the recipient's browser holds none of it, and building the letter from an
empty viewing would present every finding as unverified.

**"Couldn't inspect" is an answer, not a skip.** A subfloor with no hatch and a
LIM the vendor won't release before an offer are real, and a buyer who did
everything they could must not be deadlocked. It unlocks the letter — and moves
that item out of the costed schedule into "Not able to be inspected", where the
vendor is asked to confirm it. Nothing anyone failed to inspect is ever costed,
including its remediation: asking for the price of a Certificate of Acceptance
on the same page that says the consent position could not be established is the
contradiction an agent reads first.

**An item checked and found sound is dropped, and the letter says how many.**
That count is the strongest line in the document — it shows the remaining
schedule survived a real inspection. A problem confirmed on something the
analysis never scored goes in "Observed at the inspection", attributed to the
purchaser in their own words, with the indicative cost shown but deliberately
**not** added to the reduction sought: the analysis didn't grade it, so the
buyer's own read must not set the headline figure.

**The viewing lives in `reports.viewing`, but the device writes first.** It gets
filled in at a property, on a phone, on whatever signal is going, so every
answer lands in localStorage synchronously and is safe the instant it's tapped;
the server sync is debounced, `keepalive`, and allowed to fail silently forever.
It is owner-scoped both ways — a Pro subscriber reading somebody else's report
off the map must not read or overwrite the answers of the person who actually
went, so a write that matches no row returns `synced: false` rather than an
error.

The two copies are merged **per answer, once, on load** (`lib/viewing/merge.ts`),
because the night-before laptop and the open-home phone both hold real answers
and losing one means sending somebody back to a house they've already been to.
Newest `answeredAt` wins, ties go to local. A DELETION can't survive a merge —
an absent key is indistinguishable from one that side never saw — which is why
the sync PUTs the whole state and the server takes it verbatim.

A missing `reports.viewing` column throws nowhere: the sync just answers
`synced: false` forever and every checklist quietly stays on one device.
`/api/health/db` checks the column by name for exactly that reason.

`lib/viewing/status.ts` holds both rules and imports nothing, so
`verify:viewing` can assert them with plain node. The letter must also be built
from the report's **effective** sub-items, not the raw ones, or it claims a
score the report itself has withdrawn.

**The checklist's real answer is a photograph, not a tick.** The report was
never short of an opinion about the subfloor — it was short of a picture. So any
item a camera can settle offers "Take a photo of the …" ABOVE the three answers:
the photos go to `/api/item-photos`, back through the same vision model, and the
item is scored properly on the buyer's own photographs. It then leaves the
checklist by itself (scored and Tier 1 is no longer an unknown), and the letter
labels it *"Photographed at the property by the purchaser"* — a claim the agent
can ask to see rather than one they'd have to take on trust.

`shows_item` is the whole safety of it. When the photographs don't actually show
the item — wrong subject, too dark, too far — the model says so, **nothing is
stored or scored**, and the buyer is asked for another shot. A confident 6/10
read off the wrong cupboard door would be worse than the gap it replaced,
because the gap is honest and the 6/10 ends up in a letter. The refusal is not
an error path; it is the feature working.

**The paperwork lines take their document inline too**, for the same reason: the
buyer is at an open home holding the LIM the agent just handed them, and sending
them to another tab to use it is how a checklist stops getting finished. The
full reading still lands on the Land tab; the checklist line simply disappears,
because the report now has the document.

`DocUpload` must SHOW a `docTypeConfirmed: false`, never store it. It used to
hand every result to `onVerified` — and since nothing downstream scores an
unconfirmed document, uploading a plumber's invoice to the LIM slot looked
exactly like uploading nothing at all. Same shape as `shows_item` on the photos:
the refusal is the feature, and it has to reach the person holding the file.

Only **improvements** items offer it (`lib/viewing/photo-assessable.ts`). A
photograph cannot tell you whether the studio was consented or what the title
says, and offering an upload there would promise something the analysis can't
deliver. A photograph also SUPERSEDES any answer that item had: somebody who
ticked "couldn't inspect" and then got under the house with a torch has settled
it, and a stale answer would have the letter still reporting it as unreachable.

**A LIM comes from the council, never from the agent.** Only a territorial
authority can issue one (s44A LGOIMA). The agent may hold a copy the vendor
ordered before marketing — free and instant, so it's worth asking first — but
that copy is a **snapshot of its issue date** and won't show anything registered
since, which is why the copy tells the reader to check the date on the front.
Otherwise anyone can order one on any property. Don't write copy that implies
the agent is the source, or that a vendor-supplied LIM is current.

**Nothing auto-renews, and the site says so three times.** Purchases are one-off
(`mode: "payment"`) buying `ACCESS_DAYS` of access — the landing page, the
pricing page and the FAQ all promise it, so a recurring Stripe price would make
the copy a lie. `/api/health/billing` fails if a configured price is recurring.
`users.stripe_subscription_id` and `subscription_status` predate that decision
and stay unused.

**Owner mode is the local sign-in bypass, and its guard is NOT a setting.**
`DEV_OWNER_MODE=true` in `.env.local` makes the app behave as a signed-in Pro:
no login redirect, `/login` and `/signup` bounce to the dashboard, `getUserPlan()`
returns pro, and every plan gate opens. `lib/auth/dev-owner.ts` checks
`NODE_ENV === "production"` FIRST and refuses before it reads the flag — Next
sets that for `next build`/`next start` and on Vercel, so a stray
`DEV_OWNER_MODE=true` in a deployed environment is inert rather than a free
giveaway of the paid product. Don't "improve" it into a configurable override.

It invents no Supabase user and writes nothing as one: reports made in owner
mode still belong to the browser's own `bdr_owner` cookie, so turning it off
orphans nothing. The report ALLOWANCE still applies (pro = 20/month) — it guards
the owner's own Claude spend, not the paywall.

**`users.plan` is not access.** It records what was last bought and stays there
after the month ends. Access is the plan paired with `plan_expires_at` still in
the future — `effectivePlan()`, behind `getUserPlan()` and `/api/auth/me`. Read
the column directly and you hand someone Pro forever. It fails closed: a missing
or unparseable expiry is free.

**Only the webhook grants a plan.** `/api/webhooks/stripe` — not the checkout
route, and never the success redirect, which anyone can type. Stripe delivers at
least once, so the grant is idempotent through the unique constraint on
`purchases.stripe_session_id`. The root middleware matcher deliberately skips
`api/webhooks`: the raw body must arrive untouched for the signature to verify.

**Buying again extends, never resets.** `accessUntil()` adds to whatever time is
left, so paying early doesn't throw away days already paid for. Buying a *lower*
tier while a higher one runs is refused at checkout with a 409 — one plan column
can't hold two tiers, and the alternative is silently downgrading someone who
just paid.

**The same property is only analysed once.** A finished report is stored whole
in `reports.report`, so a listing that's been done before is served from there
(`lib/reports/reuse.ts`) instead of costing another few minutes and another
Claude bill. Three things make that safe: the check runs **after** the scrape,
because the scrape is what reveals a changed price **or a changed photo set**;
the reuse is capped at `REUSE_MAX_AGE_DAYS`; and the report carries
`reusedFrom`, which the view renders — a saved read is worth having instantly,
but presenting it as a live one would be a lie. The matching rules are pure and
tested in `lib/reports/listing-key.ts`: a miss only wastes money, a false match
shows someone a different house, so they err toward missing.

**Photos are a staleness signal, not just the price.** An agent can reshoot or
restyle a listing without touching the price, and the report cites photos by
number — "Photo 3 shows water staining" — so a changed or merely *reordered*
set makes every one of those sentences point somewhere else. `photosUnchanged()`
compares the ordered list with query strings stripped (CDN resize params churn
without the photograph changing). Any difference re-analyses.

**Your own unchanged report opens; it never costs a second allowance.** The
reuse lookup prefers the caller's own match over a stranger's, and hands back
the report id rather than a copy. When the listing HAS moved, the fresh report
supersedes the caller's older one — scoped to the owner, because someone else
analysing the same house must never delete a report you paid for. This is why
there is no "re-analyse anyway" button: unchanged means nothing new to find.

**The address search tells you a house was analysed, never what the report said.**
`/api/reports/search` powers the "Already analysed?" box above the listing URL.
It returns an address, suburb, region and date — no score, no valuation, no
asking price, no report body, because it runs before anyone has spent an
allowance. It also returns the row id **only when the report is the caller's
own**: their own opens directly and free, exactly as it does from the dashboard,
while a stranger's goes back through `/api/analyze` with the stored listing URL.
That is deliberate and load-bearing — the analyse flow re-scrapes first, which is
the only thing that can catch a moved price or a changed photo set, and it
charges an allowance. Linking straight to someone else's id would skip both.
Only reports inside `REUSE_MAX_AGE_DAYS` are offered, since older ones would
promise a saving that turns into a full-price re-analysis.

**A reused report is still the reader's own report.** The route returns the
analysis and the caller saves it under a fresh id in their own name, so it lands
on their dashboard and counts against their quota exactly like a fresh one. The
only party who saves anything is us. `verifiedDocs` is stripped on the way
through — a LIM someone uploaded and paid to have read is their work, not a fact
about the house.

**A report costs about NZ$1.45 to produce, so allowances are enforced, not
advertised.** `PLAN_ALLOWANCE` in `lib/billing/plans.ts`: free 1 (lifetime,
never resets), starter 10/month, pro 20/month. Counted from the `reports` table
by `lib/reports/quota.ts` — user id **and** the pre-signin owner cookie, or the
report someone runs before creating their account goes uncounted. The gate sits
before the scrape *and* before the reuse lookup: a cached report still costs the
reader one of theirs, because the saving from reuse was always ours, not a way
to run more reports than the plan includes.

**The free report runs in full and withholds only the conclusion.** Every photo
is analysed and every finding shown — that is what sells the product — while the
score out of 1,000, anything valuing the property, and the Financial /
Renovations / agent tabs are locked. Blurred rather than removed, and the base
score is blurred alongside the total or the total is recoverable by addition.
It is a paywall, not a vault: the report is the reader's own and is scored in
their browser, so the numbers are in the DOM. Never lock a shared link, the
embedded landing demo, or a sample id — those are the shop window. The lock
reads the **current** plan, so upgrading opens a report already run.

**The property type comes from OneRoof's SEARCH pages, not the sitemap.** The
sitemaps carry an address and nothing else, so 95% of the map read "not known
yet". The type is in the search URL —
`/search/houses-for-sale/region_west-coast-44_property-type_section-9_page_1` —
and every listing on that page is a section because the portal filed it there.
Page 1 of a region also renders the COUNT beside each type ("Section (88)"), so
the crawl asks for exactly the pages it needs instead of walking until a page
looks short. `lib/map/property-types.ts` holds the nine type ids and the parsers,
dependency-free like `discovery.ts`.

Two traps, both paid for once. Ids are de-duplicated per page, so a page linking
one property twice returns 39 — breaking on a SHORT page abandoned the rest of
that type and left West Coast 177 listings untyped; only an EMPTY page ends a
type. And every type is crawled including `house`, rather than tagging the
minority types and calling the remainder houses: elimination is cheaper and it
is the wrong trade, because a bare section recorded as a house is exactly the
failure the land-report rule exists to stop.

It is ~1,000 page reads nationally, so it is a weekly sweep (`?typeRegions=`),
never part of the nightly job. robots.txt is `Allow: /` with two narrow Disallows
that don't touch `/search/`, and these URLs are published in
`sitemap/houses-for-sale-serps-1.xml` — but pace it anyway.

**The sitemap can tell you rural, and nothing else about type.** OneRoof
publishes `residential-for-sale-listings` and `rural-for-sale-listings`
separately and they do NOT overlap — the West Coast shards share zero URLs — so
rural listings (farms, lifestyle blocks) were absent from the map entirely
rather than merely untyped on it. `ONEROOF_CATEGORIES` crawls both and writes
`property_type: "rural"` from the sitemap it came from, which is the portal's own
categorisation rather than our guess. `residential` is deliberately NOT written
as a type: it lumps a house, an apartment, a townhouse and a bare section
together, and any of those would be an invention. Null means "not known yet" and
the map's type filter offers that as its own option, because roughly 95% of pins
are in that state and a filter that silently dropped them would empty the map and
look broken. Never infer a type from the address slug — "Lot 3" is a bare section
about as often as it is a new townhouse.

**Discovery crawls OneRoof and nothing else.** OneRoof's robots.txt is
`Allow: /` and they publish a for-sale sitemap built for indexing.
**realestate.co.nz's robots.txt prohibits automated access and names this
business model** — "websites that specifically aggregate property listings…
as part of their business" — so it is never crawled; a user pasting one link
is a different act from harvesting the index nightly. Trade Me blocks
automation outright. Before adding a portal, read its robots.txt.

**Incremental discovery alone never fills the map, and that isn't obvious until
you count.** The nightly job asks the sitemap for what changed in the last two
days, so a property that was already for sale before we started and hasn't been
edited since is never seen. After two nights the map held 1,918 of roughly
30,000 listings and Hokitika showed 4 of its 46 — which reads as "the app is
missing listings", not as "the crawl is incremental". `?full=1` drops the `since`
filter and reads every URL in every shard; `?regions=west-coast` narrows it to
matching shard names so a backfill can go a region at a time. A first run, or any
rebuild, needs one.

**Geocoding is the real throughput limit, and it's concurrency-bound not
rate-limited.** A sitemap URL carries an address and no coordinates, and a pin
without them never appears. At the nightly default (concurrency 4) the West Coast
backfill drained 80 addresses in 240s; at `geocodeConcurrency=10` the remaining
340 finished inside one pass with zero failures. A LINZ miss falls through to
Mapbox, so one address can cost two round trips — which is why the default is
low and why an attended backfill should raise it rather than wait weeks. Keep the
nightly default at 4: it runs unattended against a public service.

**Discovery never analyses.** ~260 listings appear daily; at NZ$1.45 each that
is ~$13,000/month spent on properties nobody may open. The nightly job records
that a listing *exists* — address, region, portal `lastmod` — and leaves every
scoring column null. A pin with a real address and an invented number is the
same failure the seed-listings rule guards against. Users analyse what they
care about, from their own allowance.

**A type filter must show how many of each type can actually be DRAWN.** A
listing is discovered by address and geocoded on a later pass, so a type can
genuinely hold 2,659 listings and 15 locations — and with the filter silent
about that, ticking "Rural land" produced an empty map that reads as a broken
feature rather than one honestly behind on its geocoding. That is exactly how it
was noticed. `/api/map/type-counts` returns total and mapped per type, and the
filter prints the mapped number with "N more found, still being located"
underneath. Never let a half-populated type look like an empty one.

**Long background jobs die when the Mac sleeps, and they die silently.** The
national geocode drain and the type crawl both stopped mid-run on a low battery,
and both logged nothing but a non-JSON response — a restarting dev server looks
identical to a finished queue. Run them under `caffeinate -is`, and make the
driver RETRY a non-JSON response rather than treating it as the end.

**A listing with no coordinates is not a pin, and that has to be enforced in the
QUERY.** Discovery records an address from the sitemap and geocodes it later, and
`rowToMapListing` defaults a null lat to `0` — so an un-geocoded listing was
served as a point at 0,0. With a handful in the queue that was an invisible
nuisance; after the national backfill it was 34,851 of them, which is one
enormous cluster off West Africa and every count on the map wrong.
`getActiveListings` now filters `lat`/`lng` NOT NULL. They reappear on their own
as the nightly geocoder reaches them.

**The map API's viewport parameter is `bounds`, not `bbox`.** With the wrong name
it is silently ignored and you get every pin in the country — 37,912 rows and a
12-second response — which looks like the API being slow rather than the query
being wrong. `PropertyMap.tsx` passes it correctly; a Hokitika viewport is 4KB
and 0.4s.

**`MapListing.analysed` is the gate on every displayed number.** A discovered
pin has no score, valuation or rent, and `rowToMapListing` fills those with
placeholder zeros — so anything that DISPLAYS or FILTERS on them must check the
flag first, or a real address gets a $0 valuation against it. The listings API
returns `colour: "unanalysed"` and `pct: null` rather than running
`computeListing` over the zeros, which would paint the property as the worst
deal on the map. Cluster colour counts unanalysed too and lets it win ties: a
cluster of 17 unknowns and one good deal is not a green cluster.

**Discovered pins are geocoded separately, and capped.** Sitemap URLs give an
address but no coordinates, and a pin without them lands at 0,0 rather than
failing visibly. `geocodeMissingPins()` runs in the nightly job with a per-run
limit — Mapbox's free allowance is generous but finite. A listing that won't
geocode stays off the map, which is the right failure.

**A discovered pin must never duplicate an analysed one.** `persistDiscoveredListings`
reads existing `listing_url`s and matches them with the same normalisation the
reuse check uses; a property already on the map under `report-<id>` is left
alone. `source_key` is `oneroof-<portalId>` for discovered rows.

**The free tier's allowance is counted per inbox, not per browser.** A shared
laptop can't tell a partner from a second account, and counting per cookie
refused the second person a report they never ran — for a product couples use
together that is the normal case, not an edge case. `lib/auth/email-key.ts`
collapses aliases (Gmail dots, `+tags`) so one mailbox is one person; dots are
stripped for Gmail ONLY, and `+` only for providers known to treat it as a tag.
Merging two real people is the worse mistake, so anything unrecognised stays
separate. Signed-out callers are still counted by cookie.

**The nightly job refuses to run in production without `CRON_SECRET`.** It
crawls a portal, geocodes hundreds of addresses and hits a public bond service;
open, anyone with the URL could loop it and burn the LINZ and Mapbox allowances
while pointing our traffic at OneRoof under our name. Set it in the **Vercel
project's** env — Vercel Cron sends it as a bearer token automatically. Local
dev stays open so the job can be triggered by hand. The schedule is `0 14 * * *`
— **14:00 UTC is 2am in New Zealand**, which is the only timezone that matters
here; 02:00 UTC would run it at 2pm in Auckland. Don't add comments to
`vercel.json` — Vercel validates it against a strict schema and rejects unknown
keys, so a `$comment` fails the deploy rather than being ignored.

**The product's name lives in `lib/brand.ts`, nowhere else.** It was spread
across 44 files and the name isn't settled, so changing it meant an audit
including AI prompts and the PDF sent to a vendor's agent. Customer-facing copy
now reads `PRODUCT_NAME`; the domain comes from `displayDomain()`, derived from
`NEXT_PUBLIC_APP_URL` so it can't disagree with where links actually point.
Internal identifiers — `roiqScore`, `bdr_owner`, the Supabase project, the repo
— stay as they are: no customer reads them and renaming them drags a migration
along. Comments naming the product are left alone too.

**No customer-facing string names the supplier — with one deliberate exception.**
"Claude vision", "read by Claude", "Claude is temporarily overloaded" and the raw
model id printed in every report header (`claude-sonnet-5`) all read
`PRODUCT_NAME` now. The header shows "Tectara vision engine", with the real model
id kept on the element's `title` attribute — the stored report still carries it,
because that is how a result is traced back and re-run, and rewriting stored data
to hide a supplier would be dishonest about our own records.

The exception is **`app/privacy/page.tsx`, which must keep naming Anthropic**. It
is a sub-processor disclosure: it tells the reader where their photos actually
go. Replacing it with our own name would state that data stays with us when it
does not, which is the one place the rename would turn a true statement into a
false one. Internal identifiers (`runClaude`, `ANTHROPIC_API_KEY`, model ids,
`@anthropic-ai/sdk`) and code comments stay as they are, for the same reason the
rest of the brand rule leaves them alone.

`lib/map/discovery.ts` deliberately does NOT import from `lib/brand` — its
parsers are dependency-free so `verify:discovery` can load the module with
plain node, and a single `@/` import ends that.

**The floor-area gap is the only consent-adjacent check the app can honestly
make.** Councils do not publish building consents as queryable data — Christchurch
sells monthly aggregate lists at $16, most councils sell a property file on
request, a couple offer a human-facing search — so the report can never state a
consent status. What it CAN do is compare two public records of the same house:
the advertised floor area against the district valuation roll's
`building_total_floor_area`. Materially more house than the rating record knows
about is what an undeclared addition looks like from outside.

`lib/property/floor-area-check.ts` is pure and tested. It flags only when the gap
is **both ≥20% and ≥25m²**, and both conditions are load-bearing: rolls routinely
exclude a garage, conservatory or sleepout that an agent counts, so a percentage
alone would flag half the country. It reports the roll's age, because work
consented after the last assessment legitimately isn't in it yet.

**It must never say "unconsented"** — no council file has been opened and none can
be. `verify:floor-area` asserts that in the output text, not just the logic,
because the wording is the part that would quietly drift. And its silence is not
an all-clear: the roll covers ~12% of properties, so the check usually cannot run
at all.

**Never score what the analysis could not see.** A listing photographs the
kitchen, not the piles under the floor. `confidence_tier` was already reported by
the model (1 confirmed from photo · 2 probable · 3 not visible) and was **purely
decorative** — a foundation number inferred from a build year carried the same 55
points, the largest item in the model, as a roof somebody had actually
photographed. `scoreProperty()` now **drops every Tier 3 item from BOTH sides of
the fraction** and returns it in `unassessed`, so the score means "of what could
be seen, this is how it rates". The report shows the gap next to the score rather
than burying it: how many items, what they were worth, and what they were.

Three parts have to agree or the change is cosmetic. `toResults()` must pass
`confidenceTier` through — it used to drop it, which is why the engine was blind.
The prompt must return **score null at Tier 3** rather than manufacturing a
number nobody counts (it used to say "Always return a score … mark
confidence_tier 3"). And `InspectionCard` must not print a score for a Tier 3
item, or the same over-claim reappears in a smaller font attached to a number
that counts for nothing.

**The foundation is the deliberate exception**, and getting there took two wrong
turns. It was scored from nothing; then it was made unscorable, which threw away
the largest item in the model along with real evidence. Three things ARE readable
without a subfloor photo, and `lib/scoring/foundation.ts` computes the score from
them the way `land_topography` does — the model reports facts, the report does
the arithmetic:

1. **Type**, from the perimeter — base board plus a height gap, or subfloor
   vents, means timber piles; a continuous vent-free concrete base means a slab.
   **A concrete floor rates above timber piles.**
2. **Era**, which sets the standard — a slab under the post-2011 NZS 3604
   revision is the top of the range; pre-1970 timber piles the bottom.
3. **Symptoms, seen INSIDE** — floors visibly out of level, uneven gaps at a
   doorway, openings out of square, diagonal cracking from a corner. This is what
   pile settlement looks like in a photo of a living room, and it **outranks the
   type**: a modern slab showing movement drops below clean piles.

**Do not expect a subfloor photo** — very few listings have one, and its absence
is normal rather than a gap. Symptoms make it Tier 1 (the movement IS the
evidence); a clean read of the type is Tier 2; only an unreadable perimeter is
Tier 3. Waterproofing behind tiling, insulation in a ceiling and wiring inside a
wall have no equivalent tell, so they stay Tier 3 and unscored.

**The model is told what the app already knows.** `publicRecordFacts()` puts the
LINZ title, the district-plan zone and the rating valuation into PROPERTY FACTS
marked CONFIRMED, so the analysis stops writing "order a title to confirm freehold
tenure" about a title type printed above the paragraph. `leg_title` carries no
`verifyAgainst` any more for the same reason.

**Never tell the reader to go and look something up.** The development-potential
finding used to end "confirm zoning and coverage before you rely on it", which
hands back the job they came here to avoid. The rule: fetch it, or say plainly
that we couldn't — never assign homework. Zoning is now fetched from the
council's own district-plan service (`lib/zoning/district-plan.ts`).

New Zealand has **no national district-plan service**; zoning is published per
territorial authority. **50 of the 67** expose a queryable ArcGIS REST layer, and
`lib/zoning/councils.ts` is GENERATED from district-plans.nz by
`npm run build:zoning` — not hand-maintained, because 67 councils re-publish
endpoints often enough that a hand-written list rots silently. The registry is
checked in rather than fetched at runtime: a report must not depend on a
third-party catalogue being up.

**There is no convention for the zone field, so it is scored, not mapped.**
Auckland returns a coded `ZONE: 18` needing the layer's coded-value domain;
Wellington a plain `DPZone` string; Christchurch calls it `Type` with `TypeGroup`
beside it — no "zone" in the name at all; Dunedin has `Zone` plus a more useful
`Sub_Zone`. Fifty hand-written field mappings would rot, so `readZone()` scores
candidates on field name, alias and what the VALUE reads like. A value that
won't decode to text is discarded — printing "Zone 18" to a buyer is worse than
admitting we don't know.

A missing zone deliberately does NOT claim why. It can mean no queryable layer,
a service that didn't answer, or a point outside every polygon, and naming the
wrong one is a small confident lie in place of an honest gap. What genuinely
stays out of reach is the rule TABLE behind the zone — site coverage, setbacks
and density live in the plan text, not the map layer — and the report says so.

**LINZ is the register; the listing is a sales document.** `lib/linz/property-records.ts`
resolves an address to its Record of Title and, where published, its district
valuation roll — free and openly licensed, attribution being the only condition.
**Title type now comes from the register and simply wins**, which is what retired
the "Indicative" label: it used to be inferred from the word "freehold" appearing
somewhere in the listing HTML.

**The two halves have very different coverage, and this decides how each may be
used.** Titles are national — 2.45m titles against 2.4m addresses. The valuation
roll is **287k rows, roughly 12% of properties**, so "no valuation" is the normal
answer and nothing may depend on one being there. Its figures therefore only ever
FILL GAPS: a scraped floor area describes the property as it is being sold today
and is never overwritten by a rating record that may predate a renovation — and a
stated `noBuildingStated` is never overridden by a roll that can lag a demolition.

Three traps worth knowing. The roll records **land area in hectares** (a 675m²
section reads 0.0675). A value of **0 means "not valued", not "worth nothing"**.
And the address lookup must use **exact matches on `full_address_number` and
`full_road_name`** — the wildcard `ILIKE` scan over 2.4m addresses takes ~4.6s
against ~1.0s, which was the difference between fitting the 15s budget and not.
Like the geocoder, an address that could mean more than one property returns
NOTHING: a wrong record is the wrong-house failure with an official stamp on it.

**A property with no building gets a LAND report, not a condition report.** The
1,000 points all describe a dwelling, so a bare section scored as a house is
scored from photographs of an empty paddock — and the output reads exactly as
confidently as a true report. `lib/property/dwelling.ts` decides, on evidence
only: the scraper's `noBuildingStated` flag, then a `section` type.

**A published floor area of 0 is NOT on its own evidence of no building.** That
was the first attempt and it was wrong: OneRoof prints `floorAreaString:"0m"`
whenever it doesn't hold the figure, so a four-bedroom house in Whakatāne reads
0m² exactly like a bare paddock, and it would have been given a land report with
no Improvements tab. The scraper sets `noBuildingStated` only when the zero is
**corroborated** — the portal's own `"category":"Section"`, or no bedrooms. That
category field is also the one trustworthy property type: OneRoof marks every
page `SingleFamilyResidence` AND files sections under "Houses for Sale", so both
the schema type and the page title lie. It deliberately does NOT read the
description ("large section" is in half the country's listings) and does NOT
treat a bedroom count as proof of a building — the section that exposed this had
a stray "1 bedroom" scraped from page furniture. A stated zero outranks the
property type because **OneRoof marks up every property page as
`SingleFamilyResidence`, sections included**, which was the original bug.

When there is no dwelling, `analyseProperty` runs `inspections: ["land", "legal"]`
— the model is never shown the improvements checklist and any improvements item
it volunteers anyway is dropped when the result is assembled. The report carries
`landOnly`, and the view MUST read it: Improvements and Renovations are hidden,
and the headline is a **land + title score against its own total**, never out of
1,000. The engine normalises whatever it scored back to 1,000, so a land report
would otherwise print a number that sits next to a house's and invites a
comparison that means nothing.

**A bare section has no rent, no yield and no cash flow — and the report must
not compute one.** The Financial tab was printing "+$24/wk net cash flow" and
"8.5% gross yield" against an empty 5,002m² paddock, off the suburb's HOUSE
median rent. The model had even written the caveat into the rent note, which is
not enough: a caveat beside a confident green figure loses. Both the Overview
yield panel and the Finance rent section now say plainly that there is nothing
to let, and name what actually matters instead — land value, holding costs, cost
to build. Anything keyed to letting a dwelling has to check `landOnly` first.

**A house growth rate must not be projected onto a section either.** The same
report applied a suburb trend of 7.4% p.a. — sourced from an average HOUSE value
of $511,200 — to a $270,000 paddock, and printed a confident ten-year figure.
Land and houses don't move together: most of a house's growth is in its land, so
a rising market can lift sections faster than the average dwelling while a flat
one leaves a small-town section unsold for years. We hold no land-only series,
so on `landOnly` the trend is shown as labelled CONTEXT and no forward value is
projected — same call as withholding a land valuation we can't stand behind.

**Room counts on a `noBuildingStated` listing are page furniture, not facts.**
A Hokitika section came back "1 bed" — scraped from a similar-listings strip —
which the land report would have printed in its header. When the portal itself
says there is no building, bedrooms/bathrooms/carParks are set to NULL, not
zero: null is "no such thing here", zero reads as a measured fact.

**The title is scored from its TENURE, not by the model.** `leg_title` was the
AI's to judge and it would not do it consistently: 9/10 tier 1 "Freehold" on one
property, "Not assessed — not visible in the listing" and no score on another
with the same known freehold tenure, both printing "freehold" in their own
header. `lib/scoring/title.ts` scores it by lookup — freehold 10, unit title 7,
cross-lease 5, leasehold 3, licence to occupy 2 — the same arrangement the
foundation and the land items use: the fact is reported, the report does the
arithmetic. Unknown returns NULL rather than a number, so an unestablished
tenure stays an honest gap. Applied in `effectiveSubItems`, so saved reports are
fixed on render without re-analysis. `verify:title` guards the ordering and the
warnings (ground-rent reviews, the flats plan, the body corporate).

Two labels had to move with it. "Indicative" on the title meant "inferred from
the word freehold appearing in the listing HTML" and is wrong once the register
has answered — it now shows only when the type is genuinely unestablished. And
tier 1 read **"Confirmed from photo"** beside a LINZ record of title; the badge
takes the item's source and says "Confirmed from the public record" for anything
record-sourced. Tier 1 means established — how it was established depends on the
item.

**Never put a document on the checklist for a fact the report already holds.**
The title TYPE comes from the LINZ register and is printed in the report's own
header, so asking the buyer to obtain a record of title to confirm it is the
homework rule failing in a new place. Gated on `listing.titleType`, NOT on the
item's score: the model is inconsistent here — it scored `leg_title` 9/10 tier 1
"Freehold" on one report and returned "Not assessed — not visible in the
listing" on another with the same known tenure. What a title carries BEYOND the
type — easements, covenants, caveats — is a separate question with its own items
and still earns its place on the list.

**Consents describe work done to a STRUCTURE.** On a bare section with nothing
built, there is no consent history to produce and no CCC to chase, and the
analysis says as much itself — so `leg_consents` is dropped when `landOnly` and
nothing stands on the land. It returns the moment there is a shed, sleepout or
garage, any of which may have needed a consent it never got.

**A land report's viewing checklist must drop the dwelling-only items.** The
same section listed "Weathertightness history (leaky-building era 1994–2004)" as
something to go and inspect, because the analysis had honestly refused to score
it — and unscored is exactly what puts a line on that list. `DWELLING_ONLY_ITEMS`
in lib/viewing/checklist.ts. Keep it narrow: EQC stays (land carries claim
history) and consents stay (what you may build is the whole question).

**A land value we can't stand behind is not published.** `valueLand()` extracts a
rate from ordinary suburb house sales and stretches it over the area with a 40%
tail that has no ceiling — the reported 5,967m² section came out at $1.41m
against a $195,000 asking price. Inside a house report that error is small and
bounded; on a land report the valuation IS the report. `landValuePublishable()`
withholds the figure past **3× a typical section** or when it diverges more than
60% from the advertised price. That second rule is deliberately the opposite of
the house behaviour: a wide gap on a house is a finding and the whole product,
but on bare land, with no building to explain it and a rate already stretched, it
means the estimate is wrong.

**Never look up a property by a street name alone.** `ensureAreas()` backfills a
missing floor area or price by web search, and it is only safe with an address that
names ONE title. "Golf Links Road, Westland" returned a neighbouring house's 195m²
floor area and $795,000 asking price, which were merged into a section's report and
presented as its own — the wrong-house failure, but silent. `identifiesOneProperty()`
requires a street number leading the first component, and the lookup is skipped
entirely when the listing has no dwelling.

**Read the listing description — it is evidence, and it was being thrown away.**
OneRoof's JSON-LD `description` carries only the marketing HEADLINE ("A Smart
Move in Central Hokitika"), so the analysis was handed six words and never saw
the paragraph saying the house had double glazing, Insulmax wall insulation, a
heat pump and a multi-fuel fire installed — and duly reported original single
glazing. `longestParagraphBlock()` now finds the body by SHAPE (the element whose
direct `<p>` children hold the most text) rather than by class name, because
portal class names are utility soup that no selector will guess. A description
under 200 characters is treated as a heading, not a description. The description
also moved ABOVE the photos and the checklist in the prompt: it was appended
after an 84-item list, which is where it got ignored.

**OneRoof's `addressLocality` is the DISTRICT, not the suburb.** Its JSON-LD
returns `"Westland"` for a Hokitika property, so 230 Sewell Street was filed
under Westland and drew its suburb $/m² comparables from the wrong place — which
feeds the valuation. The `<h1>` is human-written and reads "230 Sewell Street,
Hokitika, Westland": street, suburb, district. The middle part is taken as the
suburb ONLY when the first part exactly equals the street address already
parsed, so it can never fire on a marketing headline, and never when the
candidate is just the region under another name.

**Bed/bath/car counts can be ICON-labelled rather than word-labelled.** The text
patterns need the number first ("4 bedrooms"); OneRoof writes
`<i class="icon icon-bath"></i><span>2</span>`, so a two-bathroom house came back
with no bathroom count at all. `countAfterIcon()` reads them from the same
post-`<h1>` window the price uses — a related-listing card further down the page
must never answer for the subject property. All three of these (suburb, counts,
price) are gap-fills: they only run when the field is still null, so they cannot
overwrite something a portal stated properly.

**OneRoof's price is in the server HTML now, and the skip that said otherwise
cost a real report its asking price.** The page-wide scans stay off for OneRoof —
45+ nearby and related-listing prices are embedded and a loose scan returns a
neighbour's. But `priceBesideHeading()` reads the first `$` figure within 600
characters after the address `<h1>`, which cannot reach a related-listings
carousel. Verified against four Hokitika listings, each matching its own page.
Same page, same fix: `Decade Built / 1950s` sits in a label/value pair the
year regex walked past, so a decade now parses to its midpoint.

**Never score a thing that might not exist.** `ext_decking` is conditional —
plenty of NZ houses have no deck, and scoring one anyway put an inferred deck
into a letter to a vendor's agent as a costed defect. Conditional + absent drops
out of both sides of the fraction, the same as a chimney or a pool.

**Appliances are chattels.** They stay out of Overview's "Priority repairs — act
before making an offer": they're negotiated on the agreement, may not be included
at all, and a tired oven leading that list makes everything under it look soft.

**A cost tier must describe the item you clicked.** Splashback, benchtop and sink
route to their own reno kinds. They used to fall through to `kitchen`, so
clicking Splashback offered "Re-paint doors, replace handles, new tap and a
benchtop resurface" and a $14,149 flat-pack kitchen.

**Healthy Homes draught-stopping is derived from the build era and nothing else.**
No photograph shows a draught. It must never be stated as a finding or pre-ticked
into the renovation plan — it was asserting "Below the draught-stopping standard
— gaps/holes to seal" and pre-selecting $1,600 on a house whose listing
advertises new double glazing and wall insulation.

**`verify:scoring` is stale.** It predates the v4 model revision (flood,
liquefaction, coastal, soil, fault and wind were erased and Location stopped
counting), asserts the old 1,000-point column sums, and is not wired into
`package.json`. It fails on a clean checkout. Don't read its failure as a
regression — fix it or delete it.

**Valuations are estimates until a licensed sold-sales feed lands.** Land value
and suburb $/m² are inferred, and everything downstream inherits that. Don't
write copy that presents them as settled fact.

**Email is best-effort.** The share link is the deliverable; a failed send shows
a reason next to a link that already works. Never fail a request because email
failed.

**The map's `teaser` flag must be settled before `PropertyMap` mounts** — layers
are built once, so a Pro user rendering early gets stuck with the blurred version.

## Verifying

```bash
curl -s localhost:3000/api/health/db    | python3 -m json.tool
curl -s localhost:3000/api/health/email | python3 -m json.tool
curl -s localhost:3000/api/health/billing | python3 -m json.tool
curl -s localhost:3000/api/health/linz  | python3 -m json.tool   # title + rating valuation
curl -s localhost:3000/api/health/zoning | python3 -m json.tool  # 4 councils, 4 field conventions
curl -s localhost:3000/api/health/samples | python3 -m json.tool # all 30 map-pin sample reports
```

Billing end to end needs Stripe's CLI forwarding real events at the dev server:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

`/report/rpt_001` is the demo report — real engine, seeded data, no API spend.
Use it to check report changes instead of burning a live analysis (a real run
takes ~4 minutes and real tokens).

## Git

Commit freely; **the user pushes** via GitHub Desktop. Don't push.
