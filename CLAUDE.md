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
npm run verify:billing       # package prices, credits, map expiry, and what the wall says
npm run verify:roof          # the itemised roof valuation: area, effective age, cost split, refusals
npm run verify:listing-key   # the "same house?" rules behind report reuse
npm run verify:email-key     # which accounts count as one inbox
npm run verify:discovery     # the sitemap/URL parsers behind nightly discovery
npm run verify:dwelling      # is there a building to score, and does the address name one property
npm run verify:farm          # farmland is refused at the door; a lifestyle block never is
npm run verify:floor-area    # advertised floor area vs the rating roll, and what that must never say
npm run verify:foundation    # foundation scoring from type, era and visible movement
npm run verify:viewing       # when the report may say a person stood in the house, and what it may claim
npm run verify:title         # title scored from tenure, and the warnings a buyer must not miss
npm run verify:applies       # when EQC and a body corporate apply at all
npm run verify:map-valuation # when the map may show a valuation, and what it must say when it can't
npm run verify:estimated-value # valuing what the photos couldn't show, without inventing it
npm run verify:healthy-homes # the five legal standards, and when we may not claim compliance
npm run verify:valuation-method # which method fits which property — tenure decides, not the label
npm run verify:cross-lease   # what a shared title costs, and the band it may never leave
npm run verify:land-value    # the section vs a typical one: shape, slope, orientation, access
npm run verify:site-shape    # workable %, shape and frontage measured off the LINZ boundary
npm run verify:terrain       # slope and usable % from the LINZ elevation model
npm run verify:sun           # midwinter sun traced through the LINZ surface model
npm run verify:development   # the dwelling-you-could-add figure, and what the title says about it
npm run verify:structures    # what you could build, what it costs, and where the rules let you drag it
npm run verify:regions       # which region a listing resolves to, and what its labour costs
npm run verify:delisting     # when a crawl has earned the right to say a listing has gone
npm run verify:scoreboard    # grading our own valuations, and when a run of bad ones is a bias
npm run verify:completeness  # when a grey pin has earned the right to become a coloured one
npm run verify:quality-curve # score → value multiplier: no cliffs, no invented sixth number
npm run build:zoning         # regenerate lib/zoning/councils.ts from district-plans.nz
npm run build:instruments    # regenerate lib/linz/instrument-types.ts from LINZ
```

**There are almost no tests.** Verification is `tsc`, the health endpoints, and
driving the app. The one exception is `scripts/verify-billing.mjs`, because a
wrong number in `lib/billing/plans.ts` either gives away reports or takes away
ones somebody paid for, and neither throws. If you add anything to `lib/scoring`
or `lib/reno-costing`, they deserve the same for the same
reason: pure, deterministic, and a wrong number there ends up in front of
somebody deciding what to bid on a house.

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
- **A number input bound straight to a number cannot be cleared.** Deleting the
  contents runs `Number("") || 0`, which puts a **0** back in the box — so the
  next keystroke lands after it and you are typing `$0700000`. An empty box has
  to be allowed to BE empty, and a number cannot represent empty; only a string
  can. `MoneyInput` / `NumInput` in `RealReportView` hold a **draft string**
  while the field has focus and fall back to the committed number on blur, which
  also normalises a trailing "." or a stray "007". They strip a leading zero
  that sits in front of a real digit, because a field already showing 0 does the
  same thing to the first keystroke. Use them rather than a raw `<input
  type="number">` with `value={someNumber}`.

## Where things live

| Path | What |
| --- | --- |
| `components/landing/` | Landing page sections. **Check here before adding anything to the landing page** — a duplicate map got shipped by grepping for `PropertyMap` and missing `LiveMapSection`. |
| `components/map/` | `MapExperience.tsx` is the whole map; `/map` and `/map/demo` are thin wrappers around it with a `demo` flag. Don't fork it. |
| `components/Viewing/`, `lib/viewing/` | The viewing checklist — what the photos couldn't settle. `status.ts` is dependency-free on purpose. |
| `lib/billing/` | `plans.ts` is pure and safe to import anywhere; `stripe.ts` is server-only. |
| `lib/scoring/` | The 1,000-point engine. `model.ts` is the rubric, `engine.ts` scores, `catalog.ts` is the item list. |
| `lib/map/`, `lib/reports/`, `lib/email/`, `lib/auth/` | Feature libs. Server-only modules say so at the top. |
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
tab draws the split as a donut, with every estimated component nameable. The
Improvements tab shows them too, where the thing is: an unseen item's card
reads "Est. value · not photographed", an unseen room is a dashed row on its
item's card, and a category badge counts its estimates and says "incl. $X
estimated". Leaving them off that tab made it look as though an unphotographed
bedroom added nothing, while the headline counted it. Both
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

**The flat count comes from LINZ, never from `1 / share`.** Shares of 2/3, 3/4,
2/5 and 2/7 are all common in the register, and dividing one into 1 only recovers
the denominator when the numerator happens to be 1 — an owner holding two of
five flats has a 0.4 share, and `1 / 0.4` rounds to THREE, understating the very
thing the discount measures. `landCoOwners` carries the denominator itself. The
land share and the co-owner count are separate facts off the same string and
neither is derivable from the other.

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

**The agent letter is GONE — removed 23 September 2026, and it is not coming
back by accident.** It built a costed schedule of defects out of the report and
sent it to the vendor's agent. Everything below it in this file that still
mentions "the letter" has been rewritten to say "the report", because the rules
themselves did not change: what may be claimed about an item a buyer could not
inspect is the same question whether the claim is emailed to an agent or printed
on a tab. If you are about to rebuild a document that speaks to somebody outside
this app, read `lib/viewing/status.ts` first — the disposition rule is the part
that mattered and it survived.

**Every checklist item is three blocks, always the same three, always in that
order — which is the order they cost you.** ASK is free and instant and the
agent usually just tells you; LOOK is free but you have to be there;
PHOTOGRAPH is the only one that changes the report. Before this it was two grey
paragraphs of similar weight and the instruction was lost inside them.

The guidance is HAND-WRITTEN, in `lib/viewing/how-to-check.ts`, one entry per
item. A model asked where the hot water cylinder is in a New Zealand house will
produce something plausible every single time, and plausible is not right — it
is the difference between sending a buyer to a hallway cupboard and sending them
round the side of the house to a califont. None of it costs a token at run time
and all of it can be read and corrected. `fallbackGuide()` is deliberately vague
for an item nobody wrote: a generic instruction PRETENDING to be specific is
worse than one that admits it is generic.

**Block 3 makes a promise, and it is only true for improvements items.** A
buyer's photograph really does re-score the item — `effectiveSubItems` overrides
score, condition, spec tier, age and replacement cost from it, and
`valueProperty()` then reads those, so it reaches the valuation. Land, legal and
location items are NOT photo-assessable (`isPhotoAssessable`), so the card says
plainly that we can't score those from a picture and that they're for the
inspector and the solicitor instead. Saying "this flows into the valuation"
there would be the same over-claim the confidence tiers exist to prevent.

**Data plates are read, and the reading is shown verbatim.** A model or serial
number dates a cylinder, a heat pump or an appliance far better than its
appearance does, so the photo prompt asks for a plate wherever one is legible and
`ItemPhotoAnalysis.dataPlate` carries it VERBATIM, separately from
`estimatedAge`. That separation is the point: an age is a conclusion, and
"Rheem 135L, ser. 0923" is evidence the reader can check against the photograph
in their own hand. The prompt also says not to infer a date from a serial format
it isn't sure of — an age off a misread plate is worse than no age.

**Only two of the three blocks carry colour.** The theme's accent is a gold and
its warn an orange, close enough that three tinted headings in a row read as a
gradient rather than three separate things. The problem is amber, the payoff is
green, and the instruction in the middle is plain ink. The numbered bubble
carries the ordering, the heading always says it in words, and the colour is
never the only thing carrying the meaning — roughly one man in twelve cannot
separate the amber from the green.

**The viewing checklist survived the removal and still earns its place.**
`lib/viewing/checklist.ts` collects everything the analysis could NOT settle —
items it refused to score, findings graded from a Tier 2/3 read rather than a
photograph, documents nobody has uploaded, and the gaps it flagged in its own
words. It no longer unlocks anything; what it does is replace a guess with an
observation, and the photographs taken against it are scored for real. A viewing
DATE is still required before the report may say the property was inspected
rather than read: answering the form at a desk is not a viewing.

**"Couldn't inspect" is an answer, not a skip.** A subfloor with no hatch and a
LIM the vendor won't release before an offer are real, and a buyer who did
everything they could must not be deadlocked. It moves that item out of the
costed schedule into "Not able to be inspected". Nothing anyone failed to
inspect is ever costed, including its remediation: pricing a Certificate of
Acceptance on the same page that says the consent position could not be
established is a contradiction on its face.

**An item checked and found sound is dropped, and the report says how many.**
A problem confirmed on something the analysis never scored is attributed to the
purchaser in their own words, with the indicative cost shown but deliberately
**not** added to any headline figure: the analysis didn't grade it, so the
buyer's own read must not set the number.

**The viewing lives in `reports.viewing`, but the device writes first.** It gets
filled in at a property, on a phone, on whatever signal is going, so every
answer lands in localStorage synchronously and is safe the instant it's tapped;
the server sync is debounced, `keepalive`, and allowed to fail silently forever.
It is owner-scoped both ways — somebody reading another person's report off the
map must not read or overwrite the answers of the person who actually went, so a
write that matches no row returns `synced: false` rather than an error.

The two copies are merged **per answer, once, on load** (`lib/viewing/merge.ts`),
because the night-before laptop and the open-home phone both hold real answers
and losing one means sending somebody back to a house they've already been to.
Newest `answeredAt` wins, ties go to local. A DELETION can't survive a merge —
an absent key is indistinguishable from one that side never saw — which is why
the sync PUTs the whole state and the server takes it verbatim.

A missing `reports.viewing` column throws nowhere: the sync just answers
`synced: false` forever and every checklist quietly stays on one device.
`/api/health/db` checks the column by name for exactly that reason.

`lib/viewing/status.ts` holds the rules and imports nothing, so `verify:viewing`
can assert them with plain node. The report must also be rendered from its
**effective** sub-items, not the raw ones, or it shows a score it has withdrawn.

**An uploaded building inspection is read beside the photo analysis, and it
wins.** `insp_report` is a document kind like the LIM and the title: Claude is
asked first whether the file really IS a pre-purchase inspection, and a
valuation, a builder's quote, a desktop assessment or a report on a different
address is refused. Where the inspector disagrees with the photo analysis, the
report follows the inspector — they were there and the camera wasn't. It used to
be the third condition on a gate; it is evidence now, and nothing is withheld
for want of it.

**The checklist's real answer is a photograph, not a tick.** The report was
never short of an opinion about the subfloor — it was short of a picture. So any
item a camera can settle offers "Take a photo of the …" ABOVE the three answers:
the photos go to `/api/item-photos`, back through the same vision model, and the
item is scored properly on the buyer's own photographs. It then leaves the
checklist by itself (scored and Tier 1 is no longer an unknown), and the report
labels it *"Photographed at the property by the purchaser"* — a claim traced to
a picture rather than one taken on trust.

`shows_item` is the whole safety of it. When the photographs don't actually show
the item — wrong subject, too dark, too far — the model says so, **nothing is
stored or scored**, and the buyer is asked for another shot. A confident 6/10
read off the wrong cupboard door would be worse than the gap it replaced,
because the gap is honest and the 6/10 ends up costed. The refusal is not
an error path; it is the feature working.

**The paperwork lines take their document inline too**, for the same reason: the
buyer is at an open home holding the LIM the agent just handed them, and sending
them to another tab to use it is how a checklist stops getting finished. The
full reading lands on the Title & legal tab; the checklist line simply disappears,
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
it, and a stale answer would have the report still calling it unreachable.

**A LIM comes from the council, never from the agent.** Only a territorial
authority can issue one (s44A LGOIMA). The agent may hold a copy the vendor
ordered before marketing — free and instant, so it's worth asking first — but
that copy is a **snapshot of its issue date** and won't show anything registered
since, which is why the copy tells the reader to check the date on the front.
Otherwise anyone can order one on any property. Don't write copy that implies
the agent is the source, or that a vendor-supplied LIM is current.

**Nothing auto-renews, and the site says so.** Purchases are one-off
(`mode: "payment"`): report credits never expire, and map access runs `MAP_DAYS`
and stops. There are no Stripe price IDs — the checkout builds its line item
inline from the table in `lib/billing/plans.ts`, so Stripe cannot charge a
different number from the one on the page and there is nothing to keep in step.
`users.stripe_subscription_id` and `subscription_status` predate all of this and
stay unused.

**Owner mode is the local sign-in bypass, and its guard is NOT a setting.**
`DEV_OWNER_MODE=true` in `.env.local` makes the app behave as a fully paid-up
account: no login redirect, `/login` and `/signup` bounce to the dashboard,
`getEntitlements()` returns `DEV_OWNER_ENTITLEMENTS`, and every gate opens. `lib/auth/dev-owner.ts` checks
`NODE_ENV === "production"` FIRST and refuses before it reads the flag — Next
sets that for `next build`/`next start` and on Vercel, so a stray
`DEV_OWNER_MODE=true` in a deployed environment is inert rather than a free
giveaway of the paid product. Don't "improve" it into a configurable override.

It invents no Supabase user and writes nothing as one: reports made in owner
mode still belong to the browser's own `bdr_owner` cookie, so turning it off
orphans nothing. Owner mode carries a large but finite credit balance rather
than an infinite one — it guards the owner's own Claude spend, not the paywall.

**`users.plan` is not access.** It records which package was last bought and
nothing reads it for entitlement. What somebody HAS is summed from the
`purchases` rows on every read — `entitlementsFor()` in
`lib/billing/entitlements.ts`, behind `getEntitlements()` and `/api/auth/me`.
Credits are summed and spending is counted separately from the `reports` table,
so nothing is ever decremented: there is no balance to drift, double-spend, or
be granted twice by a replayed webhook, and a refund is revoked by flipping one
`status` in the same query that reads it. It fails closed — a read that errors
returns nothing rather than everything.

**Only the webhook grants a plan.** `/api/webhooks/stripe` — not the checkout
route, and never the success redirect, which anyone can type. Stripe delivers at
least once, so the grant is idempotent through the unique constraint on
`purchases.stripe_session_id`. The root middleware matcher deliberately skips
`api/webhooks`: the raw body must arrive untouched for the signature to verify.

**Buying again adds, never replaces.** Credits accumulate and `mapAccessUntil()`
extends whatever map time is left, so paying early doesn't throw away days
already paid for. There is no "you already have something better" refusal any
more: buying ten more reports while a Gold is running is a sensible thing to do,
and the old ladder's 409 would have turned it away.

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

**A report costs about NZ$1.45 to produce, so credits are enforced, not
advertised.** Free is `FREE_REPORTS` (1, lifetime, never resets); everything
else is bought. Spending is counted from the `reports` table by
`lib/reports/quota.ts` — user id **and** the pre-signin owner cookie, or the
report someone runs before creating their account goes uncounted. There is no
monthly window to count within: credits are owned, so what was bought in January
is still there in June and what was spent in January is still spent. The gate
sits before the scrape *and* before the reuse lookup: a cached report still
costs the reader a credit, because the saving from reuse was always ours, not a
way to run more reports than were paid for.

**The free report runs in full and withholds only the conclusion.** Every photo
is analysed and every finding shown — that is what sells the product — while the
score out of 1,000, anything valuing the property, and the Financial and
Renovations tabs are locked. Blurred rather than removed, and the base
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
including the AI prompts. Customer-facing copy
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

**Land & Legal name their source on EVERY item, in a chip.** It was an
unlabelled line under the finding, it read "LINZ: Record of title / LINZ"
because the type prefix and the source repeated each other, and the three
document items carried nothing at all — so the one tab whose entire claim is
that it reads public records was the vaguest about which ones. `dataSourceOf()`
in `InspectionCard` always returns a string and the chip always renders.

**`evidenceSource` leads, `source` is only the catalogue's default.** Several
items are re-scored after the analysis — from the register, or from the parcel
geometry — and only `evidenceSource` moves with them. Section orientation was
crediting "Section orientation on the map" while being computed from the
surveyed boundary and the road centreline: a wrong attribution on the most
certain item on the tab, and the same mistake as its stale Tier 3 badge.

**An item with nothing behind it says exactly that.** A document nobody has
uploaded has no source, and "Awaiting your LIM report — nothing read yet" is the
honest answer where a blank space reads as though the question was never asked.
Never fill this in with a plausible-sounding source: `leg_unconsented` says "no
council file is retrieved" and `leg_consents` says "councils do not publish
consents as data", because naming a council file we never opened would invent
one. Easements and encumbrances credit the **register**, not "the memorials" —
roughly 17% of live titles publish none, and naming a list we could not read
would claim we had read it.

**A data chip only earns its line if it says something.** Every sub-item card
printed "Material: See assessment" — a chip whose content was an instruction to
read the rest of the card — including on items where the question makes no sense
at all. An oven has a brand and a type, not a material; so does a hot water
cylinder, a heat pump and an extractor fan. A layout, a size, an aspect and a
drainage fall are not things that are made of anything.

`SubItem.material` is optional now and the chip is omitted when it is absent.
Three rules decide, and they are the same in `demo.ts` and `sample-reports.ts`:
an appliance or a system has a type rather than a material; a shape or a quality
is not a thing; and **nothing invisible gets one**, because the material of an
unphotographed item is a guess — the same rule as the score, applied to a chip.
Absence from the materials map IS the answer, so nothing has to be listed twice.

The samples key their materials to the ARCHETYPE, because a 1908 villa and a
2016 build do not share a roof and a sample that says otherwise stops reading as
a real house — rusticated weatherboard, corrugated iron and lath-and-plaster
against fibre-cement on cavity, coloursteel tray and square-stopped plasterboard.
The fit-out follows the archetype's spec tier instead of its era, so a 1970s
house with a redone kitchen gets the modern one. The foundation line is derived
from the archetype's own `foundation` field rather than repeated, so the two
cannot drift. Every material also has to agree with what that report's DEFECTS
text says the photos show: two descriptions of one item that disagree is worse
than one that is missing.

A real report does the same — `analyze.ts` returns `undefined` rather than "Not
specified" when the model reads no material.

**Never score what the analysis could not see.** A listing photographs the
kitchen, not the piles under the floor. `confidence_tier` was already reported by
the model (1 confirmed from photo · 2 probable · 3 not visible) and was **purely
decorative** — a foundation number inferred from a build year carried the same 55
points, the largest item in the model, as a roof somebody had actually
photographed. `scoreProperty()` now **drops every Tier 3 item from BOTH sides of
the fraction** and returns it in `unassessed`, so the score means "of what could
be seen, this is how it rates". The report shows the gap next to the score rather
than burying it: how many items, what they were worth, and what they were.

**And the tier is a METER under the score, not a caption below it.** It was a
text badge further down the card — "T2 — Probable, verify at inspection" — well
away from the number it qualifies, so a reader took the number first and the
caveat second if at all, and a 7/10 read off a build era looked exactly as solid
as a 7/10 read off a photograph. `ConfidenceBar` sits directly BELOW the score
badge and outside it: **one bar**, taller for more confidence, with
the level named underneath in words — "Low confidence" — rather than left to the
colour. **The height and the label each work alone**, because a meter carried by
colour says nothing to a red-green colourblind reader, and that is roughly one
man in twelve. There is deliberately no track drawn behind the bar: a track is a
second bar, and the comparison that matters is between cards, which a column
chart makes without a scale behind every column. Tier 3 is drawn at ~32% rather
than empty — the item was still reasoned about, and an empty track would read as
"no answer" rather than "an answer we can't stand behind".

**Never append a hex alpha to a colour — use `alpha()` from `lib/ui/color.ts`.**
`${color}1f` is only valid when `color` is a hex, and most of our accents are CSS
VARIABLES, so it produced `var(--good)1f`: not a colour, so the declaration is
DROPPED and the element renders with no background at all. It fails silently and
looks deliberate. The report's score badges, points bubbles, category pills and
priority-repair chips had all been rendering with no wash and no border for as
long as they had used variables, and nobody spotted it until something had to sit
inside one. 25 sites across 9 components were affected. `alpha()` uses
`color-mix`, which takes a hex or a variable, so it is safe either way.

**Red means low CONFIDENCE, never bad condition** — which is why the bar is
OUTSIDE the score badge on the Land tab. It was inside for a while, and the
badge is washed with the colour of how the item RATES, so the two colour systems
shared one box and read as a single verdict: a green bar in a red badge looked
like a contradiction rather than "we are sure there is a problem here". They are
two statements about the item and they get two places. The bar carries no box of
its own, so nothing suggests it belongs to the score.

The Improvements stat bubble is the same: bar below the bubble, not in it.
Both tabs draw the bar at ONE height, because the length is the encoding —
two scales would make a T1 on Improvements shorter than a T2 on Land, which
is the exact comparison the bar exists to make.

**`ConfidenceTierBadge` is deleted, not merely unused.** The pill —
"T2 — Probable, verify at inspection" — said the same thing as the bar and its
label, in the same words, a few centimetres away, leaving the reader to work out
which was the finding. The SOURCE line stays, because where a fact came from
("Record of title", "Listing photos", "Inference: build era + cladding") is a
different question from how sure we are of it, and only the bar answers the
second. Its one piece of real logic went with it: tier 1 read "Confirmed from
photo" beside a LINZ record of title until the badge learned to say "Confirmed
from the public record" instead. Nothing regressed, because the bar's own
wording covers both and the source line names which — but if a tier caption ever
comes back, it has to make that distinction again.

**A measured item must not keep an inferred tier.** Section orientation carried
"T3 — not visible" because it used to be read off photographs; it is computed
from the surveyed parcel and the road centreline now, so it says T1 and cites
the geometry. Leaving it red said the least reliable thing on the card about the
most certain.

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

**"Add a structure" — the reader places it themselves, and the rules stop them.**
The card answered one question about the largest and hardest structure a buyer
might add. A section with no room for a granny flat very often has room for a
double garage and always has room for a woodshed, so the reader now picks from
eleven structures, sizes it, sees an indicative build range, and DRAGS the
footprint over aerial imagery of their own section.

**The drag IS the rule.** The footprint cannot be moved anywhere it may not be
built — `canPlace()` is checked per frame against the parcel, the existing
footprints, and the setback THAT structure at THAT size must keep. Someone who
drags a shed into a corner and feels it stop has learnt the setback better than
a paragraph teaches it. An illegal move is refused rather than allowed-and-
coloured-red, because a footprint that can be left sitting somewhere illegal is
one a reader will screenshot and take to a builder; it slides along a boundary
it's pressed against so corners stay reachable.

**THERE IS NO SINGLE SETBACK**, which is the whole reason this is worth doing:

| | | |
|---|---|---|
| ≤10m² accessory | **0m** | Schedule 1, as amended **23 October 2025** |
| 10–30m² accessory | **1m** | same amendment (was "no closer than its own height") |
| self-contained unit ≤70m² | **2m** | NES-DMRU, in force **15 January 2026** |
| past the exemption | 1m | drawing guide only — the district plan governs |

**Costs carry a fixed share, not just $/m².** A 5m² woodshed is not a fifteenth
of a 75m² one — pricing purely per square metre makes the small end nonsense, so
every structure is `baseCost + perSqm × size`, anchored to
`lib/scoring/structures.ts` so what this tab prices you to BUILD and what the
report values on a neighbour's property cannot drift apart. Resale uses that
module's retention factors for the same reason: cost is not value.

**The imagery needs its own key, and the LINZ data key is NOT it.** LINZ
Basemaps is much better imagery for NZ (5–10cm urban against Mapbox's ~50cm) and
free under CC BY. `LINZ_BASEMAP_KEY` is registered separately at
basemaps.linz.govt.nz and is now set; `app/api/tiles/aerial` prefers LINZ and
falls back to Mapbox, and PROXIES both so a server key never reaches a browser.

**You cannot verify that key from a tile response, and the old note here was
wrong about how.** It said the Data Service key comes back "API Key Invalid:
malformed". Measured against a real Hokitika tile (18/255566/165537), **no key,
a bogus key, a one-character key and the Data Service key all return the
identical 15,708-byte image** — the aerial layer serves anonymously and validates
nothing. A 200 with a picture in it proves only that LINZ is up. Worse, an
out-of-coverage z/x/y returns a **190-byte blank WebP with a 200**, which is what
made a wrong tile look like a wrong key the first time round.

The check that actually means something is whether OUR route's bytes match a
direct LINZ fetch of the same tile. If they differ, the route is quietly serving
Mapbox. That is the real effect of the key: not access, but which of the two
sources the imagery comes from — and therefore **who has to be credited.**
**The route now NAMES the source that answered**, in an `x-imagery-source`
header (`lib/imagery/source.ts` holds the header name and the credit strings —
a route file may only export handlers, so it cannot live in the route). The
caption used to read "LINZ Basemaps, or © Mapbox © Maxar where that isn't
configured": both providers named, neither committed to. An "or" is not
attribution, and crediting the wrong one is a licensing problem rather than a
wording one.

The page cannot tell them apart from the picture — an `<img>` hands back no
headers — so `AddStructure` fetches ONE tile for its header, which the browser
already has cached from drawing it. **No imagery on screen means no imagery
credit**: null prints nothing, because crediting a provider whose photograph
nobody is looking at is its own small untruth. Proven both ways by removing the
key and restarting: LINZ serves a 15,708-byte WebP and is credited, Mapbox
serves a 70,832-byte JPEG and is credited.

**Surveyed easements are drawn, and they BLOCK the drag.** LINZ publishes
**784,660 easement polygons and 78,296 land-covenant ones** in `NZ Non-Primary
Parcels` (50782) — real geometry, not just the instrument record the title gives
us. You cannot build over a right of way or a drainage easement, so a burden
comes OUT of the buildable ground and `canPlace()` refuses to cross it: a
footprint that can be dropped on somebody's registered right of access is a plan
taken to a builder before anyone notices.

**Overlap, not bounding box.** A bbox round a suburban section catches the whole
subdivision's right-of-way network — 540 Wairakei Road came back with twenty
that way, and 565 Wairakei's "easement" turned out to be the neighbour's. A
polygon counts only when one of its corners is inside the parcel or it swallows
one of the parcel's. No setback is applied round a burden either: its own edge is
where it stops.

**And an absence of shading is NOT an all-clear.** Easements in gross, some
service easements and older ones are described in words on the title with no
surveyed extent at all. The copy says so, the same way the unpublished-register
case does. The polygon shows WHERE it runs and still can't say what it permits —
so the appellation ("Area C DP 498181") is printed for the solicitor.

**Development potential is MEASURED off the parcel, not subtracted from it.** It
used to be land area minus the house footprint, which writes the same sentence
on every large section and is wrong about many of them: it cannot tell a house
at the FRONT of a 700m² section with one clear back yard from the same house in
the MIDDLE ringed by 4m strips. Both have "427m² spare"; only one can take a
dwelling. 230 Sewell Street proved it — 811m², reported "minor dwelling
possible · likely", and on its actual geometry it carries THREE buildings, 224m²
of genuinely clear ground, and a largest unbroken rectangle of 5m × 8m. Nothing
fits.

LINZ publishes the pieces free: **NZ Primary Parcels** (50772) for the boundary,
**NZ Building Outlines** (101290, 3.2m footprints) for what stands on it, and
**NZ Addresses: Roads** (123110) so "the front of the section" means something.
`lib/linz/site-geometry.ts` fetches and projects them to metres;
`lib/scoring/site-layout.ts` is pure and does the geometry, so `verify:development`
asserts it against squares it draws itself.

**THREE traps, all silent, all returning a plausible-looking nothing.** The
building layer serves NZTM by default, so a lat/lng bbox matches NOTHING — zero
rows, no error, indistinguishable from a bare section; `srsName=EPSG:4326` is not
optional. The CQL BBOX takes **lat first** under the urn-form CRS; reversed, same
silent zero. And **`wfs()` in property-records DISCARDS the geometry** — by
design, because every table it was written for is attribute-only — so injecting
it into the parcel lookup returned one row with no polygon on it, `outerRings`
found nothing to read, and the section came back shapeless. Use `wfsFeatures`,
with the CRS, for anything spatial.

**Watch the TIMEOUT when adding calls.** The record lookup went from four calls
to nine when the register instruments and the parcel geometry were added, and a
15-second budget that fit the old shape silently truncated the new one — the
timeout doesn't fail loudly, it returns whatever finished, so 156 Buchanans Road
came back at 15,004ms with a **null title** and looked like a property LINZ had
never heard of. It is 25s now, and everything that can run concurrently does: the
site geometry starts on the address point without waiting for the title, and the
encumbrances (which do need the title number) wait alongside it rather than
after it. Back to ~6s.

**The biggest rectangle is not the one that fits.** A 20m × 3m strip down a
boundary beats a 7m × 10m corner on area and holds nothing, so every maximal
rectangle is tested rather than only the largest. Axis-aligned is a real limit
and it errs toward "doesn't fit", which is the right direction under a
six-figure number. Only a footprint whose CENTRE is inside the parcel counts —
the bbox catches the neighbour's garage.

**And "front" needs projecting, not measuring.** A house dead-centre on a 20 ×
35m parcel read as "toward the front" using straight-line distance from the road
point, because the far corners are further away than the middle of the back
fence. It projects onto the road→section axis now.

**The rules are the NES-DMRU's, not ours.** The first version used an invented
1.5m setback — not a number anybody could check. The **National Environmental
Standards for Detached Minor Residential Units** have been in force since **15
January 2026** and are national: **70m²** maximum, **2m** from boundaries and
from other buildings, **50%** maximum site coverage in residential / mixed-use /
Māori-purpose zones (no maximum rural; rural setbacks are 10m front and 5m
side/rear, which `NES_RURAL_SETBACK_M` names but does not yet model).

**Fitting is not the same as being allowed.** 570 Wairakei Road has an 8m × 17m
clear area and 521m² of building on 896m² — adding 70m² takes it to 66% and the
cap refuses it. Coverage is checked independently of whether the thing
physically fits.

**What the NES does NOT displace, and the copy says so:** district-plan hazard
rules, a covenant on the title, and cross-lease or unit-title arrangements. The
finding says what fits and what the national standard permits, never that a
council has agreed. The card's footnote used to read "must be confirmed with the
council / LIM" — wrong once measured, and the homework rule failing in the same
breath.

**And it is DRAWN.** `components/PropertyInspections/SitePlan.tsx` renders the
parcel to scale with its boundary runs measured, the footprints where they
actually stand, and the unit at its true 7m × 10m inside the clear envelope it
would sit in. A sentence about a 19m × 51m back yard has to be taken on trust; a
plan can be held against the aerial shot in the listing. Two bugs worth
remembering: the padding is in METRES like everything else in the viewBox (a
fixed 26 left the section occupying 40% of the canvas), and the drawn unit must
be the UNIT — it was first drawn as the whole clear rectangle with "7×10m"
written across a 16m × 19m box.

**A covenant on the title withholds the development BONUS, not the valuation.**
The Land tab puts real money on adding a dwelling — "+$122,000–$217,000
potential value · +6 to your buyer score" — and `assessDevelopment` had never
heard of a covenant, so it could show six figures of upside on a property whose
own title may forbid it. No-second-dwelling and no-further-subdivision covenants
are common on subdivision titles, and that is the same register the report now
reads.

**The valuation is deliberately NOT discounted for easements or covenants**, and
the reason is not squeamishness. We can't read the terms — one covenant requires
a letterbox, another bans a minor dwelling, and a flat percentage for "a
covenant exists" is invented weight. More decisively, **most NZ titles carry an
easement**, and the land value is extracted from suburb comparable sales that
carry them too, so the ordinary easement is ALREADY in that number and
discounting again would double-count it. That is exactly why cross lease is
different: it is a minority tenure priced against predominantly freehold
comparables, so its discount corrects a real mismatch. An easement is not a
mismatch, it is the norm. (A live caveat is a third thing again — a transaction
risk, not a change in what the house is worth.)

**So the bonus goes and the range stays.** The score bonus is WITHHELD entirely
— the Tier 3 rule applied to an opportunity, since we no longer know the
development is permitted, and halving it would be a number nobody chose. The
indicative value range is kept, because "this might be worth $122,000, go and
read covenant 5638539.1" is useful where silence is not. Confidence can no
longer read "likely", the instrument number is named in the summary and the
blockers, and the badge SAYS the bonus was withheld rather than letting the
points quietly vanish.

**THE 1,000-POINT SCORE IS GONE — removed 24 September 2026.** It was a rubric:
a thousand points shared across 48 items by weights somebody chose, which asked
every reader to learn what 600 meant before it told them anything. A dollar
figure needs no key. The report now leads with what the property is worth and
what it is built from, and the Improvements tab shows each item's value against
its cost to replace new rather than "X/max pts".

What did NOT go, and must not: the **per-item 1–10 condition read**. It is more
load-bearing than ever — it sets the EFFECTIVE age, which sets how much life is
left, which is what depreciates the item. `scoreProperty` still runs and still
reports COVERAGE (`assessedPoints`, `unassessed`, `byInspection`), because a
valuation built on two thirds of a house is honest only if the reader is told
the fraction. What is no longer surfaced anywhere is the aggregate total.

**Items with no replacement cost are STATED FACTS with no number.**
`isFactOnly(id)` — an improvements item with no line in `IMPROVEMENT_BASE_COSTS`
— covers kit_layout, liv_size, liv_light, bed_size, bed_windows, gar_type and
out_landscaping. A room's proportions and where the light falls are worth real
money, but through the LAND and the market; there is no line item for
"north-facing", and inventing a dollar value for one is the invented-staircase
habit in a new place. Derived rather than listed, so adding a cost line is all
it takes to stop an item being a fact. `ext_solar` and `gar_power` were on that
list by accident and now carry costs — a set of solar panels is plainly not an
intrinsic quality.

The former score **penalties and bonuses** (highway, flight path, rail) are
reported the same way: facts about the site, stated and not priced. What a
flight path costs is a question only comparable sales can answer.

**The itemised valuation (v6, roof first) prices an item in seven reported
steps** — material, visible concerns, effective age, material life, measured
area, cost split, and value. `lib/scoring/roof-value.ts` is the template for the
rest and is pure so `verify:roof` can assert it.

Three things in it are load-bearing and easy to get wrong later:

**Condition moves the AGE; it never multiplies the value.** `lib/scoring/depreciation.ts`
holds the one rule every priced item shares. A 1–10 read maps to an effective
age either side of the chronological one — 10 presents 25% younger, 1 presents
50% older, and 5.5 moves nothing. Applying a condition factor AND an age/life
fraction discounts the same wear twice and halves the value for free.

**The base shell depreciates by AGE now, not by a condition factor.** It costs
the same to build a shell today whatever year the house went up; what differs is
how much life is left in it. `SHELL_LIFE_YEARS` is 70 and `SHELL_RESIDUAL` is
25%, and the residual is the load-bearing half — a 1925 villa's frame is a
hundred years old and holding a house up, so straight-lining it to zero would
say the structure of every pre-war house in New Zealand is worth nothing. Both
are tunable in one place. This moved the demo's shell from ~$119k to ~$48k on a
1975 house, which is the intended direction: the old number was flattering a
51-year-old building.

**A module that another dependency-free module imports needs the `.ts`
extension** — `import … from "./depreciation.ts"`. Node's type stripping needs
it to resolve the file in the verify scripts, and `allowImportingTsExtensions`
in tsconfig lets `tsc` accept it. Without the extension `verify:roof` dies with
ERR_MODULE_NOT_FOUND and nothing else notices.

**A roof is not a floor, and it is not its own footprint.** `ext_roof` was
priced at `roof area ≈ floor area`, which overstates a two-storey roof by about
2× and ignores pitch and eaves entirely. It is measured now: footprint (LINZ
building outline) × 1/cos(pitch), plus an eaves band around an estimated
perimeter. Every step is in `area.workings`.

**Only LABOUR carries the regional multiplier.** Steel costs the same in Gore as
in Remuera. Letting a region reach the material line makes build cost track land
value, which is the rival-valuation mistake this codebase has deleted twice.

Value and liability are reported separately and always sum to the replacement
cost. A roof at the end of its life is worth nothing AND costs the full
replacement — those answer different questions (what you are buying, what you
are about to spend) and a reader needs both.

**EVERY costed item gets the seven steps, not just the roof.**
`lib/scoring/item-value.ts` is the generic one and `lib/scoring/item-life.ts`
holds the service life, material/labour split, disposal share and whether the
job needs scaffold, for all 41. The roof keeps its own module because its SIZE
step is real geometry; everything else scales off a figure the report already
holds, and step 5 SAYS which it is — "scaled, not measured" — because that
changes how much weight a reader should put on it.

**A zero cost line is not a line.** "Scaffold $0" printed on every foundation,
driveway, kitchen and floor in the report — you do not put scaffold round a
footing, and printing the line to say so invites the reader to wonder whether we
know that. The card drops any component costing nothing on that item.
`verify:item-value` asserts both directions: nothing reachable from the ground
is charged scaffold (and its workings never mention it), and everything worked
at height is.

**The generic model does NOT re-derive the cost.** `rcnNew` already carries this
property's size and spec tier from `IMPROVEMENT_BASE_COSTS`; re-pricing it would
be a second cost model disagreeing with the first. What it adds is the split and
the life.

**The headline IS the cards.** `valueImprovementItems` values every item with
the same `valueItem()` / `valueRoof()` the cards call, so the headline, the map
pin and the category totals are the sum of the cards to the dollar. It used to
be rcn × spec × a condition factor while the cards were cost × life left: on a
fair 1975 house the cards summed to a quarter of the headline, and a "modern"
kitchen read "$27,409 of $25,200", worth more than it costs to replace. Spec
sets the cost NEW and is never a discount on the value; an ungraded spec is the
1.0 reference, never a silent `"dated"`. Every valuation takes
`labourMultiplierFor(listing)` and the report passes the roof's footprint, so a
card and the headline can't be fed different inputs. `verify:estimated-value`
asserts the sums agree.

**Urgent action is its own step; age can't carry it.** Condition moves the age,
which is right for wear, but a one-year-old door smashed with a crowbar has used
one year of life and is worth $0, and a sound roof with lifted sheets needs a
roofer now. `actionFor()` gives the work, its scope (maintenance / repair /
replace) and its share of the item's replacement cost: the analysis's
`urgent_action` when recorded, otherwise a SEEN defect at 3/10 or worse (never an
"inferred" one). One figure, three places: the card's Action step, the value
(less cost to cure, never below $0, headline and card alike) and a PRE-TICKED
Renovations line priced at exactly that cost. It gets no three-tier costing: the
tier engine turned a $944 board repair into a $9,753 re-clad. On an item past
its life the replacement is the action and the repair is an unticked stop-gap,
so the plan never pays for both.

**Shape and frontage are MEASURED off the LINZ boundary, not read off a photo.**
`measureSite()` (site-shape.ts): workable % = the share at least 6 m wide
(morphological opening); frontage = metres of boundary on LINZ road parcels
(intent "Road", same layer as the section), counted only in continuous 3 m+
stretches after trimming the 1 m touch tolerance off each end (a cul-de-sac head
is many short segments; a side boundary's first metre is not frontage). No road
contact → look for a narrow access-lot neighbour touching the road; the homes on
it are the neighbours touching it WITHOUT their own frontage. `withMeasuredSite()`
applies it for the report AND the map. Older "DCDB" boundaries are medium
confidence and say so. The catalog's land sources are the UNMEASURED defaults and
must never claim LINZ; the measured helper replaces them.

**Topography is MEASURED from the LINZ elevation model** — Basemaps
"terrain-rgb" tiles (height = −10000 + (R·65536+G·256+B)·0.1 m), same key as the
aerials, PNG decoded with node:zlib (lib/linz/elevation.ts). Heights come in
0.1 m steps, so slope is a least-squares PLANE over a 2.5 m radius, never a
neighbour difference (that is mostly rounding). Usable = no steeper than 1:10;
bands match land-quality.ts. Under 80% coverage → null, and the analysis's read
stands, labelled as a read.

**"Typical" is MEASURED nearby, not national.** `measureNearbyTypical()`
(lib/linz/nearby-typical.ts) samples ~45 residential sections within 400 m — a
3×3 grid of small parallel LINZ queries (one 400-parcel query took 9 s) — and
takes the median workable % and usable % by the same rules as the subject, with
elevation at zoom 16 (4 tiles, not 16). A national 90% usable discounted every
Kelburn section for slope its suburb's sales had already priced in. Under 15
samples falls back to national and the working says so.

**Shade is MEASURED: midwinter sun traced through the LINZ surface model**
("elevation-dsm" tiles, buildings and trees). From open ground in the section,
every 15 min on the shortest day, toward the sun: surface model to 100 m, ground
model to 1.5 km for hills. Shade cast from INSIDE the boundary doesn't count
(the owner can fell a tree). When measured it REPLACES direction + shade in the
land value — the compass was only a proxy for sun, pricing both credits a north
face twice. Subject and typical neighbours go through ONE tracer at ONE zoom:
reading neighbours coarser averaged their trees down and made every section
look shadier than its street. Lookups use a linear metre→pixel map
(`inFrame`); per-lookup projection was most of the time.

**The Title & legal tab opens with what the title did to the value**
(`TitleValueCard`), read from the one valuation, never recomputed. Freehold is
FULL value, never "+$X for freehold" — the land rate comes from freehold sales,
so a premium would count it twice. A cross lease shows its dollar deduction and
land share; unit title, leasehold and licence to occupy say they are priced by
their own market; an unknown title says nothing was adjusted. Only THIS
property's title is shown — the breakdown says what it means, how it's valued
and its risks; listing every tenure told a freehold buyer about licences to
occupy. The dollar figure blurs on a free report.

**Title & legal is its own tab, in three groups, with no scores.** It was ten
cards in one worst-first list on the Land tab with marks out of ten ("Easements
7/10", "Moderate — verify"), mixing register facts, inferred risks and missing
documents. `components/Legal/TitleLegalTab.tsx`: (1) WHAT'S REGISTERED AGAINST THE TITLE (the tenure itself is the card above it, said once) — the
live register instruments, each named in a buyer's words ("Easement", not LINZ's
"Easement Instrument") with what it means and its instrument number; a surveyed
easement area is folded into its instrument, not listed twice; (2) RISKS TO
CHECK — Low / Check / Problem, and a Tier 3 read is capped at Check (a "may be"
is never a Problem); (3) DOCUMENTS YOU CAN ADD — LIM, consents, EQC in one panel.
The Land tab keeps the land value and add-a-structure.

**An item that can't apply isn't shown, anywhere.** `legalItemApplies()`
(lib/scoring/applies.ts): a body corporate needs a unit title, or a cross
lease / unknown title where something STATES one; never freehold. It used to
"apply" whenever the model returned the item (`has("leg_bodycorp")` in
analyze.ts), which is circular. EQC claim history applies only in regions with a
major claims event (Canterbury, Wellington, Marlborough, Hawke's Bay, Gisborne,
Auckland, Nelson/Tasman, Buller). Same rule on the Title & legal tab and the
viewing checklist. Unconsented works shows only when something RAISES
it: a second dwelling or structure, the advertised floor area materially over
the rating record, or the analysis flagging it on a real (not Tier 3) read or
with a fix attached. "Nothing suggests a problem" is not a risk to check.

**An extra structure's consent is ASSUMED, and the reader is asked to check.**
Nothing public says whether a sleepout was consented, so charging every one a
Certificate of Acceptance priced a problem nobody had found. The CoA is costed
only when `consentStatus === "unconsented"` (the listing or a document says so);
`unknown` reads "Assumed consented — please check this" on the structure card
and as a Check (never a Problem, no cost) on Title & legal. Never write "no
consent on record" — we have no record to consult. A POOL's status is its safety
fence, not a consent: an unconfirmed fence is still costed and says so.

**Land starts from a TYPICAL section, not a perfect one.** valueLand's rate comes
from ordinary sales of ordinary sections, so `adjustLand()` (land-value.ts)
measures each fact from typical: an average section lands on the base, a better
one above it. Shape and slope discount only the unusable AREA (slope only on the
land the shape left workable, so a steep corner isn't counted twice);
orientation and access apply to the WHOLE site. An unestablished fact moves
nothing. Every rate lives in LAND_ADJ and is labelled industry-typical on the
page until sales data calibrates it. Trees are not valued (taste).

**The base rate is only what is HIDDEN behind the linings.** Frame, electrical
pre-wire, plumbing rough-in, consents, prelims, margin. Anything a photo can show
is a graded item, never shell: wall linings (`liv_walls`) and ceilings are items
priced per floor m². Plumbing rough-in ends at the capped stub-outs (pre-line
inspection); fit-off is on the fixtures' own cards, and the rough-in is priced
per BATHROOM, not per m². On the 150 m², one-bathroom reference house the frame,
rough-in and linings add back to the old all-in $1,100/m², and
`verify:estimated-value` holds that.

**Waterproofing is not an item — removed 27 September 2026.** Nobody can see
a membrane, so it was always an inference, and a bathroom done with a consent
was inspected for it at the time. Leak signs (soft linings, swollen skirting)
live on the shower's viewing check instead. `RealReportView` drops any sub-item
the model no longer has, so older saved reports still carrying it render clean.

**But TILED wet-area work carries its membrane in its price** — the shower
(`SHOWER_MEMBRANE`, $2,500) and the bathroom floor (`FLOOR_MEMBRANE`, $800,
`floor_type` tiled / vinyl, a vinyl floor relaid as `flooring_sheet_vinyl`).
`membraneFor()` is the one place that decides. The shower in detail: Tiles and grout aren't
waterproof; a moulded liner and tray is. The analysis records `shower_type`
(tiled / liner) — visible — and is told never to assess the membrane, which
isn't. A tiled shower's cost new is the base plus `SHOWER_MEMBRANE`, assumed
present and valued; a liner carries none; an unknown type is priced as the
plain one. In the plan, `bath_shower` is its own job (`shower_liner` /
`shower_tiled`), not the whole-bathroom refit it used to fall into. So are
`bath_vanity` and `bath_toilet` (`vanity` / `toilet`); only "Replace the whole
bathroom" (`room_bathroom`) prices the full refit.

**Each bathroom and bedroom is valued on its own read.** Shower,
vanity, toilet, fan and bathroom floor are priced per bathroom;
bedroom heating, wardrobe and carpet per bedroom (`scale: "bedroom"`, $500 /
$850 / $1,000 — the old whole-house figures were for three), and the bedroom
ceiling is still floor-area priced but split one share per bedroom
(`roomKindOf`). They used to share ONE score per item — the worst, because a
mix is scored on its worst part — so a new ensuite was valued as the original
main bathroom. With two or more of a room the analysis returns `by_room` (same
names on every item) and `valueImprovementItems` values each seen room at its
own score, spec and material; the card lists them and they sum to the item. A
room no photo shows is NOT given another's score: it goes to `estimatedItems`
as `<id>:unseen`, estimated from the house like any unseen component. The
item's own score stays the worst room's. Urgent work is priced per room
(`actionCostNZD`), never share × all rooms. A missing bedroom count is the
reference three. Reports without `byRoom` keep the old count × one score.

**The build year is the OLDEST a component can be, not its age.**
`componentAge()` in depreciation.ts takes the younger of the build year (moved
by condition) and the age the condition alone implies. Aging every component to
the house put every kitchen, bathroom and window in every pre-2000 house at $0,
including renovated ones. A known replacement date beats both. But only GOOD
condition proves a replacement: the credit is zero at 4/10 and below (a worn
item looks exactly like the original) and full from 7/10, phased in between as
LIFE LEFT, not years. Blending years on an old house lands past the item's life
and puts a fair kitchen back at $0.

**`tsc --noEmit` does not catch a duplicate top-level symbol that SWC rejects.**
A `function Line` beside recharts' imported `Line` type-checked clean and broke
the BUILD — and a broken build in `next dev` serves the last good bundle, so the
page looked fine and simply never showed the new component. Two rounds of
debugging went into that. If a change renders as though it never happened, read
the dev server's errors before reading your own code.

**The itemised valuation WINS on the card, and it has to.** `SubItemCard` shows
the detailed figure where one exists and the itemised figure only as a fallback
(the two are now the same method; the fallback exists for a roof with no
footprint). It did not, briefly, and the roof showed "$16,417" in its badge
and "$0" at the bottom of the same card — the rival-valuation mistake this file
already records twice, reappearing the instant a second method existed. One
item, one number, and the better method is the one displayed.

**The roof is measured off the MAIN building, not every structure.**
`siteLayout.mainBuildingAreaSqm` is the largest footprint on the parcel;
`builtAreaSqm` is all of them, and using it hands the house a detached garage's
roof as well — a third of a reroof quote on the wrong line.

**`roofMaterialFromText()` returns null rather than the nearest match.** The
analysis writes the material in its own words and the whole valuation hangs off
that one field: pricing a clay-tile roof as concrete is a $20,000 error that
looks exactly like a correct number. Pattern ORDER is load-bearing — "pressed
metal tile" contains both "metal" and "tile", and "concrete tile" contains
"tile", so the specific patterns are tested first. `verify:roof` asserts it.

**No trade rate or material price in this codebase has ever been verified, and
the code used to claim otherwise.** `lib/labour-rates/index.ts` carried
`dataSource: "Builderscrack <region>"`, `jobCount: 23` and `confidence: "high"`
— and the Renovations tab PRINTED it to buyers: *"Builderscrack West Coast — 23
electrical jobs (last 6 months) · Confidence: high"*, the last word in green.

Every part of that was invented. The supplier name appeared **nowhere else in
the repository** — no fetch, no scrape, no cached response — the counts were
sample sizes nobody counted, and the six-month window was never a window. Git
says why: `labour-rates` arrived in a 61-file bulk snapshot and `materials-db`
in the commit that added the three-tier feature. No commit anywhere records
research. `lastUpdated: "June 2026"` is when the FILE was written.

`materials-db.ts` is the same shape — a header claiming *"Sourced from Bunnings
NZ, Mitre 10, Placemakers"* and 356 `source:` fields naming retailers, with
nothing that reads a price. `materials-catalogue.ts` builds retailer **search
URLs**; it links to a search box, it does not read a price off one.

The citations are gone, `confidence` is `ai_estimate` (a word the type already
had), and the card says plainly that no local rates have been collected. **This
is the same rule as the rest of the app** — never claim a source you don't have —
broken at the root of the costing engine, where a wrong number ends up in
somebody's offer. Don't put a supplier name back unless something here
actually calls one.

**Materials are flat nationwide; only LABOUR carries a regional multiplier.**
Gib is Gib in Gore and in Remuera, and NZ buys from a handful of national
suppliers — so `costItem` multiplies the labour line and leaves materials alone.
**Build cost must never track land value.** A $3m Queenstown section does not
make the timber on it cost more, and deriving one from the other would be the
same class of mistake as the rival valuation formulas already deleted twice.
What genuinely varies is the local labour market, which correlates with land
prices without being caused by them.

**Queenstown was filed as the CHEAPEST band in the country.** `queenstown`
aliased to "Remote / Rural" at 0.77 — presumably reasoned as "tourist town, far
from anywhere" — when Auckland and Queenstown Lakes are the two most expensive
districts to build in, its cost of living driving trade rates and travel adding
more. It has its own region at **1.05** now, with Wānaka, Arrowtown, Frankton and
Glenorchy mapped to it. Cromwell and Alexandra are deliberately NOT included:
they are Central Otago, and inventing a multiplier for a district nobody has
priced is the invented-number habit in a new place. Erring high is also the safer
direction — understating labour makes a renovation look cheaper than it is, and a
buyer budgets off that figure.

**The town beats the region behind it.** `resolveRegion` used to read only the
LAST token, so "Queenstown, Otago" resolved on "otago" and priced Dunedin — which
would have left the fix above completely inert, since a listing's region field
says Otago. It now scans **leftmost position first, longest phrase at that
position**, so the town wins over the region it sits in while "Bay of Plenty" and
"New Plymouth" still resolve whole. The call site passes city AND region joined,
because neither alone is enough: region-only loses Queenstown, city-only loses
every Auckland suburb. Unknown still falls to the national median and never to
Auckland — pricing a Hokitika reroof at metropolitan rates is the expensive
direction to be wrong in.

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

**And "the register wins" is now enforced rather than asserted.** It didn't. The
analysis built its property context by taking the MODEL's `title_type` first and
falling back to the listing — so a LINZ Record of Title saying cross lease was
overruled by a guess made from marketing photographs, in the one place that
decides whether the cross-lease and body-corporate items are scored at all.
`resolveTenure()` in `lib/scoring/title.ts` holds the order, dependency-free so
`verify:title` can assert it: **LINZ, then the model, then the page scan.** The
page scan is last for a reason — `detectTitleType` matches the word "freehold"
ANYWHERE in the HTML, which a related listing or a line about the other sections
this agency has for sale will satisfy, so it must not outrank a model that
actually read the listing. `titleTypeFromRegister` on the listing is what makes
the three distinguishable; without it "the listing wins" would have handed the
keyword scan the same authority as the register.

**One tenure, everywhere.** The resolved answer is written back onto the listing
when it beats the page scan, because `context.titleType` decides which
conditional items score while `listing.titleType` drives the header, the title
score, the viewing checklist and — since a cross lease became a house — the
valuation method. Two different answers is how a report comes to score the
cross-lease flats-plan item while valuing the property as a freehold section.

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

**What is registered against the title is READ, not guessed.** "Encumbrances /
caveats" came back 2 out of 2, "Low concern", badged **"T1 — Confirmed from the
public record"**, against a record nobody had read — the free feed gives the
title's type, estate, share and area, and the instruments live somewhere else
entirely. They are published on the same key: `Title Memorial` (52006) →
`Title Instrument` (52012) → `Transaction Type` (52009), the last of which is
GENERATED into `lib/linz/instrument-types.ts` (525 rows, `npm run
build:instruments`) rather than fetched, so a report never waits on a catalogue
to name what burdens a property.

**`curr_hist_flag` is the whole safety of it.** A title's memorial list is a
HISTORY, not a state — NA89C/519 carries fifteen memorials of which five are
current, the rest mostly mortgages long since discharged. Reporting those as
live would tell a buyer a house is mortgaged to three lenders and hand them a
negotiating point that does not exist. Only `CURR` is ever reported, and an
instrument whose code doesn't decode is dropped rather than printed raw.

**Presence is scored; severity is not.** We get an instrument's TYPE, number and
date. We do NOT get its TEXT — a covenant's wording is inside the instrument
document, a paid Landonline download — so we know a covenant exists and cannot
know whether it bans a minor dwelling or specifies a letterbox. "3 covenants =
4/10" would be inventing weight for documents nobody has read, which is the
condition multiplier all over again. So easements/covenants floor at **6**
("there is one and we can't read it" is a caution, not a fault), a live
**caveat** scores 2 because it is unambiguously serious without reading a word,
and an EMPTY register scores 10 — absence is the strong, checkable finding here.
A mortgage (discharged on settlement) and, on a cross lease, the flat leases are
never counted as burdens, or every ordinary house would look encumbered.

**A register we couldn't read is not a clear title, and there are TWO ways not to
read one.** `listing.encumbrances` absent means the lookup never ran.
`memorialsFound === 0` means it ran and LINZ publishes no register for that title
— **roughly 17% of live titles**, measured over a 300-title sample; CB390/291 is
live, freehold and 1,960m² with none. From out here an unpublished register and
an unencumbered one are identical, so only `memorialsFound > 0` with an empty
`live` list is an all-clear. The other two leave the items UNSCORED, and the
model is told in as many words not to imply the title is clear — reading an
absence of data as an absence of encumbrances is how a buyer ends up reassured
about a covenant nobody looked for.

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

**The Financial tab's price box governs the maths, and for a while it did not.**
`summarise()` was called with `price: effectivePrice` spread in AFTER `...inp`,
so the reader's own purchase price was overwritten by the listing's asking price
on every render. The box accepted what you typed and displayed it; deposit, loan,
repayments, maintenance, the projected sale value and the walk-away figure all
carried on being computed from the asking price. **A control that visibly takes
an input and silently ignores it is worse than one that is disabled** — a buyer
modelling an offer $400k below asking got the asking-price answer back and no
sign anything was wrong.

Our own valuation is still the SEED for that box on a "By Negotiation" listing —
that part was right, and refusing to compute while holding the number needed to
compute is the app declining to do its job. It is a seed and nothing more.
`seedPrice` also has to be applied in an effect, because `propertyValue` is
derived from the site geometry and that is FETCHED: it can land after the tab
mounts. The effect fills the box only while it is still empty, since overwriting
a figure somebody typed because a request came back late is the same bug facing
the other way.

**The plan says whose idea each line was.** Once work started joining it because
it falls due inside the hold, a single list headed "the work you've chosen" was
simply untrue — and a reader sliding from five years to ten watched the total
jump with nothing telling them what had arrived. It is two groups now: **You
chose these** (an explicit tick) and **Our recommendation for your N-year hold**,
which names the reason and marks each line "due ~yr 7". Tick something and it
moves from ours to yours; the heading and the contents re-make themselves as the
slider moves. The reader's own list leads the summary card; ours sits at the FOOT
of the tab under "Our recommendation", below the items, with a one-line link
from the top. On a ten-year hold ours ran to forty-odd lines above the three
the reader had picked. The total still counts both.

**An untick has to be reversible where it happens.** Both lists used to render
`selected`, so unticking an item removed its own checkbox from the page — the
control you needed to change your mind disappeared with the decision, and the
only way back was the Improvements tab. Survivable while the plan held two items;
now that most in-hold work is ticked by default, unticking IS the normal
interaction. The detail list maps everything in scope for the hold, so an
excluded line stays visible and unticked.

**The hold slider appears twice and is ONE control.** `HoldPeriodSlider` reads
and writes `HoldPeriodContext`, so a second instance at the foot of the walk-away
card moves with the one in the report header and there is no syncing to get
wrong. It is there because the hold is the single input that moves that figure
most — costs, deferred work, the uplift and ten years of compounding all turn on
it — and asking a reader to scroll back to the top of the report to try another
number is asking them not to try one.

**The plan dates work from the item's LIFE, not its condition score.**
`urgencyYears` is `ItemValue.yearsLeft` — the same expected-minus-used life the
card's life bar shows — and the condition score is only the fallback for an item
the valuation couldn't price. The old map read 7/10 as "due in about seven
years" whatever the item was, so a 7/10 foundation with 67 years left sat in
every ten-year plan: the demo carried 49 of 50 items and $228,956, against 30
and $92,665 on the items' real lives. The card's "outside your hold" tag and the
plan line's label read the same figure.

**The renovation plan follows the hold slider, and for a long time it didn't.**
The demo's renovation total read $3,859 at a three-year hold and $3,859 at a
fifteen-year one — a 4/10 roof with an $18,000–$28,000 range sat outside the plan
at every setting. `renoIncluded` defaulted to `autoInclude`, which fires only for
items scoring ≤30% or legally required, so extending the hold made work
*eligible* without ever costing it. Somebody modelling a fifteen-year hold on a
1975 house was told it needed $3,859 of work.

**Work that reaches end of life while you own the house is money you will
spend** — and if you don't spend it you sell a house with a dead roof, which
costs you at the other end instead. Either way it belongs in the walk-away, so
due-within-hold is now part of the DEFAULT. An explicit tick or untick still
wins: this changes what happens when nobody has said anything, never what
somebody chose.

**Then split it by WHEN you pay.** Making the plan hold-aware pushed the ten-year
figure to $195,729 and every cent of it landed in "Total money needed to buy",
which read $430,029 — a roof due in year seven counted as settlement cash. Only
work due inside `UPFRONT_RENO_YEARS` is deposit money; the rest is
`renoDeferred`, a holding cost over the period. The walk-away is unchanged by the
split to the dollar at every hold length, which is the check that it reclassified
money rather than losing or double-counting it.

`renoControls.included` is deliberately NOT hold-aware — it is built above
`HoldPeriodProvider` and cannot read the hold. It only answers for Healthy Homes
and extra-dwelling compliance items, which are legally required and therefore
`autoInclude` at any hold length, so nothing it says can disagree with the plan.

**Zero is a claim too, and the walk-away figure was making it.** Renovations
were subtracted from cash in and the projected sale price did not move a cent —
so spending $50k dropped the ten-year position by exactly $50k. That is not a
neutral model, it is the assertion that renovation returns PRECISELY NOTHING,
which is as strong as any uplift number and far less likely.

`renoUplift` is the app's OWN valuation talking, not a market promise. Each item
already carries `valueGap` from `improvement-values.ts` — `valuePotential −
valueNow`, where potential is that component at **modern spec, as-new**. Sum it
over the ticked lines and you have what `valueProperty` would say the house is
worth once the work is done, on the same depreciated-replacement-cost model as
the rest of the report. The market then grows the IMPROVED value, because a
better house appreciates on a bigger base.

**A patch contributes nothing, deliberately.** `valueGap` measures the gap to
modern-and-as-new, which is what a replacement buys; re-grouting a shower moves
neither the spec tier nor the condition to as-new. There is no principled figure
in the model for a partial restoration and inventing one would be the same habit
this codebase has deleted elsewhere — so Patch Up spends the money and adds no
value, and the copy says so. Zero errs conservative, which is the right direction
when over-capitalising is how people lose money on renovations.

**The two tabs have to agree.** The Renovations tab promised "we deliberately
don't quote a resale gain" while the Financial tab quietly modelled zero. It now
draws the distinction: no promise about what a BUYER will pay, and a stated
figure for what OUR valuation makes it worth. The uplift gets its own line rather
than inflating the projected price silently — it moves a six-figure number and
the reader is owed the reason.

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

**A cross lease is graded on how shared the site actually IS.** Every cross
lease in the country used to score a flat 5/10 — the well-separated pair with
their own driveways and the rear flat up a shared right-of-way, identical. The
VALUATION had already learned to tell those apart (5% against 8%), so the
headline number a buyer actually reads was the less informed of the two, off
data already in hand. `assessTitleType` takes an optional cross-lease context
(the LINZ share denominator, and what the analysis could see of the sharing) and
reads `crossLeaseDiscount` rather than re-deriving anything — two expressions of
one finding cannot then tell different stories about the same house.

**It never leaves its lane: 4 to 6, asserted over every combination.** However
tangled, the owner still holds a share of the fee simple where a leaseholder
owns no land at all, so it floors above leasehold's 3. However tidy, the flats
plan can still be defective and every footprint change still needs the
neighbours' signatures, so it caps below unit title's 7 — those restrictions
ARE the tenure and no amount of fencing removes them. **Two flats with nothing
observed still scores 5**, exactly as before, so the change only ever moves a
property the evidence actually describes.

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

**Legal cards print POINTS, not a mark out of ten.** Out of ten was never the
scale anything is decided on: the title carries **28 of a buyer's 1,000 points
and 30 of an investor's**, and "5/10" states neither. Worse, it printed the SAME
number for two readers the item is worth different amounts to — the persona
toggle re-weights the whole report, and this one badge sat there unmoved.
`itemMaxPoints` / `scoredItemPoints` in `lib/scoring/engine.ts` mirror the
engine's own branch (condition scaled across the max, same rounding), and
`verify:title` asserts every score against it for both personas — a card that
disagrees with the section bar above it is worse than no card. The Improvements
tab has done this for a while via `improvementItemPoints`; Legal had not.

**Unassessed is not zero.** A Tier 3 item and one nobody scored show "n/a" and a
dash, never "0 of 28" — which reads as a property that failed rather than a
question nobody could answer. Document items keep their padlock until the
document is read, and the upload prompt now names what the document is worth.

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
into the report as a costed defect. Conditional + absent drops
out of both sides of the fraction, the same as a chimney or a pool.

**Appliances are chattels.** They stay out of Overview's "Priority repairs — act
before making an offer": they're negotiated on the agreement, may not be included
at all, and a tired oven leading that list makes everything under it look soft.

**A cost tier must describe the item you clicked.** Splashback, benchtop and sink
route to their own reno kinds. They used to fall through to `kitchen`, so
clicking Splashback offered "Re-paint doors, replace handles, new tap and a
benchtop resurface" and a $14,149 flat-pack kitchen.

**Healthy Homes compliance is the REQUIREMENT, not the spec tier.** It was
`tier !== "deteriorated"`, which asks how nice a fitting is rather than whether
the standard is met. 156 Buchanans Road: a bathroom with an openable window and
NO extractor fan rates "dated" — serviceable, just old — so it came back badged
**Compliant** on the very same report whose Improvements tab said "no extractor
fan visible". A landlord reading that could tenant a house they legally may not.

The five standards are now put to the analysis directly, against the
requirement, in the same `met / not_visible / absent` shape already used for
extra dwellings — the main dwelling had simply never been asked. Its answer wins;
the build era still establishes compliance where a house was put up under the
current Code (a fact about the building, not a read of a photograph); and
**`not_visible` is null, never true**, because "we didn't establish it" and "it
complies" are different sentences and only one is safe to print.

**An established failure pre-ticks itself into the renovation plan.** These are
not opinions about condition, they are legal obligations before the property can
be tenanted, so leaving a landlord to notice and tick them is the wrong default.
Gated on `compliant === false` on purpose: unknown is not a failure, and ticking
work nobody has established is needed puts money in a plan for a problem that
may not exist.

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
