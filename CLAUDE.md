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
npm run verify:floor-area    # advertised floor area vs the rating roll, and what that must never say
npm run verify:foundation    # foundation scoring from type, era and visible movement
npm run verify:viewing       # the gate on the agent letter, and what it may claim about each item
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

`lib/viewing/status.ts` holds both rules and imports nothing, so
`verify:viewing` can assert them with plain node. The letter must also be built
from the report's **effective** sub-items, not the raw ones, or it claims a
score the report itself has withdrawn.

**Nothing auto-renews, and the site says so three times.** Purchases are one-off
(`mode: "payment"`) buying `ACCESS_DAYS` of access — the landing page, the
pricing page and the FAQ all promise it, so a recurring Stripe price would make
the copy a lie. `/api/health/billing` fails if a configured price is recurring.
`users.stripe_subscription_id` and `subscription_status` predate that decision
and stay unused.

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

**Discovery crawls OneRoof and nothing else.** OneRoof's robots.txt is
`Allow: /` and they publish a for-sale sitemap built for indexing.
**realestate.co.nz's robots.txt prohibits automated access and names this
business model** — "websites that specifically aggregate property listings…
as part of their business" — so it is never crawled; a user pasting one link
is a different act from harvesting the index nightly. Trade Me blocks
automation outright. Before adding a portal, read its robots.txt.

**Discovery never analyses.** ~260 listings appear daily; at NZ$1.45 each that
is ~$13,000/month spent on properties nobody may open. The nightly job records
that a listing *exists* — address, region, portal `lastmod` — and leaves every
scoring column null. A pin with a real address and an invented number is the
same failure the seed-listings rule guards against. Users analyse what they
care about, from their own allowance.

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
