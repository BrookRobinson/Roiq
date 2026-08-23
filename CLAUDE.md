# Working on BDR Report

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
| `lib/billing/` | `plans.ts` is pure and safe to import anywhere; `stripe.ts` is server-only. |
| `lib/scoring/` | The 1,000-point engine. `model.ts` is the rubric, `engine.ts` scores, `catalog.ts` is the item list. |
| `lib/map/`, `lib/reports/`, `lib/negotiation/`, `lib/email/`, `lib/auth/` | Feature libs. Server-only modules say so at the top. |
| `supabase/migrations/` | Source of truth for schema. Regenerate `setup.sql` after adding one. |

## Rules that aren't obvious from the code

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
