// ============================================================
// Property Map — pins contributed by reports users have run.
//
// SERVER ONLY. Supabase `map_listings` is the real home for these, but it is
// currently unreachable, and a feature that only works once the database comes
// back is a feature nobody can try. So writes go to Supabase when it answers and
// to a local JSON file either way, and reads merge the two.
//
// The file is a DEV convenience, not a database: a serverless filesystem is
// read-only and per-instance, so on a deploy the write quietly fails and
// Supabase carries the feature. An in-memory mirror is the working copy, so a
// read-only disk costs persistence across restarts, not the feature itself.
//
// This module owns the LOCAL copy only. The Supabase write lives with the route
// that calls it — `store.ts` reads these pins, so importing it back here would
// make a cycle.
// ============================================================

import { promises as fs } from "fs";
import path from "path";

import type { MapListing } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "map-user-listings.json");

/** Cached across hot reloads so a dev edit doesn't drop the pins. */
const globalStore = globalThis as unknown as { __bdrUserListings?: Map<string, MapListing> };
let loaded = false;

function memory(): Map<string, MapListing> {
  if (!globalStore.__bdrUserListings) globalStore.__bdrUserListings = new Map();
  return globalStore.__bdrUserListings;
}

async function hydrate(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const rows = JSON.parse(raw) as MapListing[];
    if (Array.isArray(rows)) for (const r of rows) if (r?.id) memory().set(r.id, r);
  } catch {
    /* no file yet, or unreadable — start empty */
  }
}

async function persist(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify([...memory().values()], null, 2), "utf8");
  } catch {
    /* read-only filesystem (a deploy) — the in-memory copy still serves this instance */
  }
}

/**
 * Add (or replace) a contributed pin. Keyed by the caller's id, so re-running a
 * report on the same property updates its pin rather than stacking duplicates.
 *
 * A pin with no coordinates would sit at (0,0) in the Gulf of Guinea, so a
 * failed geocode is rejected rather than mapped somewhere wrong.
 */
export async function addUserListing(listing: MapListing): Promise<{ stored: boolean; reason?: string }> {
  if (!listing.lat || !listing.lng) {
    return { stored: false, reason: "no_coordinates" };
  }

  await hydrate();
  memory().set(listing.id, listing);
  await persist();
  return { stored: true };
}

/** Every contributed pin, newest state first. */
export async function getUserListings(): Promise<MapListing[]> {
  await hydrate();
  return [...memory().values()];
}

export async function getUserListingById(id: string): Promise<MapListing | null> {
  await hydrate();
  return memory().get(id) ?? null;
}

export async function countUserListings(): Promise<number> {
  await hydrate();
  return memory().size;
}
