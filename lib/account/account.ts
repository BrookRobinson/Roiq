// Lightweight prototype account. BDR Report has no working auth in the running app
// (REVIEW_MODE bypasses Supabase login + the dashboard uses a mock user), so to
// gate "post a job" and "get a report" behind sign-up we store a free account
// locally (localStorage + a cookie mirror). No card details — the free tier covers
// posting jobs and up to 3 reports/month. Swap for real Supabase auth later.

export interface Account {
  name: string;
  email: string;
  createdAt: string;
}

const KEY = "roiq:account";

export function getAccount(): Account | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

export function saveAccount(name: string, email: string): Account {
  const account: Account = { name: name.trim(), email: email.trim(), createdAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(account));
    document.cookie = `roiq_acct=${encodeURIComponent(account.email)}; path=/; max-age=31536000`;
  } catch {
    /* storage unavailable */
  }
  return account;
}

export function clearAccount(): void {
  try {
    window.localStorage.removeItem(KEY);
    document.cookie = "roiq_acct=; path=/; max-age=0";
  } catch {
    /* noop */
  }
}

export function isSignedIn(): boolean {
  return getAccount() !== null;
}
