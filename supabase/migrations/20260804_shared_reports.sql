-- ============================================================
-- RoiQ — Shared reports (send a report to someone via link)
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- ============================================================
--
-- A generated report normally lives only in the sender's browser. To share it,
-- we store a snapshot of the report JSON under an unguessable token; the
-- recipient opens /report/share_<token> and reads it back — no account needed.

CREATE TABLE IF NOT EXISTS shared_reports (
  token       text PRIMARY KEY,
  report      jsonb NOT NULL,
  -- Small denormalised fields for a future "reports I've shared" list / previews.
  address     text,
  score       integer,
  shared_by   uuid,          -- users.id of the sender, when logged in (nullable)
  recipient   text,          -- email the sender sent it to, if any (nullable)
  note        text,          -- optional personal message from the sender
  view_count  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_reports_shared_by ON shared_reports(shared_by);
CREATE INDEX IF NOT EXISTS shared_reports_created_at ON shared_reports(created_at);

-- Row Level Security ---------------------------------------------------------
ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous recipients) can read a share by its token. The
-- token is a 32-char unguessable secret, so possession of the link is the grant.
DROP POLICY IF EXISTS "Anyone can read a shared report by token" ON shared_reports;
CREATE POLICY "Anyone can read a shared report by token"
  ON shared_reports FOR SELECT
  USING (true);

-- Anyone can create a share (the sender may be logged out on the public sample).
DROP POLICY IF EXISTS "Anyone can create a shared report" ON shared_reports;
CREATE POLICY "Anyone can create a shared report"
  ON shared_reports FOR INSERT
  WITH CHECK (true);

-- Only the original sender can delete a share they created.
DROP POLICY IF EXISTS "Owners can delete their shares" ON shared_reports;
CREATE POLICY "Owners can delete their shares"
  ON shared_reports FOR DELETE
  USING (shared_by = auth.uid());

-- View counter --------------------------------------------------------------
-- SECURITY DEFINER so anonymous recipients can bump the counter without an
-- UPDATE policy that would otherwise let anyone rewrite a share.
CREATE OR REPLACE FUNCTION increment_share_view(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE shared_reports SET view_count = view_count + 1 WHERE token = p_token;
$$;

GRANT EXECUTE ON FUNCTION increment_share_view(text) TO anon, authenticated;

-- ============================================================
-- Done. Run this migration once in Supabase SQL Editor.
-- ============================================================
