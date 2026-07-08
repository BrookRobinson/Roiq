import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_VARIABLES, variablesFromColumns, variablesToColumns, withDefaults } from "@/lib/map/variables";
import { getDefaultInterestRate } from "@/lib/map/interest-rate";
import type { UserVariables } from "@/lib/map/types";

export const runtime = "nodejs";

/** GET — the signed-in user's saved variables, else smart defaults (live interest rate). */
export async function GET() {
  try {
    const { profile } = await getUser();
    if (profile) return NextResponse.json({ ok: true, variables: variablesFromColumns(profile) });
  } catch {
    /* not signed in */
  }
  const rate = await getDefaultInterestRate();
  return NextResponse.json({ ok: true, variables: { ...DEFAULT_VARIABLES, interestRatePct: rate } });
}

/** POST — save variables to the users row when signed in. The client also keeps them
 *  in localStorage, which is the working store while auth is bypassed. */
export async function POST(req: NextRequest) {
  let body: Partial<UserVariables>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json", message: "Invalid JSON body." }, { status: 400 });
  }
  const variables = withDefaults(body);
  try {
    const { authUser } = await getUser();
    if (authUser) {
      const supabase = createClient();
      await supabase.from("users").update(variablesToColumns(variables) as never).eq("id", authUser.id);
    }
  } catch {
    /* auth bypassed / RLS — localStorage is the source of truth for now */
  }
  return NextResponse.json({ ok: true, variables });
}
