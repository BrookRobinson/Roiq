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
          plan_expires_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          preferred_deposit_pct: number;
          preferred_currency: string;
          dark_mode: boolean;
          alert_preferences: Json | null;
          // ── Property Map — saved personal variables (added) ──
          map_budget: number | null;
          map_deposit_amount: number | null;
          map_interest_rate: number | null;
          map_loan_term_years: number | null;
          map_hold_period_years: number | null;
          map_buying_costs: number | null;
          map_building_report: number | null;
          map_agent_commission: number | null;
          map_selling_legal_costs: number | null;
          map_property_mgmt_fee_pct: number | null;
          map_annual_insurance: number | null;
          map_maintenance_pct: number | null;
          map_vacancy_rate_pct: number | null;
          map_capital_growth_pct: number | null;
          map_rental_growth_pct: number | null;
          map_default_mode: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          plan?: Plan;
          plan_expires_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          preferred_deposit_pct?: number;
          preferred_currency?: string;
          dark_mode?: boolean;
          alert_preferences?: Json | null;
          map_budget?: number | null;
          map_deposit_amount?: number | null;
          map_interest_rate?: number | null;
          map_loan_term_years?: number | null;
          map_hold_period_years?: number | null;
          map_buying_costs?: number | null;
          map_building_report?: number | null;
          map_agent_commission?: number | null;
          map_selling_legal_costs?: number | null;
          map_property_mgmt_fee_pct?: number | null;
          map_annual_insurance?: number | null;
          map_maintenance_pct?: number | null;
          map_vacancy_rate_pct?: number | null;
          map_capital_growth_pct?: number | null;
          map_rental_growth_pct?: number | null;
          map_default_mode?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          // Nullable since 20260821_reports_persistence: no signed-in user to
          // attribute a report to yet; owner_key carries ownership meanwhile.
          user_id: string | null;
          owner_key: string | null;
          /** The full StoredReport as generated — the source of truth. */
          report: Json | null;
          photos_analysed: number | null;
          model: string | null;
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
          user_id?: string | null;
          owner_key?: string | null;
          report?: Json | null;
          photos_analysed?: number | null;
          model?: string | null;
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
          source_key: string | null;
          full_report_ref: string | null;
          full_report_id: string | null;
          listing_status: ListingStatus;
          first_seen: string;
          last_seen: string;
          source_portal: string | null;
          // ── Property Map feature (added) ──
          city: string | null;
          floor_area_sqm: number | null;
          land_area_sqm: number | null;
          photos: Json | null;
          description: string | null;
          listing_type: string | null;
          roiq_valuation: number | null;
          valuation_vs_asking_pct: number | null;
          repair_allowance: number | null;
          repair_breakdown: Json | null;
          estimated_weekly_rent: number | null;
          suburb_growth_rate_pct: number | null;
          projected_cashflow: number | null;
          projected_capital_gain: number | null;
          projected_net_profit: number | null;
          five_year_return_pct: number | null;
          home_buyer_colour: string | null;
          investor_colour: string | null;
          last_scored_at: string | null;
          last_checked_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["map_listings"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["map_listings"]["Insert"]>;
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      purchases: {
        Row: {
          id: string;
          user_id: string;
          stripe_session_id: string;
          stripe_payment_intent_id: string | null;
          stripe_customer_id: string | null;
          plan: string;
          amount_cents: number | null;
          currency: string;
          status: string;
          receipt_url: string | null;
          access_from: string;
          access_until: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_session_id: string;
          stripe_payment_intent_id?: string | null;
          stripe_customer_id?: string | null;
          plan: string;
          amount_cents?: number | null;
          currency?: string;
          status?: string;
          receipt_url?: string | null;
          access_from?: string;
          access_until: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchases"]["Insert"]>;
        Relationships: [];
      };
      shared_reports: {
        Row: {
          token: string;
          report: Json;
          address: string | null;
          score: number | null;
          shared_by: string | null;
          recipient: string | null;
          note: string | null;
          view_count: number;
          created_at: string;
        };
        Insert: {
          token: string;
          report: Json;
          address?: string | null;
          score?: number | null;
          shared_by?: string | null;
          recipient?: string | null;
          note?: string | null;
          view_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shared_reports"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_share_view: {
        Args: { p_token: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    // Required by supabase-js's GenericSchema constraint. Without it the schema
    // fails the constraint and EVERY typed query result silently resolves to
    // `never` — which is what the scattered `as never` casts were working around.
    CompositeTypes: Record<string, never>;
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
