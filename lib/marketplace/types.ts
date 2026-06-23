// Renovation Marketplace — data models.
// NOTE: RoiQ has no working DB (dashboard uses mock data, reports persist to
// sessionStorage). To match that convention these are plain TS types backed by an
// in-memory mock store (lib/marketplace/store.ts). A ready-to-use Supabase migration
// mirroring these models lives at supabase/migrations/*_marketplace.sql for when
// real persistence is wired up.

export type Role = "HOMEOWNER" | "TRADESMAN";
export type JobStatus = "DRAFT" | "LIVE" | "CLOSED";
export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

/** A marketplace participant. Extends the app's notion of a user with the fields
 *  the spec asks to add to the existing User model (role/phone/business/nzbn/verified). */
export interface MarketUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  // Tradesman-only
  businessName?: string;
  nzbn?: string;
  tdVerified?: boolean;
  /** Trade-body ids the tradesman holds (drives the qualified-jobs filter). */
  tradeBodies?: string[];
  /** Trade category ids the tradesman works in — they ONLY see jobs in these. */
  categories?: string[];
  /** The tradesman's chosen region — they see jobs in this region. */
  region?: string;
  // Denormalised display helpers (derived from reviews / jobs)
  avgRating?: number;
  reviewCount?: number;
  jobCount?: number;
}

export interface Job {
  id: string;
  homeownerId: string;
  category: string; // category id (see constants.TRADE_CATEGORIES)
  material?: string; // roofing only (material id)
  colour?: string; // roofing / painting (colour id)
  description: string;
  address: string;
  suburb: string;
  region: string; // NZ region — tradesmen see jobs in their chosen region
  photos: string[]; // file/object URLs (data: URLs in the prototype)
  status: JobStatus;
  urgent: boolean;
  createdAt: string; // ISO
}

export interface Quote {
  id: string;
  jobId: string;
  tradesmanId: string;
  amountNZD: number; // whole dollars
  message: string;
  createdAt: string; // ISO
}

export interface Review {
  id: string;
  quoteId: string; // unique — one review per quote
  reviewerId: string;
  rating: number; // 1–5
  comment: string;
  createdAt: string; // ISO
}

export interface TradesmanVerification {
  id: string;
  tradesmanId: string; // unique
  businessRegUrl: string;
  qualificationUrl: string;
  tradeBodies: string[];
  status: VerificationStatus;
  submittedAt: string; // ISO
}

// ── Shapes the API/UI hand around (mock store joins these for convenience) ──────

/** A tradesman's public profile as shown to a homeowner on a quote. */
export interface TradesmanPublic {
  id: string;
  businessName: string;
  tdVerified: boolean;
  avgRating: number;
  reviewCount: number;
  /** Revealed to the homeowner once the tradesman has quoted. */
  email: string;
  phone: string;
}

/** A homeowner's public profile as shown to a tradesman on a job. */
export interface HomeownerPublic {
  id: string;
  name: string;
  avgRating: number;
  jobCount: number;
  /** Masked until the viewing tradesman has submitted a quote. */
  email: string;
  phone: string;
  contactRevealed: boolean;
}

/** A job row as shown in the tradesman listings. */
export interface JobListItem {
  id: string;
  category: string;
  title: string;
  suburb: string;
  region: string;
  descriptionPreview: string;
  photos: string[];
  urgent: boolean;
  createdAt: string;
  quoteCount: number;
  alreadyQuoted: boolean;
}
