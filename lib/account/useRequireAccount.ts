"use client";

// Gate hook — call at the top of a page/action that requires a free account.
// Returns true once a signed-in account is confirmed; otherwise redirects to the
// "Create your free account" screen with a return path. The check runs client-side
// (localStorage isn't available during SSR).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isSignedIn } from "./account";

export function useRequireAccount(next: string): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isSignedIn()) setReady(true);
    else router.replace(`/join?next=${encodeURIComponent(next)}`);
  }, [next, router]);

  return ready;
}
