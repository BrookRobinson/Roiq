// ============================================================
// Supabase admin client — service role, SERVER ONLY.
//
// map_listings has RLS on with a read-everyone policy and no write policy, which
// is right: the anon key ships to the browser (NEXT_PUBLIC_), so any insert
// policy written against it would let anyone put listings on the map. The map's
// writers are all trusted server routes — the report contribution and the daily
// refresh job — so they use the service role, which bypasses RLS.
//
// NEVER import this from a client component, and never expose the key to one:
// the service role can read and write every table regardless of policy.
// ============================================================

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * The service-role client, or null when SUPABASE_SERVICE_ROLE_KEY isn't set —
 * callers treat that as "can't persist" and carry on, which is what keeps the
 * app working without a database.
 */
export function createAdminClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const hasAdminClient = (): boolean =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
