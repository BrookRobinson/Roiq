-- 20260929_inspection_requests
--
-- "Get this report verified in person": a buyer asks for a building
-- inspection from a report; the request goes to the partner inspector who
-- covers that region, and the inspector owes Tectara a fee for the lead.
--
-- Both tables are server-only: RLS is on with NO policies, so the anon key in
-- the browser can read and write nothing here. Everything goes through the
-- service role (lib/supabase/admin.ts). Inspectors' fees and buyers' phone
-- numbers are not public data.

create table if not exists public.inspectors (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  company             text,
  email               text not null,
  phone               text,
  -- Regions covered, lower case, matching a listing's region as the portal
  -- gives it: 'auckland', 'canterbury', 'west coast', 'wellington'…
  regions             text[] not null default '{}',
  -- What this partner agreed to pay per lead sent, in cents (NZ$60 default).
  fee_per_lead_cents  integer not null default 6000 check (fee_per_lead_cents >= 0),
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

comment on table public.inspectors is
  'Partner building inspectors. One partner per region receives that region''s inspection requests.';

create table if not exists public.inspection_requests (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  -- The report it came from, and a share link the inspector can open.
  report_id        text,
  report_url       text,
  -- Who asked. Stored because they consented to it being passed on.
  user_id          uuid,
  buyer_name       text not null,
  buyer_email      text not null,
  buyer_phone      text,
  buyer_message    text,
  consent_at       timestamptz not null,
  consent_text     text not null,
  -- The property.
  address          text,
  suburb           text,
  city             text,
  region           text,
  listing_url      text,
  -- Where it went. NULL inspector = no partner covers that region yet: the
  -- request is still recorded and you are emailed a copy to pass on by hand.
  inspector_id     uuid references public.inspectors(id),
  status           text not null default 'new'
                   check (status in ('sent', 'unassigned', 'email_failed', 'new')),
  -- The lead fee, fixed at the moment it was sent, so a later price change
  -- never rewrites what an inspector already owes.
  fee_cents        integer not null default 0 check (fee_cents >= 0),
  fee_status       text not null default 'none'
                   check (fee_status in ('none', 'owed', 'invoiced', 'paid', 'waived'))
);

create index if not exists inspection_requests_inspector_idx on public.inspection_requests (inspector_id, fee_status);

alter table public.inspectors enable row level security;
alter table public.inspection_requests enable row level security;
