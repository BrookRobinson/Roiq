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
