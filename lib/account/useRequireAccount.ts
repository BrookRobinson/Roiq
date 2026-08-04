"use client";

// Gate hook — call at the top of a page/action that requires a free account.
// Returns true once a signed-in account is confirmed; otherwise redirects to the
// "Create your free account" screen with a return path. The check runs client-side
// (localStorage isn't available during SSR).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSignedIn } from "./account";

// Same flag the Supabase middleware uses to let the app be clicked through for
// review — on by default, off only when NEXT_PUBLIC_REVIEW_MODE="false". When on,
// the free-account gate is skipped too, so testing doesn't require a sign-up.
const REVIEW_MODE = process.env.NEXT_PUBLIC_REVIEW_MODE !== "false";

export function useRequireAccount(next: string): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (REVIEW_MODE || isSignedIn()) setReady(true);
    else router.replace(`/join?next=${encodeURIComponent(next)}`);
  }, [next, router]);

  return ready;
}
