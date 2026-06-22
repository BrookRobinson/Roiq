import { redirect } from "next/navigation";
import { currentUser } from "@/lib/marketplace/session";

// Entry point — route to the right side based on the current (mock) view.
export default function MarketplaceIndex() {
  const me = currentUser();
  redirect(me.role === "TRADESMAN" ? "/marketplace/listings" : "/marketplace/jobs");
}
