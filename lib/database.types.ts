// Database types for Supabase
// These types match the SQL schema and can be regenerated with:
// npx supabase gen types typescript --project-id <project-id> > lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'brand_owner' | 'admin' | 'lawyer'
export type AssetType = 'image' | 'video' | 'text'
export type ScanStatus = 'pending' | 'queued' | 'scanning' | 'success' | 'failed' | 'skipped'
export type PlatformType = 'Meta Ads' | 'Instagram' | 'Shopify' | 'TikTok Shop' | 'Amazon' | 'AliExpress' | 'eBay' | 'Website'
export type InfringementStatus = 'detected' | 'pending_review' | 'in_progress' | 'resolved' | 'rejected'
export type KeywordType = 'active' | 'negative' | 'suggested'
export type TrendType = 'up' | 'down' | 'stable'
export type CaseUpdateType = 'takedown_initiated' | 'platform_contacted' | 'dmca_sent' | 'awaiting_response' | 'follow_up_sent' | 'escalated' | 'content_removed' | 'case_closed' | 'custom'
export type CreatedByType = 'lawyer' | 'system' | 'brand_owner'
export type ActivityType = 'info' | 'warning' | 'success' | 'danger'
export type IPDocumentType = 'Trademark' | 'Copyright' | 'Patent' | 'Other'
export type IPDocumentStatus = 'Active' | 'Pending' | 'Expired'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: UserRole
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
      }
      brands: {
        Row: {
          id: string
          owner_id: string
          name: string
          slug: string
          color: string | null
          website_url: string | null
          logo_url: string | null
          is_trademarked: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          slug: string
          color?: string | null
          website_url?: string | null
          logo_url?: string | null
          is_trademarked?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          slug?: string
          color?: string | null
          website_url?: string | null
          logo_url?: string | null
          is_trademarked?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      assets: {
        Row: {
          id: string
          brand_id: string
          type: AssetType
          name: string
          mime_type: string
          storage_path: string
          is_protected: boolean
          source_url: string | null
          content: string | null
          file_size: number | null
          fingerprint: string | null
          scan_status: ScanStatus
          scan_attempts: number
          last_scanned_at: string | null
          next_scan_at: string | null
          scan_provider: string | null
          last_scan_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          type: AssetType
          name: string
          mime_type: string
          storage_path: string
          is_protected?: boolean
          source_url?: string | null
          content?: string | null
          file_size?: number | null
          fingerprint?: string | null
          scan_status?: ScanStatus
          scan_attempts?: number
          last_scanned_at?: string | null
          next_scan_at?: string | null
          scan_provider?: string | null
          last_scan_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          type?: AssetType
          name?: string
          mime_type?: string
          storage_path?: string
          is_protected?: boolean
          source_url?: string | null
          content?: string | null
          file_size?: number | null
          fingerprint?: string | null
          scan_status?: ScanStatus
          scan_attempts?: number
          last_scanned_at?: string | null
          next_scan_at?: string | null
          scan_provider?: string | null
          last_scan_error?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      infringements: {
        Row: {
          id: string
          brand_id: string
          original_asset_id: string | null
          copycat_image_url: string | null
          similarity_score: number | null
          detection_provider: string | null
          detection_method: string | null
          source_fingerprint: string | null
          platform: PlatformType
          infringing_url: string | null
          seller_name: string | null
          country: string | null
          site_visitors: number
          revenue_lost: number
          whois_registrar: string | null
          whois_creation_date: string | null
          whois_registrant_country: string | null
          hosting_provider: string | null
          hosting_ip_address: string | null
          status: InfringementStatus
          detected_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          original_asset_id?: string | null
          copycat_image_url?: string | null
          similarity_score?: number | null
          detection_provider?: string | null
          detection_method?: string | null
          source_fingerprint?: string | null
          platform: PlatformType
          infringing_url?: string | null
          seller_name?: string | null
          country?: string | null
          site_visitors?: number
          revenue_lost?: number
          whois_registrar?: string | null
          whois_creation_date?: string | null
          whois_registrant_country?: string | null
          hosting_provider?: string | null
          hosting_ip_address?: string | null
          status?: InfringementStatus
          detected_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          original_asset_id?: string | null
          copycat_image_url?: string | null
          similarity_score?: number | null
          detection_provider?: string | null
          detection_method?: string | null
          source_fingerprint?: string | null
          platform?: PlatformType
          infringing_url?: string | null
          seller_name?: string | null
          country?: string | null
          site_visitors?: number
          revenue_lost?: number
          whois_registrar?: string | null
          whois_creation_date?: string | null
          whois_registrant_country?: string | null
          hosting_provider?: string | null
          hosting_ip_address?: string | null
          status?: InfringementStatus
          detected_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      scan_events: {
        Row: {
          id: string
          brand_id: string
          asset_id: string | null
          provider: string
          status: 'queued' | 'success' | 'failed' | 'skipped'
          started_at: string
          finished_at: string | null
          matches_found: number
          duplicates_skipped: number
          invalid_results: number
          failed_results: number
          estimated_cost_usd: number | null
          error_message: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          asset_id?: string | null
          provider: string
          status: 'queued' | 'success' | 'failed' | 'skipped'
          started_at?: string
          finished_at?: string | null
          matches_found?: number
          duplicates_skipped?: number
          invalid_results?: number
          failed_results?: number
          estimated_cost_usd?: number | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          asset_id?: string | null
          provider?: string
          status?: 'queued' | 'success' | 'failed' | 'skipped'
          started_at?: string
          finished_at?: string | null
          matches_found?: number
          duplicates_skipped?: number
          invalid_results?: number
          failed_results?: number
          estimated_cost_usd?: number | null
          error_message?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      scan_settings: {
        Row: {
          brand_id: string
          max_scans_per_day: number
          max_spend_usd_per_day: number
          max_parallel_scans: number
          high_risk_interval_hours: number
          medium_risk_interval_hours: number
          low_risk_interval_hours: number
          stale_interval_hours: number
          retry_delay_hours: number
          google_vision_estimated_cost_usd: number
          serpapi_estimated_cost_usd: number
          created_at: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          max_scans_per_day?: number
          max_spend_usd_per_day?: number
          max_parallel_scans?: number
          high_risk_interval_hours?: number
          medium_risk_interval_hours?: number
          low_risk_interval_hours?: number
          stale_interval_hours?: number
          retry_delay_hours?: number
          google_vision_estimated_cost_usd?: number
          serpapi_estimated_cost_usd?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          max_scans_per_day?: number
          max_spend_usd_per_day?: number
          max_parallel_scans?: number
          high_risk_interval_hours?: number
          medium_risk_interval_hours?: number
          low_risk_interval_hours?: number
          stale_interval_hours?: number
          retry_delay_hours?: number
          google_vision_estimated_cost_usd?: number
          serpapi_estimated_cost_usd?: number
          created_at?: string
          updated_at?: string
        }
      }
      scan_budget_daily: {
        Row: {
          brand_id: string
          budget_date: string
          scans_executed: number
          spend_usd: number
          created_at: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          budget_date: string
          scans_executed?: number
          spend_usd?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          budget_date?: string
          scans_executed?: number
          spend_usd?: number
          created_at?: string
          updated_at?: string
        }
      }
      takedown_requests: {
        Row: {
          id: string
          infringement_id: string
          status: InfringementStatus
          admin_notes: string | null
          requested_at: string
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          infringement_id: string
          status?: InfringementStatus
          admin_notes?: string | null
          requested_at?: string
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          infringement_id?: string
          status?: InfringementStatus
          admin_notes?: string | null
          requested_at?: string
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      case_updates: {
        Row: {
          id: string
          takedown_id: string
          update_type: CaseUpdateType
          message: string
          created_by: CreatedByType
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          takedown_id: string
          update_type: CaseUpdateType
          message: string
          created_by: CreatedByType
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          takedown_id?: string
          update_type?: CaseUpdateType
          message?: string
          created_by?: CreatedByType
          is_read?: boolean
          created_at?: string
        }
      }
      keywords: {
        Row: {
          id: string
          brand_id: string
          text: string
          tags: string[]
          type: KeywordType
          matches_count: number
          trend: TrendType | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          text: string
          tags?: string[]
          type: KeywordType
          matches_count?: number
          trend?: TrendType | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          text?: string
          tags?: string[]
          type?: KeywordType
          matches_count?: number
          trend?: TrendType | null
          created_at?: string
          updated_at?: string
        }
      }
      whitelist: {
        Row: {
          id: string
          brand_id: string
          name: string
          domain: string
          platform: string | null
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          name: string
          domain: string
          platform?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          name?: string
          domain?: string
          platform?: string | null
          created_at?: string
        }
      }
      ip_documents: {
        Row: {
          id: string
          brand_id: string
          name: string
          doc_type: IPDocumentType
          registration_number: string | null
          status: IPDocumentStatus
          expiry_date: string | null
          storage_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          name: string
          doc_type: IPDocumentType
          registration_number?: string | null
          status?: IPDocumentStatus
          expiry_date?: string | null
          storage_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          name?: string
          doc_type?: IPDocumentType
          registration_number?: string | null
          status?: IPDocumentStatus
          expiry_date?: string | null
          storage_path?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          brand_id: string | null
          action: string
          target: string
          log_type: ActivityType
          icon: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          brand_id?: string | null
          action: string
          target: string
          log_type: ActivityType
          icon?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          brand_id?: string | null
          action?: string
          target?: string
          log_type?: ActivityType
          icon?: string | null
          metadata?: Json
          created_at?: string
        }
      }
      api_configs: {
        Row: {
          id: string
          user_id: string
          vision_api_key_encrypted: string | null
          is_vision_configured: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          vision_api_key_encrypted?: string | null
          is_vision_configured?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          vision_api_key_encrypted?: string | null
          is_vision_configured?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_due_asset_scans: {
        Args: {
          p_brand_id: string
          p_limit?: number
        }
        Returns: {
          id: string
          brand_id: string
          name: string
          storage_path: string
          fingerprint: string | null
          scan_provider: string | null
          scan_attempts: number
        }[]
      }
      record_scan_budget_usage: {
        Args: {
          p_brand_id: string
          p_budget_date?: string
          p_scan_increment?: number
          p_spend_increment?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      user_role: UserRole
      asset_type: AssetType
      platform_type: PlatformType
      infringement_status: InfringementStatus
      keyword_type: KeywordType
      trend_type: TrendType
      case_update_type: CaseUpdateType
      created_by_type: CreatedByType
      activity_type: ActivityType
      ip_document_type: IPDocumentType
      ip_document_status: IPDocumentStatus
    }
  }
}

// Helper types for easier use
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Brand = Database['public']['Tables']['brands']['Row']
export type Asset = Database['public']['Tables']['assets']['Row']
export type Infringement = Database['public']['Tables']['infringements']['Row']
export type ScanEvent = Database['public']['Tables']['scan_events']['Row']
export type ScanSettings = Database['public']['Tables']['scan_settings']['Row']
export type ScanBudgetDaily = Database['public']['Tables']['scan_budget_daily']['Row']
export type TakedownRequest = Database['public']['Tables']['takedown_requests']['Row']
export type CaseUpdate = Database['public']['Tables']['case_updates']['Row']
export type Keyword = Database['public']['Tables']['keywords']['Row']
export type Whitelist = Database['public']['Tables']['whitelist']['Row']
export type IPDocument = Database['public']['Tables']['ip_documents']['Row']
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row']
export type ApiConfig = Database['public']['Tables']['api_configs']['Row']

// Insert types
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type BrandInsert = Database['public']['Tables']['brands']['Insert']
export type AssetInsert = Database['public']['Tables']['assets']['Insert']
export type InfringementInsert = Database['public']['Tables']['infringements']['Insert']
export type ScanEventInsert = Database['public']['Tables']['scan_events']['Insert']
export type ScanSettingsInsert = Database['public']['Tables']['scan_settings']['Insert']
export type ScanBudgetDailyInsert = Database['public']['Tables']['scan_budget_daily']['Insert']
export type TakedownRequestInsert = Database['public']['Tables']['takedown_requests']['Insert']
export type CaseUpdateInsert = Database['public']['Tables']['case_updates']['Insert']
export type KeywordInsert = Database['public']['Tables']['keywords']['Insert']
export type WhitelistInsert = Database['public']['Tables']['whitelist']['Insert']
export type IPDocumentInsert = Database['public']['Tables']['ip_documents']['Insert']
export type ActivityLogInsert = Database['public']['Tables']['activity_logs']['Insert']
