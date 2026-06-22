// Renovation Marketplace — in-memory mock store (matches RoiQ's prototype data
// convention: no real DB). State is module-level and cached on globalThis so it
// survives Next dev hot-reloads within a running server process. Posted jobs /
// quotes / reviews persist for the session; a server restart re-seeds.

import type {
  MarketUser, Job, Quote, Review, TradesmanVerification,
  JobStatus, TradesmanPublic, HomeownerPublic, JobListItem,
} from "./types";
import { isQualified, jobTitle } from "./constants";

interface MarketDB {
  users: MarketUser[];
  jobs: Job[];
  quotes: Quote[];
  reviews: Review[];
  verifications: TradesmanVerification[];
  seq: number;
}

// ── ids / time ────────────────────────────────────────────────────────────────
function makeId(db: MarketDB, prefix: string): string {
  db.seq += 1;
  return `${prefix}_${db.seq.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

// ── seed ────────────────────────────────────────────────────────────────────--
// Fixed ids for the seeded test accounts so the role switcher can target them.
export const SEED_HOMEOWNER_ID = "u_home";
export const SEED_TRADESMAN_ID = "u_trade"; // the verified "view as tradesman" account

function seed(): MarketDB {
  const db: MarketDB = { users: [], jobs: [], quotes: [], reviews: [], verifications: [], seq: 1000 };

  const users: MarketUser[] = [
    { id: SEED_HOMEOWNER_ID, name: "Sarah Thompson", email: "sarah.thompson@example.co.nz", phone: "021 555 0142", role: "HOMEOWNER", avgRating: 5, reviewCount: 3, jobCount: 0 },
    // The verified test tradesman (multi-trade so several categories are browsable).
    { id: SEED_TRADESMAN_ID, name: "Mike Reardon", email: "mike@canterburyexteriors.co.nz", phone: "027 444 8810", role: "TRADESMAN", businessName: "Canterbury Roofing & Exteriors", nzbn: "9429041234567", tdVerified: true, tradeBodies: ["lbp", "master-builders", "master-painters"], categories: ["roofing", "painting", "decking", "fencing", "windows"], avgRating: 4.8, reviewCount: 24 },
    { id: "u_t2", name: "Dave Patel",  email: "dave@gardencityplumbing.co.nz", phone: "027 222 1190", role: "TRADESMAN", businessName: "Garden City Plumbing & Gas", nzbn: "9429042222111", tdVerified: true, tradeBodies: ["pgdb"], categories: ["plumbing", "bathroom"], avgRating: 4.6, reviewCount: 17 },
    { id: "u_t3", name: "Sam Ngata",   email: "sam@selwynelectrical.co.nz",   phone: "027 333 7740", role: "TRADESMAN", businessName: "Selwyn Electrical", nzbn: "9429043333222", tdVerified: true, tradeBodies: ["ewrb"], categories: ["electrical"], avgRating: 4.9, reviewCount: 31 },
    { id: "u_t4", name: "Anna Wright", email: "anna@avonpainters.co.nz",      phone: "027 888 3320", role: "TRADESMAN", businessName: "Avon Painting Co.", nzbn: "9429044444333", tdVerified: true, tradeBodies: ["master-painters"], categories: ["painting"], avgRating: 4.7, reviewCount: 12 },
    { id: "u_t5", name: "Tom Fisher",  email: "tom@rollestonkitchens.co.nz",  phone: "027 611 2245", role: "TRADESMAN", businessName: "Rolleston Kitchens & Joinery", nzbn: "9429045555444", tdVerified: true, tradeBodies: ["lbp", "nzcb"], categories: ["kitchen"], avgRating: 4.5, reviewCount: 9 },
  ];

  const jobs: Job[] = [
    { id: "j_roof",  homeownerId: SEED_HOMEOWNER_ID, category: "roofing",    material: "colorsteel", colour: "ironsand", description: "Replace the old corrugate roof on a 1960s brick-and-tile home. Some rust around the spouting and a couple of leaks near the chimney. Single storey, ~120m² roof.", address: "12 Kotare Street",   suburb: "Riccarton",  photos: ["https://picsum.photos/seed/roiqroof/1200/800"], status: "LIVE", urgent: true,  createdAt: hoursAgo(3) },
    { id: "j_paint", homeownerId: SEED_HOMEOWNER_ID, category: "painting",   colour: "thunder",  description: "Full exterior repaint of a weatherboard villa. Prep, undercoat and two top coats. Some weatherboard repairs needed on the south side.", address: "8 Holmwood Road",  suburb: "Merivale",   photos: [], status: "LIVE", urgent: false, createdAt: hoursAgo(20) },
    { id: "j_kitchen", homeownerId: SEED_HOMEOWNER_ID, category: "kitchen",  description: "Full kitchen renovation — remove the old kitchen, new cabinetry, benchtop, splashback and appliance install. Approx 14m².", address: "23 Clyde Road",     suburb: "Ilam",       photos: ["https://picsum.photos/seed/roiqkitchen/1200/800"], status: "LIVE", urgent: false, createdAt: hoursAgo(28) },
    { id: "j_bath",  homeownerId: SEED_HOMEOWNER_ID, category: "bathroom",   description: "Bathroom re-fit. Strip back to framing, re-waterproof, new tiling, vanity, toilet and a walk-in shower.", address: "5 Glandovey Road",  suburb: "Fendalton",  photos: [], status: "LIVE", urgent: false, createdAt: hoursAgo(50) },
    { id: "j_plumb", homeownerId: SEED_HOMEOWNER_ID, category: "plumbing",   description: "Replace an old hot water cylinder with a new mains-pressure unit and fix a slow leak under the kitchen sink.", address: "41 Papanui Road",   suburb: "Papanui",    photos: [], status: "LIVE", urgent: true,  createdAt: hoursAgo(6) },
    { id: "j_elec",  homeownerId: SEED_HOMEOWNER_ID, category: "electrical", description: "Switchboard upgrade to RCDs plus add four double sockets and recessed LED lighting through the living area.", address: "17 Wakefield Avenue", suburb: "Sumner",   photos: [], status: "LIVE", urgent: false, createdAt: hoursAgo(72) },
  ];

  const quotes: Quote[] = [
    { id: "q1", jobId: "j_roof",  tradesmanId: SEED_TRADESMAN_ID, amountNZD: 18500, message: "Happy to take this on — we'd strip the old corrugate, replace any rotten purlins, and install new Colorsteel in Ironsand with new spouting. ~5 days, scaffold included.", createdAt: hoursAgo(2) },
    { id: "q2", jobId: "j_kitchen", tradesmanId: "u_t5", amountNZD: 27200, message: "Full strip-out and new kitchen including stone benchtop and appliance install. Lead time ~3 weeks for cabinetry.", createdAt: hoursAgo(22) },
    { id: "q3", jobId: "j_elec",  tradesmanId: "u_t3", amountNZD: 6400,  message: "Switchboard upgrade to a modern RCD board, plus the extra sockets and LED downlights. One day on site, certified on completion.", createdAt: hoursAgo(40) },
  ];

  // A couple of historical reviews so seeded tradesmen show ratings/history.
  const reviews: Review[] = [
    { id: "r1", quoteId: "q_hist1", reviewerId: SEED_HOMEOWNER_ID, rating: 5, comment: "Tidy work, on time, great communication.", createdAt: hoursAgo(800) },
    { id: "r2", quoteId: "q_hist2", reviewerId: SEED_HOMEOWNER_ID, rating: 5, comment: "Excellent — would use again.", createdAt: hoursAgo(1500) },
  ];

  db.users = users;
  db.jobs = jobs;
  db.quotes = quotes;
  db.reviews = reviews;
  // homeowner jobCount = number of jobs they've posted
  const home = db.users.find((u) => u.id === SEED_HOMEOWNER_ID);
  if (home) home.jobCount = db.jobs.filter((j) => j.homeownerId === SEED_HOMEOWNER_ID).length;
  return db;
}

// ── singleton (survives HMR) ────────────────────────────────────────────────---
const g = globalThis as unknown as { __mpStore?: MarketDB };
function db(): MarketDB {
  if (!g.__mpStore) g.__mpStore = seed();
  return g.__mpStore;
}

// ── users ──────────────────────────────────────────────────────────────────---
export const getUser = (id: string): MarketUser | undefined => db().users.find((u) => u.id === id);

export function tradesmanPublic(t: MarketUser, revealContact: boolean): TradesmanPublic {
  return {
    id: t.id,
    businessName: t.businessName ?? t.name,
    tdVerified: !!t.tdVerified,
    avgRating: t.avgRating ?? 0,
    reviewCount: t.reviewCount ?? 0,
    email: revealContact ? t.email : "",
    phone: revealContact ? t.phone : "",
  };
}

export function homeownerPublic(h: MarketUser, revealContact: boolean): HomeownerPublic {
  return {
    id: h.id,
    name: h.name,
    avgRating: h.avgRating ?? 0,
    jobCount: h.jobCount ?? 0,
    email: revealContact ? h.email : "",
    phone: revealContact ? h.phone : "",
    contactRevealed: revealContact,
  };
}

// ── jobs ───────────────────────────────────────────────────────────────────---
export const getJob = (id: string): Job | undefined => db().jobs.find((j) => j.id === id);
export const quotesForJob = (jobId: string): Quote[] => db().quotes.filter((q) => q.jobId === jobId);
export const hasQuoted = (jobId: string, tradesmanId: string): boolean =>
  db().quotes.some((q) => q.jobId === jobId && q.tradesmanId === tradesmanId);

/** LIVE jobs the tradesman is QUALIFIED for, newest first, optionally filtered by category. */
export function jobsForTradesman(tradesman: MarketUser, categoryFilter?: string): JobListItem[] {
  return db().jobs
    .filter((j) => j.status === "LIVE")
    .filter((j) => isQualified(j.category, tradesman.tradeBodies))
    .filter((j) => !categoryFilter || categoryFilter === "all" || j.category === categoryFilter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((j) => toListItem(j, tradesman.id));
}

function toListItem(j: Job, viewerId: string): JobListItem {
  const desc = j.description.trim();
  return {
    id: j.id,
    category: j.category,
    title: jobTitle(j.category, j.description),
    suburb: j.suburb,
    descriptionPreview: desc.length > 90 ? desc.slice(0, 90).trim() + "…" : desc,
    photos: j.photos,
    urgent: j.urgent,
    createdAt: j.createdAt,
    quoteCount: quotesForJob(j.id).length,
    alreadyQuoted: hasQuoted(j.id, viewerId),
  };
}

export interface CreateJobInput {
  category: string;
  material?: string;
  colour?: string;
  description: string;
  address: string;
  suburb: string;
  photos?: string[];
  urgent?: boolean;
  status?: JobStatus; // LIVE (post) or DRAFT (save as draft)
}

export function createJob(homeownerId: string, input: CreateJobInput): Job {
  const d = db();
  const job: Job = {
    id: makeId(d, "j"),
    homeownerId,
    category: input.category,
    material: input.material,
    colour: input.colour,
    description: input.description ?? "",
    address: input.address ?? "",
    suburb: input.suburb ?? deriveSuburb(input.address ?? ""),
    photos: input.photos ?? [],
    status: input.status ?? "LIVE",
    urgent: !!input.urgent,
    createdAt: new Date().toISOString(),
  };
  d.jobs.unshift(job);
  const home = getUser(homeownerId);
  if (home) home.jobCount = d.jobs.filter((j) => j.homeownerId === homeownerId).length;
  return job;
}

// Best-effort suburb from a comma-separated address ("12 X St, Riccarton, Christchurch").
function deriveSuburb(address: string): string {
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[1] ?? parts[0] ?? "";
}

export function setJobStatus(id: string, status: JobStatus): Job | undefined {
  const job = getJob(id);
  if (job) job.status = status;
  return job;
}

export const homeownerJobs = (homeownerId: string): Job[] =>
  db().jobs.filter((j) => j.homeownerId === homeownerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// ── quotes ─────────────────────────────────────────────────────────────────---
export function addQuote(jobId: string, tradesmanId: string, amountNZD: number, message: string): Quote | { error: string } {
  const d = db();
  const job = getJob(jobId);
  if (!job) return { error: "job_not_found" };
  if (hasQuoted(jobId, tradesmanId)) return { error: "already_quoted" };
  const tradesman = getUser(tradesmanId);
  if (!tradesman || tradesman.role !== "TRADESMAN" || !tradesman.tdVerified) return { error: "not_verified" };
  if (!isQualified(job.category, tradesman.tradeBodies)) return { error: "not_qualified" };
  const quote: Quote = { id: makeId(d, "q"), jobId, tradesmanId, amountNZD: Math.round(amountNZD), message, createdAt: new Date().toISOString() };
  d.quotes.push(quote);
  return quote;
}

/** Quotes on a job, joined with the tradesman's public profile (contact visible to the homeowner). */
export function quotesWithTradesman(jobId: string) {
  return quotesForJob(jobId).map((q) => {
    const t = getUser(q.tradesmanId);
    return {
      quote: q,
      tradesman: t ? tradesmanPublic(t, true) : null,
      reviewed: db().reviews.some((r) => r.quoteId === q.id),
    };
  });
}

// ── reviews ────────────────────────────────────────────────────────────────---
export function addReview(quoteId: string, reviewerId: string, rating: number, comment: string): Review | { error: string } {
  const d = db();
  const quote = d.quotes.find((q) => q.id === quoteId);
  if (!quote) return { error: "quote_not_found" };
  if (d.reviews.some((r) => r.quoteId === quoteId)) return { error: "already_reviewed" };
  const review: Review = { id: makeId(d, "r"), quoteId, reviewerId, rating: Math.max(1, Math.min(5, Math.round(rating))), comment, createdAt: new Date().toISOString() };
  d.reviews.push(review);
  // Recompute the tradesman's denormalised rating.
  const t = getUser(quote.tradesmanId);
  if (t) {
    const theirReviews = d.reviews.filter((r) => {
      const rq = d.quotes.find((q) => q.id === r.quoteId);
      return rq?.tradesmanId === t.id;
    });
    if (theirReviews.length) {
      t.reviewCount = (t.reviewCount ?? 0); // historical count preserved
      t.avgRating = Math.round((theirReviews.reduce((s, r) => s + r.rating, 0) / theirReviews.length) * 10) / 10;
    }
  }
  return review;
}

// ── verification ───────────────────────────────────────────────────────────---
export const getVerification = (tradesmanId: string): TradesmanVerification | undefined =>
  db().verifications.find((v) => v.tradesmanId === tradesmanId);

export interface VerifyInput {
  businessName?: string;
  nzbn?: string;
  categories?: string[];
  businessRegUrl: string;
  qualificationUrl: string;
  tradeBodies: string[];
}

export function submitVerification(tradesmanId: string, input: VerifyInput): TradesmanVerification {
  const d = db();
  const existing = getVerification(tradesmanId);
  const v: TradesmanVerification = {
    id: existing?.id ?? makeId(d, "v"),
    tradesmanId,
    businessRegUrl: input.businessRegUrl,
    qualificationUrl: input.qualificationUrl,
    tradeBodies: input.tradeBodies,
    status: "PENDING",
    submittedAt: new Date().toISOString(),
  };
  if (existing) Object.assign(existing, v);
  else d.verifications.push(v);
  // Reflect the submitted details onto the user (stays unverified until approved).
  const t = getUser(tradesmanId);
  if (t) {
    if (input.businessName) t.businessName = input.businessName;
    if (input.nzbn) t.nzbn = input.nzbn;
    if (input.categories) t.categories = input.categories;
    t.tradeBodies = input.tradeBodies;
  }
  return v;
}
