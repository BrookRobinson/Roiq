export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Plan = "free" | "starter" | "pro";
export type ReportStatus = "pending" | "processing" | "complete" | "failed";
export type ListingStatus = "active" | "sold" | "removed";
export type OpportunityGrade = "A+" | "A" | "B+" | "B" | "C+" | "C" | "D";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          plan: Plan;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          preferred_deposit_pct: number;
          preferred_currency: string;
          dark_mode: boolean;
          alert_preferences: Json | null;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          plan?: Plan;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          preferred_deposit_pct?: number;
          preferred_currency?: string;
          dark_mode?: boolean;
          alert_preferences?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      reports: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          listing_url: string | null;
          address: string | null;
          suburb: string | null;
          region: string | null;
          country: string;
          asking_price: number | null;
          floor_area_sqm: number | null;
          land_area_sqm: number | null;
          bedrooms: number | null;
          bathrooms: number | null;
          car_parks: number | null;
          build_year: number | null;
          property_type: string | null;
          title_type: string | null;
          listing_source: string | null;
          quality_score: number | null;
          vfm_grade: string | null;
          category_scores: Json | null;
          photo_analysis: Json | null;
          renovation_items: Json | null;
          healthy_homes: Json | null;
          financial_defaults: Json | null;
          hazard_findings: Json | null;
          comparables: Json | null;
          report_status: ReportStatus;
          is_public: boolean;
          share_token: string | null;
          pdf_url: string | null;
          quick_score_only: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          listing_url?: string | null;
          address?: string | null;
          suburb?: string | null;
          region?: string | null;
          country?: string;
          asking_price?: number | null;
          floor_area_sqm?: number | null;
          land_area_sqm?: number | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          car_parks?: number | null;
          build_year?: number | null;
          property_type?: string | null;
          title_type?: string | null;
          listing_source?: string | null;
          quality_score?: number | null;
          vfm_grade?: string | null;
          category_scores?: Json | null;
          photo_analysis?: Json | null;
          renovation_items?: Json | null;
          healthy_homes?: Json | null;
          financial_defaults?: Json | null;
          hazard_findings?: Json | null;
          comparables?: Json | null;
          report_status?: ReportStatus;
          is_public?: boolean;
          share_token?: string | null;
          pdf_url?: string | null;
          quick_score_only?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
      };
      listing_photos: {
        Row: {
          id: string;
          report_id: string;
          photo_number: number;
          storage_url: string;
          ai_analysis: Json | null;
          confidence_tier: number | null;
          flags: Json | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          photo_number: number;
          storage_url: string;
          ai_analysis?: Json | null;
          confidence_tier?: number | null;
          flags?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["listing_photos"]["Insert"]>;
      };
      market_data: {
        Row: {
          id: string;
          suburb: string;
          region: string;
          country: string;
          avg_value: number | null;
          median_rent_weekly: number | null;
          growth_rate_annual: number | null;
          days_to_sell_median: number | null;
          rental_yield_gross: number | null;
          data_source: string | null;
          last_updated: string;
        };
        Insert: Omit<Database["public"]["Tables"]["market_data"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["market_data"]["Insert"]>;
      };
      map_listings: {
        Row: {
          id: string;
          listing_url: string;
          address: string | null;
          suburb: string | null;
          region: string | null;
          lat: number | null;
          lng: number | null;
          asking_price: number | null;
          bedrooms: number | null;
          bathrooms: number | null;
          property_type: string | null;
          title_type: string | null;
          build_year: number | null;
          quick_quality_score: number | null;
          vfm_grade: string | null;
          gross_yield_est: number | null;
          profit_10yr_est: number | null;
          opportunity_grade: OpportunityGrade | null;
          full_report_id: string | null;
          listing_status: ListingStatus;
          first_seen: string;
          last_seen: string;
          source_portal: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["map_listings"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["map_listings"]["Insert"]>;
      };
      watchlist: {
        Row: {
          id: string;
          user_id: string;
          map_listing_id: string;
          added_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["watchlist"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["watchlist"]["Insert"]>;
      };
      alerts: {
        Row: {
          id: string;
          user_id: string;
          filters: Json;
          last_triggered: string | null;
          is_active: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["alerts"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["alerts"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience row types
export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
export type ListingPhotoRow = Database["public"]["Tables"]["listing_photos"]["Row"];
export type MarketDataRow = Database["public"]["Tables"]["market_data"]["Row"];
export type MapListingRow = Database["public"]["Tables"]["map_listings"]["Row"];
export type WatchlistRow = Database["public"]["Tables"]["watchlist"]["Row"];
export type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
