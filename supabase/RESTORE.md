# Restoring the database

The Supabase project this app pointed at (`ulnndumqtaniliiwvfle.supabase.co`) no
longer exists — the hostname doesn't resolve at all. That's the signature of a
**deleted** project; a *paused* one still resolves and answers, it just refuses
queries until you resume it. So there is nothing to un-pause, and a new project
is the way back.

Everything below is a five-minute job, and none of it needs the app to change.

## 1. Create a project

At [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
Region **Sydney (ap-southeast-2)** is the closest to NZ. Keep the database
password it gives you somewhere safe — you won't need it for this app, but you
will if you ever connect with `psql`.

## 2. Create the schema

Open **SQL Editor** → **New query**, paste the whole of
[`supabase/setup.sql`](./setup.sql), and run it.

That file is generated from the five migrations in `supabase/migrations/`, in
order, and every statement is idempotent — running it twice is safe. If you ever
add a migration, regenerate it with:

```bash
npm run db:setup-sql
```

## 3. Point the app at it

**Project Settings → API** gives you three values. Put them in `.env.local`:

| `.env.local` key | Where it comes from | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / publishable key | Ships to the browser — public by design |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key | **Server only. Never expose it to the client.** |

Then restart the dev server — Next.js reads `.env.local` at boot, so a running
server won't pick the change up.

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is in the file but nothing reads it; you
can leave it or delete it.

### Why the service-role key is needed

`map_listings` has row-level security on, with a read-everyone policy and **no
write policy**. That's deliberate: the anon key is `NEXT_PUBLIC_`, so it ships to
every browser, and any insert policy written against it would let anyone put
listings on the map. The map's writers are all trusted server routes — the report
contribution and the daily refresh job — so they use the service role, which
bypasses RLS.

Without `SUPABASE_SERVICE_ROLE_KEY` the map still **reads** fine; it just can't
be written to, and pins live only in the local `.data/` file.

## 4. Check it worked

```bash
curl -s localhost:3000/api/health/db | python3 -m json.tool
```

You want `"ok": true` and `"Schema complete — all 10 tables present, map writes
configured."` The response lists every table with its row count, so a missing
migration shows up by name rather than as a feature quietly falling back to seed
data.

Some tables report an RLS error on a read — that's expected. It means the table
is there and protected, not broken.

## 5. Backfill the map (optional)

Pins created while the database was down are in `.data/map-user-listings.json`.
The daily job re-persists everything it knows about, so:

```bash
curl -s localhost:3000/api/map/score-run | python3 -m json.tool
```

`scored` is how many rows landed; `failed` with a `persistReason` tells you what
stopped them.

## What still won't work afterwards

Worth knowing so a working database doesn't get blamed for these:

- **Reports are not persisted.** Nothing writes to the `reports` table — reports
  live in `sessionStorage`, per browser session. This is why a map pin only
  offers "View full report" to the person who ran it.
- **Auth is mocked.** `getUser()` returns null, so anything gated on
  `auth.uid()` — the watchlist, saved user variables — still falls back to
  `localStorage`.

Both are their own pieces of work, not restore steps.
