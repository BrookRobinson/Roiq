import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

// REVIEW MODE: when true, every page is viewable without logging in so the whole
// app can be clicked through for review. Set to false (or NEXT_PUBLIC_REVIEW_MODE=false)
// to re-enable real auth gating before launch.
const REVIEW_MODE = process.env.NEXT_PUBLIC_REVIEW_MODE !== "false";

// Owner mode — the app is the owner's own machine, so it never asks him to log
// in. Refused outright in production; see lib/auth/dev-owner.ts.
const DEV_OWNER =
  process.env.NODE_ENV !== "production" &&
  (process.env.DEV_OWNER_MODE === "true" || process.env.NEXT_PUBLIC_DEV_OWNER_MODE === "true");

export async function updateSession(request: NextRequest) {
  // Skip auth enforcement when Supabase env vars are not configured (local dev without Supabase)
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — do not remove this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protected routes — redirect to /login if unauthenticated
  // /map is deliberately PUBLIC: anyone can browse it and see where the activity
  // is, but the pins are blurred and the reports don't open without Pro. Gating
  // the page itself would hide the thing that sells the subscription.
  const protectedPaths = ["/dashboard", "/report/new", "/account"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  // Report view routes are also protected (but /report/demo and the live
  // analysis test page are public)
  // Real reports need an account; the demo and the bundled samples must not,
  // because the landing and pricing pages send prospects straight to them —
  // gating the one thing that shows what you're selling would be self-defeating.
  const isPublicSample =
    pathname.startsWith("/report/demo") ||
    pathname.startsWith("/report/rpt_") ||
    pathname.startsWith("/report/sample-");

  const isProtectedReport =
    pathname.startsWith("/report/") &&
    !isPublicSample &&
    !pathname.startsWith("/report/analyze") &&
    !pathname.startsWith("/report/share_") && // shared links are public by design
    pathname !== "/report/new";

  if (!REVIEW_MODE && !DEV_OWNER && !user && (isProtected || isProtectedReport)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from auth pages
  const authPaths = ["/login", "/signup", "/forgot-password"];
  if (user && authPaths.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
