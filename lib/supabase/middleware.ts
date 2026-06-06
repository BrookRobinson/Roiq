import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

// REVIEW MODE: when true, every page is viewable without logging in so the whole
// app can be clicked through for review. Set to false (or NEXT_PUBLIC_REVIEW_MODE=false)
// to re-enable real auth gating before launch.
const REVIEW_MODE = process.env.NEXT_PUBLIC_REVIEW_MODE !== "false";

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
  const protectedPaths = ["/dashboard", "/report/new", "/account", "/map"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  // Report view routes are also protected (but /report/demo and the live
  // analysis test page are public)
  const isProtectedReport =
    pathname.startsWith("/report/") &&
    !pathname.startsWith("/report/demo") &&
    !pathname.startsWith("/report/analyze") &&
    pathname !== "/report/new";

  if (!REVIEW_MODE && !user && (isProtected || isProtectedReport)) {
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
