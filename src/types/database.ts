/**
 * Types TypeScript générés depuis le schéma Postgres Supabase (source de vérité DB).
 *
 * Fichier AUTO-GÉNÉRÉ (`supabase gen types typescript`) — ne pas éditer à la main :
 * toute modification est écrasée à la prochaine régénération. Expose `Database`
 * (Tables / Views / Functions / Enums du schéma `public`) consommé par le client typé.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: string
          agency_id: string | null
          category: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          object_label: string | null
          severity: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind?: string
          agency_id?: string | null
          category?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          object_label?: string | null
          severity?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: string
          agency_id?: string | null
          category?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          object_label?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_agency_notes: {
        Row: {
          agency_id: string
          note: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          note: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          note?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_agency_notes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_changelog: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          published: boolean
          published_at: string | null
          scheduled_for: string | null
          status: string
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          published?: boolean
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          id?: string
          published?: boolean
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_changelog_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_feature_flags: {
        Row: {
          created_at: string
          description: string
          enabled_agencies: string[]
          enabled_globally: boolean
          enabled_plans: string[]
          id: string
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          enabled_agencies?: string[]
          enabled_globally?: boolean
          enabled_plans?: string[]
          id?: string
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          enabled_agencies?: string[]
          enabled_globally?: boolean
          enabled_plans?: string[]
          id?: string
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_log: {
        Row: {
          action: string
          action_params: Json
          actor_label: string
          actor_user_id: string | null
          agency_id: string | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          family: string
          hash: string
          id: string
          ip: unknown
          metadata: Json
          payload_version: number
          prev_hash: string
          routine: boolean
          seq: number
          session_id: string | null
          severity: string
          ts: string
          user_agent: string | null
        }
        Insert: {
          action: string
          action_params?: Json
          actor_label: string
          actor_user_id?: string | null
          agency_id?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          family: string
          hash: string
          id?: string
          ip?: unknown
          metadata?: Json
          payload_version?: number
          prev_hash: string
          routine?: boolean
          seq: number
          session_id?: string | null
          severity: string
          ts?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          action_params?: Json
          actor_label?: string
          actor_user_id?: string | null
          agency_id?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          family?: string
          hash?: string
          id?: string
          ip?: unknown
          metadata?: Json
          payload_version?: number
          prev_hash?: string
          routine?: boolean
          seq?: number
          session_id?: string | null
          severity?: string
          ts?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_log_family_fkey"
            columns: ["family"]
            isOneToOne: false
            referencedRelation: "admin_log_family"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "admin_log_severity_fkey"
            columns: ["severity"]
            isOneToOne: false
            referencedRelation: "admin_log_severity"
            referencedColumns: ["code"]
          },
        ]
      }
      admin_log_chain_head: {
        Row: {
          head_hash: string
          last_event_ts: string | null
          one: boolean
          rows_count: number
          seq_max: number
          updated_at: string
        }
        Insert: {
          head_hash: string
          last_event_ts?: string | null
          one?: boolean
          rows_count?: number
          seq_max?: number
          updated_at?: string
        }
        Update: {
          head_hash?: string
          last_event_ts?: string | null
          one?: boolean
          rows_count?: number
          seq_max?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_log_family: {
        Row: {
          code: string
          label_key: string
        }
        Insert: {
          code: string
          label_key: string
        }
        Update: {
          code?: string
          label_key?: string
        }
        Relationships: []
      }
      admin_log_severity: {
        Row: {
          code: string
        }
        Insert: {
          code: string
        }
        Update: {
          code?: string
        }
        Relationships: []
      }
      admin_nps_responses: {
        Row: {
          agency_id: string | null
          comment: string
          id: string
          rating: number
          role: string | null
          submitted_at: string
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          agency_id?: string | null
          comment?: string
          id?: string
          rating: number
          role?: string | null
          submitted_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          agency_id?: string | null
          comment?: string
          id?: string
          rating?: number
          role?: string | null
          submitted_at?: string
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_nps_responses_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_nps_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          about_short: string | null
          address: string | null
          billing: string | null
          business_registration_number: string | null
          canton: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          founded_year: number | null
          id: string
          identity_submitted_at: string | null
          legal_form: string | null
          legal_form_id: string | null
          legal_name: string | null
          logo_url: string | null
          monthly_target: number | null
          name: string
          phone: string | null
          plan: string
          postal_code: string | null
          quarterly_target: number | null
          slug: string
          solo: boolean | null
          status: string | null
          stripe_customer_id: string | null
          trade_name: string | null
          tva: string | null
          verification_score: number | null
          verification_status: string
          verification_sweep_attempts: number
          verified_at: string | null
          website: string | null
          yearly_target: number | null
        }
        Insert: {
          about_short?: string | null
          address?: string | null
          billing?: string | null
          business_registration_number?: string | null
          canton?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          founded_year?: number | null
          id?: string
          identity_submitted_at?: string | null
          legal_form?: string | null
          legal_form_id?: string | null
          legal_name?: string | null
          logo_url?: string | null
          monthly_target?: number | null
          name: string
          phone?: string | null
          plan?: string
          postal_code?: string | null
          quarterly_target?: number | null
          slug: string
          solo?: boolean | null
          status?: string | null
          stripe_customer_id?: string | null
          trade_name?: string | null
          tva?: string | null
          verification_score?: number | null
          verification_status?: string
          verification_sweep_attempts?: number
          verified_at?: string | null
          website?: string | null
          yearly_target?: number | null
        }
        Update: {
          about_short?: string | null
          address?: string | null
          billing?: string | null
          business_registration_number?: string | null
          canton?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          founded_year?: number | null
          id?: string
          identity_submitted_at?: string | null
          legal_form?: string | null
          legal_form_id?: string | null
          legal_name?: string | null
          logo_url?: string | null
          monthly_target?: number | null
          name?: string
          phone?: string | null
          plan?: string
          postal_code?: string | null
          quarterly_target?: number | null
          slug?: string
          solo?: boolean | null
          status?: string | null
          stripe_customer_id?: string | null
          trade_name?: string | null
          tva?: string | null
          verification_score?: number | null
          verification_status?: string
          verification_sweep_attempts?: number
          verified_at?: string | null
          website?: string | null
          yearly_target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agencies_legal_form_id_fkey"
            columns: ["legal_form_id"]
            isOneToOne: false
            referencedRelation: "legal_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_activation: {
        Row: {
          agency_id: string
          computed_at: string
          first_contact_at: string | null
          first_deal_at: string | null
          first_kyc_at: string | null
          first_match_at: string | null
          first_property_at: string | null
          last_activity_at: string | null
          score: number
          signed_up_at: string | null
          status: string
        }
        Insert: {
          agency_id: string
          computed_at?: string
          first_contact_at?: string | null
          first_deal_at?: string | null
          first_kyc_at?: string | null
          first_match_at?: string | null
          first_property_at?: string | null
          last_activity_at?: string | null
          score?: number
          signed_up_at?: string | null
          status?: string
        }
        Update: {
          agency_id?: string
          computed_at?: string
          first_contact_at?: string | null
          first_deal_at?: string | null
          first_kyc_at?: string | null
          first_match_at?: string | null
          first_property_at?: string | null
          last_activity_at?: string | null
          score?: number
          signed_up_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_activation_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_id_document_purges: {
        Row: {
          agency_id: string | null
          id: string
          purge_reason: string
          purged_at: string
          related_person_id: string | null
          storage_path: string
          uploaded_at: string | null
        }
        Insert: {
          agency_id?: string | null
          id?: string
          purge_reason: string
          purged_at?: string
          related_person_id?: string | null
          storage_path: string
          uploaded_at?: string | null
        }
        Update: {
          agency_id?: string | null
          id?: string
          purge_reason?: string
          purged_at?: string
          related_person_id?: string | null
          storage_path?: string
          uploaded_at?: string | null
        }
        Relationships: []
      }
      agency_person_roles: {
        Row: {
          created_at: string
          id: string
          ownership_pct: number | null
          pep_self_declared: boolean
          related_person_id: string
          role: string
          signature_power: string | null
          source: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ownership_pct?: number | null
          pep_self_declared?: boolean
          related_person_id: string
          role: string
          signature_power?: string | null
          source?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ownership_pct?: number | null
          pep_self_declared?: boolean
          related_person_id?: string
          role?: string
          signature_power?: string | null
          source?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_person_roles_related_person_id_fkey"
            columns: ["related_person_id"]
            isOneToOne: false
            referencedRelation: "agency_related_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_person_verification_checks: {
        Row: {
          check_type: string
          checked_at: string
          id: string
          raw_response: Json | null
          related_person_id: string
          result: string
          source: string
        }
        Insert: {
          check_type: string
          checked_at?: string
          id?: string
          raw_response?: Json | null
          related_person_id: string
          result: string
          source: string
        }
        Update: {
          check_type?: string
          checked_at?: string
          id?: string
          raw_response?: Json | null
          related_person_id?: string
          result?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_person_verification_checks_check_type_fkey"
            columns: ["check_type"]
            isOneToOne: false
            referencedRelation: "verification_check_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "agency_person_verification_checks_related_person_id_fkey"
            columns: ["related_person_id"]
            isOneToOne: false
            referencedRelation: "agency_related_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_profiles: {
        Row: {
          active_listings_count: number | null
          address: string | null
          agency_id: string | null
          agent_count: number | null
          canton: string | null
          certifications: string[] | null
          city: string | null
          claim_token: string | null
          claimed_at: string | null
          created_at: string | null
          description: string | null
          email: string | null
          enriched_at: string | null
          founded_year: number | null
          id: string
          languages: string[] | null
          logo_url: string | null
          lookmove_agency_id: number | null
          name: string
          phone: string | null
          rating_avg: number | null
          rating_count: number | null
          slug: string
          source: string | null
          source_id: string | null
          specialties: string[] | null
          status: string
          uid_che: string | null
          updated_at: string | null
          verified_at: string | null
          website_url: string | null
          zones_covered: string[] | null
        }
        Insert: {
          active_listings_count?: number | null
          address?: string | null
          agency_id?: string | null
          agent_count?: number | null
          canton?: string | null
          certifications?: string[] | null
          city?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          enriched_at?: string | null
          founded_year?: number | null
          id?: string
          languages?: string[] | null
          logo_url?: string | null
          lookmove_agency_id?: number | null
          name: string
          phone?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          slug: string
          source?: string | null
          source_id?: string | null
          specialties?: string[] | null
          status?: string
          uid_che?: string | null
          updated_at?: string | null
          verified_at?: string | null
          website_url?: string | null
          zones_covered?: string[] | null
        }
        Update: {
          active_listings_count?: number | null
          address?: string | null
          agency_id?: string | null
          agent_count?: number | null
          canton?: string | null
          certifications?: string[] | null
          city?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          enriched_at?: string | null
          founded_year?: number | null
          id?: string
          languages?: string[] | null
          logo_url?: string | null
          lookmove_agency_id?: number | null
          name?: string
          phone?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          slug?: string
          source?: string | null
          source_id?: string | null
          specialties?: string[] | null
          status?: string
          uid_che?: string | null
          updated_at?: string | null
          verified_at?: string | null
          website_url?: string | null
          zones_covered?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_related_persons: {
        Row: {
          agency_id: string
          agency_role: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string
          id: string
          id_document_expires_on: string | null
          id_document_number: string | null
          id_document_read: Json | null
          id_document_type: string | null
          identity_verification_error_code: string | null
          identity_verification_session_id: string | null
          identity_verification_status: string | null
          identity_verified_at: string | null
          last_name: string
          nationality: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          agency_role?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name: string
          id?: string
          id_document_expires_on?: string | null
          id_document_number?: string | null
          id_document_read?: Json | null
          id_document_type?: string | null
          identity_verification_error_code?: string | null
          identity_verification_session_id?: string | null
          identity_verification_status?: string | null
          identity_verified_at?: string | null
          last_name: string
          nationality?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          agency_role?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string
          id?: string
          id_document_expires_on?: string | null
          id_document_number?: string | null
          id_document_read?: Json | null
          id_document_type?: string | null
          identity_verification_error_code?: string | null
          identity_verification_session_id?: string | null
          identity_verification_status?: string | null
          identity_verified_at?: string | null
          last_name?: string
          nationality?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_related_persons_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_related_persons_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_syndication_config: {
        Row: {
          agency_id: string
          created_at: string
          ftp_host: string | null
          ftp_port: number
          ftp_remote_dir: string
          ftp_remote_filename: string
          ftp_secure: boolean
          ftp_username: string | null
          idx_enabled: boolean
          idx_feed_token: string | null
          idx_sender_id: string
          transport: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          ftp_host?: string | null
          ftp_port?: number
          ftp_remote_dir?: string
          ftp_remote_filename?: string
          ftp_secure?: boolean
          ftp_username?: string | null
          idx_enabled?: boolean
          idx_feed_token?: string | null
          idx_sender_id?: string
          transport?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          ftp_host?: string | null
          ftp_port?: number
          ftp_remote_dir?: string
          ftp_remote_filename?: string
          ftp_secure?: boolean
          ftp_username?: string | null
          idx_enabled?: boolean
          idx_feed_token?: string | null
          idx_sender_id?: string
          transport?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_syndication_config_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_usage_quotas: {
        Row: {
          active_properties_cap: number | null
          agency_id: string
          ai_monthly_cost_cap_usd: number | null
          alert_threshold_pct: number
          note: string | null
          storage_cap_mb: number | null
          updated_at: string
          updated_by: string | null
          whatsapp_monthly_cap: number | null
        }
        Insert: {
          active_properties_cap?: number | null
          agency_id: string
          ai_monthly_cost_cap_usd?: number | null
          alert_threshold_pct?: number
          note?: string | null
          storage_cap_mb?: number | null
          updated_at?: string
          updated_by?: string | null
          whatsapp_monthly_cap?: number | null
        }
        Update: {
          active_properties_cap?: number | null
          agency_id?: string
          ai_monthly_cost_cap_usd?: number | null
          alert_threshold_pct?: number
          note?: string | null
          storage_cap_mb?: number | null
          updated_at?: string
          updated_by?: string | null
          whatsapp_monthly_cap?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_usage_quotas_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_verification_checks: {
        Row: {
          agency_id: string
          check_type: string
          checked_at: string
          id: string
          raw_response: Json | null
          result: string
          source: string
        }
        Insert: {
          agency_id: string
          check_type: string
          checked_at?: string
          id?: string
          raw_response?: Json | null
          result: string
          source: string
        }
        Update: {
          agency_id?: string
          check_type?: string
          checked_at?: string
          id?: string
          raw_response?: Json | null
          result?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_verification_checks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_verification_checks_check_type_fkey"
            columns: ["check_type"]
            isOneToOne: false
            referencedRelation: "verification_check_types"
            referencedColumns: ["code"]
          },
        ]
      }
      agency_wa_numbers: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          label: string | null
          wa_number: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          label?: string | null
          wa_number: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          label?: string | null
          wa_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_wa_numbers_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_ai_profiles: {
        Row: {
          agency_id: string | null
          agent_id: string
          brief: Json
          generated_at: string
          hot_contact_at: string | null
          hot_contact_id: string | null
          learned_style: Json | null
          model: string | null
          preferences: Json
          source_answers: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          agent_id: string
          brief?: Json
          generated_at?: string
          hot_contact_at?: string | null
          hot_contact_id?: string | null
          learned_style?: Json | null
          model?: string | null
          preferences?: Json
          source_answers?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          agent_id?: string
          brief?: Json
          generated_at?: string
          hot_contact_at?: string | null
          hot_contact_id?: string | null
          learned_style?: Json | null
          model?: string | null
          preferences?: Json
          source_answers?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_ai_profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_ai_profiles_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_ai_profiles_hot_contact_id_fkey"
            columns: ["hot_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_booking_settings: {
        Row: {
          agency_id: string
          agent_id: string
          buffer_minutes: number
          created_at: string
          default_mode: string
          is_open: boolean
          location_label: string | null
          max_advance_days: number
          min_notice_hours: number
          slot_minutes: number
          timezone: string
          updated_at: string
          weekly_hours: Json
        }
        Insert: {
          agency_id: string
          agent_id: string
          buffer_minutes?: number
          created_at?: string
          default_mode?: string
          is_open?: boolean
          location_label?: string | null
          max_advance_days?: number
          min_notice_hours?: number
          slot_minutes?: number
          timezone?: string
          updated_at?: string
          weekly_hours?: Json
        }
        Update: {
          agency_id?: string
          agent_id?: string
          buffer_minutes?: number
          created_at?: string
          default_mode?: string
          is_open?: boolean
          location_label?: string | null
          max_advance_days?: number
          min_notice_hours?: number
          slot_minutes?: number
          timezone?: string
          updated_at?: string
          weekly_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "agent_booking_settings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_booking_settings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_presence: {
        Row: {
          agent_id: string
          last_seen_at: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          last_seen_at?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          last_seen_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_profiles: {
        Row: {
          agency_profile_id: string | null
          bio: string | null
          canton: string | null
          certifications: string[] | null
          city: string | null
          claim_token: string | null
          claimed_at: string | null
          created_at: string | null
          email: string | null
          experience_years: number | null
          first_name: string
          id: string
          languages: string[] | null
          last_name: string
          linkedin_url: string | null
          meta_description: string | null
          meta_title: string | null
          phone: string | null
          photo_url: string | null
          profile_id: string | null
          rating_avg: number | null
          rating_count: number | null
          slug: string
          source: string | null
          source_id: string | null
          specialties: string[] | null
          stats_avg_days_to_sell: number | null
          stats_avg_price: number | null
          stats_properties_sold: number | null
          stats_response_rate: number | null
          stats_updated_at: string | null
          status: string
          updated_at: string | null
          verified_at: string | null
          website_url: string | null
        }
        Insert: {
          agency_profile_id?: string | null
          bio?: string | null
          canton?: string | null
          certifications?: string[] | null
          city?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string | null
          email?: string | null
          experience_years?: number | null
          first_name: string
          id?: string
          languages?: string[] | null
          last_name: string
          linkedin_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_id?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          slug: string
          source?: string | null
          source_id?: string | null
          specialties?: string[] | null
          stats_avg_days_to_sell?: number | null
          stats_avg_price?: number | null
          stats_properties_sold?: number | null
          stats_response_rate?: number | null
          stats_updated_at?: string | null
          status?: string
          updated_at?: string | null
          verified_at?: string | null
          website_url?: string | null
        }
        Update: {
          agency_profile_id?: string | null
          bio?: string | null
          canton?: string | null
          certifications?: string[] | null
          city?: string | null
          claim_token?: string | null
          claimed_at?: string | null
          created_at?: string | null
          email?: string | null
          experience_years?: number | null
          first_name?: string
          id?: string
          languages?: string[] | null
          last_name?: string
          linkedin_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_id?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          slug?: string
          source?: string | null
          source_id?: string | null
          specialties?: string[] | null
          stats_avg_days_to_sell?: number | null
          stats_avg_price?: number | null
          stats_properties_sold?: number | null
          stats_response_rate?: number | null
          stats_updated_at?: string | null
          status?: string
          updated_at?: string | null
          verified_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_profiles_agency_profile_id_fkey"
            columns: ["agency_profile_id"]
            isOneToOne: false
            referencedRelation: "agency_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_time_off: {
        Row: {
          agency_id: string
          agent_id: string
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          agency_id: string
          agent_id: string
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          agency_id?: string
          agent_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_time_off_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_time_off_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_balance_snapshots: {
        Row: {
          captured_at: string
          granted_balance_usd: number | null
          id: string
          provider: string
          topped_up_balance_usd: number | null
          total_balance_usd: number | null
        }
        Insert: {
          captured_at?: string
          granted_balance_usd?: number | null
          id?: string
          provider: string
          topped_up_balance_usd?: number | null
          total_balance_usd?: number | null
        }
        Update: {
          captured_at?: string
          granted_balance_usd?: number | null
          id?: string
          provider?: string
          topped_up_balance_usd?: number | null
          total_balance_usd?: number | null
        }
        Relationships: []
      }
      ai_copilot_conversations: {
        Row: {
          agency_id: string
          archived: boolean
          created_at: string
          id: string
          last_message_at: string
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          archived?: boolean
          created_at?: string
          id?: string
          last_message_at?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          archived?: boolean
          created_at?: string
          id?: string
          last_message_at?: string
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_copilot_conversations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_drift_dismissals: {
        Row: {
          dismissed_by: string | null
          drift_key: string
          month: string
          ts: string
        }
        Insert: {
          dismissed_by?: string | null
          drift_key: string
          month: string
          ts?: string
        }
        Update: {
          dismissed_by?: string | null
          drift_key?: string
          month?: string
          ts?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          agency_id: string | null
          created_at: string
          edge_function: string
          estimated_cost_usd: number
          id: string
          input_tokens: number
          latency_ms: number | null
          module: string | null
          output_tokens: number
          provider: string
          was_fallback: boolean
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          edge_function: string
          estimated_cost_usd: number
          id?: string
          input_tokens: number
          latency_ms?: number | null
          module?: string | null
          output_tokens: number
          provider: string
          was_fallback?: boolean
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          edge_function?: string
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          module?: string | null
          output_tokens?: number
          provider?: string
          was_fallback?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          agency_id: string
          agent_id: string
          booked_by: string
          cancelled_at: string | null
          cancelled_by: string | null
          client_ip: string | null
          client_note: string | null
          client_user_agent: string | null
          confirmation_sent_at: string | null
          contact_id: string
          created_at: string
          ends_at: string
          external_event_id: string | null
          external_provider: string | null
          id: string
          kyc_case_id: string | null
          location: string | null
          magic_link_id: string | null
          mode: string
          purpose: string
          reminder_sent_at: string | null
          reschedule_count: number
          slot: unknown
          starts_at: string
          status: string
          updated_at: string
          video_link: string | null
        }
        Insert: {
          agency_id: string
          agent_id: string
          booked_by?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_ip?: string | null
          client_note?: string | null
          client_user_agent?: string | null
          confirmation_sent_at?: string | null
          contact_id: string
          created_at?: string
          ends_at: string
          external_event_id?: string | null
          external_provider?: string | null
          id?: string
          kyc_case_id?: string | null
          location?: string | null
          magic_link_id?: string | null
          mode?: string
          purpose?: string
          reminder_sent_at?: string | null
          reschedule_count?: number
          slot?: unknown
          starts_at: string
          status?: string
          updated_at?: string
          video_link?: string | null
        }
        Update: {
          agency_id?: string
          agent_id?: string
          booked_by?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_ip?: string | null
          client_note?: string | null
          client_user_agent?: string | null
          confirmation_sent_at?: string | null
          contact_id?: string
          created_at?: string
          ends_at?: string
          external_event_id?: string | null
          external_provider?: string | null
          id?: string
          kyc_case_id?: string | null
          location?: string | null
          magic_link_id?: string | null
          mode?: string
          purpose?: string
          reminder_sent_at?: string | null
          reschedule_count?: number
          slot?: unknown
          starts_at?: string
          status?: string
          updated_at?: string
          video_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_kyc_case_id_fkey"
            columns: ["kyc_case_id"]
            isOneToOne: false
            referencedRelation: "kyc_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_magic_link_id_fkey"
            columns: ["magic_link_id"]
            isOneToOne: false
            referencedRelation: "kyc_magic_links"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_events: {
        Row: {
          action: string
          created_at: string
          detail: string | null
          id: string
          ip_hash: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string | null
          id?: string
          ip_hash?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string | null
          id?: string
          ip_hash?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          action: string
          agency_id: string
          auto_send: boolean | null
          created_at: string | null
          delay_days: number | null
          id: string
          is_active: boolean | null
          name: string
          template_id: string | null
          trigger_event: string
        }
        Insert: {
          action: string
          agency_id: string
          auto_send?: boolean | null
          created_at?: string | null
          delay_days?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          template_id?: string | null
          trigger_event: string
        }
        Update: {
          action?: string
          agency_id?: string
          auto_send?: boolean | null
          created_at?: string | null
          delay_days?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          template_id?: string | null
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_reception_links: {
        Row: {
          agency_id: string
          agent_id: string | null
          channel: string | null
          client_ip: string | null
          client_user_agent: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          match_ids: string[]
          reacted_at: string | null
          revoked_at: string | null
          sent_at: string
          status: string
          token: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          agency_id: string
          agent_id?: string | null
          channel?: string | null
          client_ip?: string | null
          client_user_agent?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          match_ids: string[]
          reacted_at?: string | null
          revoked_at?: string | null
          sent_at?: string
          status?: string
          token: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          agency_id?: string
          agent_id?: string | null
          channel?: string | null
          client_ip?: string | null
          client_user_agent?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          match_ids?: string[]
          reacted_at?: string | null
          revoked_at?: string | null
          sent_at?: string
          status?: string
          token?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_reception_links_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_reception_links_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_reception_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_reception_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sync: {
        Row: {
          created_at: string | null
          google_calendar_id: string | null
          google_event_id: string
          id: string
          last_synced_at: string | null
          user_id: string
          visit_id: string
        }
        Insert: {
          created_at?: string | null
          google_calendar_id?: string | null
          google_event_id: string
          id?: string
          last_synced_at?: string | null
          user_id: string
          visit_id: string
        }
        Update: {
          created_at?: string | null
          google_calendar_id?: string | null
          google_event_id?: string
          id?: string
          last_synced_at?: string | null
          user_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      client_searches: {
        Row: {
          agency_id: string
          contact_id: string
          created_at: string | null
          criteria: Json
          id: string
          is_active: boolean | null
          label: string | null
          last_matched_at: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          contact_id: string
          created_at?: string | null
          criteria: Json
          id?: string
          is_active?: boolean | null
          label?: string | null
          last_matched_at?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          contact_id?: string
          created_at?: string | null
          criteria?: Json
          id?: string
          is_active?: boolean | null
          label?: string | null
          last_matched_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_searches_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_searches_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          consent_privacy: boolean
          created_at: string
          email: string
          id: string
          lang: string
          message: string
          name: string
          phone: string | null
          responded_at: string | null
          responded_by: string | null
          source: string
          status: string
          subject: string | null
        }
        Insert: {
          consent_privacy: boolean
          created_at?: string
          email: string
          id?: string
          lang?: string
          message: string
          name: string
          phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          source?: string
          status?: string
          subject?: string | null
        }
        Update: {
          consent_privacy?: boolean
          created_at?: string
          email?: string
          id?: string
          lang?: string
          message?: string
          name?: string
          phone?: string | null
          responded_at?: string | null
          responded_by?: string | null
          source?: string
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      contact_scores: {
        Row: {
          agency_id: string
          budget_coherence_score: number | null
          buyer_score: number | null
          contact_id: string
          conversion_probability: number | null
          conversion_score: number | null
          created_at: string | null
          data_completeness: number | null
          engagement_score: number | null
          engagement_trend: string | null
          estimated_budget: number | null
          estimated_real_budget: number | null
          id: string
          intent_signals: Json | null
          interactions_count: number | null
          last_calculated_at: string | null
          matches_sent_count: number | null
          overall_score: number | null
          pipeline_score: number | null
          quality_score: number | null
          reactivity_score: number | null
          rejection_patterns: Json | null
          score_label: string | null
          visit_quality_score: number | null
          visits_count: number | null
        }
        Insert: {
          agency_id: string
          budget_coherence_score?: number | null
          buyer_score?: number | null
          contact_id: string
          conversion_probability?: number | null
          conversion_score?: number | null
          created_at?: string | null
          data_completeness?: number | null
          engagement_score?: number | null
          engagement_trend?: string | null
          estimated_budget?: number | null
          estimated_real_budget?: number | null
          id?: string
          intent_signals?: Json | null
          interactions_count?: number | null
          last_calculated_at?: string | null
          matches_sent_count?: number | null
          overall_score?: number | null
          pipeline_score?: number | null
          quality_score?: number | null
          reactivity_score?: number | null
          rejection_patterns?: Json | null
          score_label?: string | null
          visit_quality_score?: number | null
          visits_count?: number | null
        }
        Update: {
          agency_id?: string
          budget_coherence_score?: number | null
          buyer_score?: number | null
          contact_id?: string
          conversion_probability?: number | null
          conversion_score?: number | null
          created_at?: string | null
          data_completeness?: number | null
          engagement_score?: number | null
          engagement_trend?: string | null
          estimated_budget?: number | null
          estimated_real_budget?: number | null
          id?: string
          intent_signals?: Json | null
          interactions_count?: number | null
          last_calculated_at?: string | null
          matches_sent_count?: number | null
          overall_score?: number | null
          pipeline_score?: number | null
          quality_score?: number | null
          reactivity_score?: number | null
          rejection_patterns?: Json | null
          score_label?: string | null
          visit_quality_score?: number | null
          visits_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_scores_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_scores_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_suppressions: {
        Row: {
          ack_sent_at: string | null
          agency_id: string | null
          channel: string
          contact_id: string | null
          created_at: string
          email: string | null
          id: string
          lifted_at: string | null
          lifted_by: string | null
          lifted_reason: string | null
          reason: string
          source_ref: string | null
          wa_phone: string | null
        }
        Insert: {
          ack_sent_at?: string | null
          agency_id?: string | null
          channel: string
          contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lifted_at?: string | null
          lifted_by?: string | null
          lifted_reason?: string | null
          reason: string
          source_ref?: string | null
          wa_phone?: string | null
        }
        Update: {
          ack_sent_at?: string | null
          agency_id?: string | null
          channel?: string
          contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lifted_at?: string | null
          lifted_by?: string | null
          lifted_reason?: string | null
          reason?: string
          source_ref?: string | null
          wa_phone?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          agency_id: string | null
          birth_date: string | null
          created_at: string | null
          deleted_user_id: string | null
          email: string | null
          entity_type: string
          first_name: string
          form_data: Json | null
          home_address: string | null
          id: string
          import_raw_text: string | null
          import_raw_text_received_at: string | null
          language: string | null
          last_interaction_at: string | null
          last_name: string
          nationality: string | null
          notes: string | null
          phone: string | null
          residence_country: string | null
          score: string | null
          search_criteria: Json | null
          source: string
          tags: string[] | null
          type: string
          updated_at: string | null
          user_id: string | null
          wa_consent_at: string | null
          wa_opt_in: boolean
          wa_opt_out_at: string | null
          wa_suppressed: boolean
        }
        Insert: {
          agency_id?: string | null
          birth_date?: string | null
          created_at?: string | null
          deleted_user_id?: string | null
          email?: string | null
          entity_type?: string
          first_name: string
          form_data?: Json | null
          home_address?: string | null
          id?: string
          import_raw_text?: string | null
          import_raw_text_received_at?: string | null
          language?: string | null
          last_interaction_at?: string | null
          last_name: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          residence_country?: string | null
          score?: string | null
          search_criteria?: Json | null
          source?: string
          tags?: string[] | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
          wa_consent_at?: string | null
          wa_opt_in?: boolean
          wa_opt_out_at?: string | null
          wa_suppressed?: boolean
        }
        Update: {
          agency_id?: string | null
          birth_date?: string | null
          created_at?: string | null
          deleted_user_id?: string | null
          email?: string | null
          entity_type?: string
          first_name?: string
          form_data?: Json | null
          home_address?: string | null
          id?: string
          import_raw_text?: string | null
          import_raw_text_received_at?: string | null
          language?: string | null
          last_interaction_at?: string | null
          last_name?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          residence_country?: string | null
          score?: string | null
          search_criteria?: Json | null
          source?: string
          tags?: string[] | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
          wa_consent_at?: string | null
          wa_opt_in?: boolean
          wa_opt_out_at?: string | null
          wa_suppressed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contacts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_pending_actions: {
        Row: {
          agency_id: string | null
          created_at: string
          expires_at: string
          id: string
          kind: string
          payload: Json
          preview: string
          title: string | null
          tool: string
          user_id: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          kind: string
          payload?: Json
          preview: string
          title?: string | null
          tool: string
          user_id: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          kind?: string
          payload?: Json
          preview?: string
          title?: string | null
          tool?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_pending_actions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_pending_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_offers: {
        Row: {
          agency_id: string
          amount: number
          attachments: Json
          by_id: string | null
          by_label: string
          closing_date: string | null
          conditions: Json
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          deposit: number | null
          expires_at: string
          from_party: Database["public"]["Enums"]["crm_offer_party"]
          id: string
          kind: Database["public"]["Enums"]["crm_offer_kind"]
          notes: string | null
          parent_offer_id: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["crm_offer_status"]
          transaction_id: string | null
        }
        Insert: {
          agency_id: string
          amount: number
          attachments?: Json
          by_id?: string | null
          by_label: string
          closing_date?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          deposit?: number | null
          expires_at: string
          from_party: Database["public"]["Enums"]["crm_offer_party"]
          id?: string
          kind: Database["public"]["Enums"]["crm_offer_kind"]
          notes?: string | null
          parent_offer_id?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["crm_offer_status"]
          transaction_id?: string | null
        }
        Update: {
          agency_id?: string
          amount?: number
          attachments?: Json
          by_id?: string | null
          by_label?: string
          closing_date?: string | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          deposit?: number | null
          expires_at?: string
          from_party?: Database["public"]["Enums"]["crm_offer_party"]
          id?: string
          kind?: Database["public"]["Enums"]["crm_offer_kind"]
          notes?: string | null
          parent_offer_id?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["crm_offer_status"]
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_offers_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_offers_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_offers_parent_offer_id_fkey"
            columns: ["parent_offer_id"]
            isOneToOne: false
            referencedRelation: "crm_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_offers_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          agency_id: string | null
          contact_id: string | null
          created_at: string | null
          document_category: string | null
          expires_at: string | null
          id: string
          issued_at: string | null
          kyc_case_id: string | null
          name: string
          property_id: string | null
          retention_until: string | null
          sha256_hash: string | null
          signature_request_id: string | null
          signature_status: string | null
          signed_at: string | null
          size_bytes: number
          status: string
          storage_path: string
          transaction_id: string | null
          type: string
          uploaded_by: string | null
        }
        Insert: {
          agency_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          document_category?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          kyc_case_id?: string | null
          name: string
          property_id?: string | null
          retention_until?: string | null
          sha256_hash?: string | null
          signature_request_id?: string | null
          signature_status?: string | null
          signed_at?: string | null
          size_bytes: number
          status?: string
          storage_path: string
          transaction_id?: string | null
          type: string
          uploaded_by?: string | null
        }
        Update: {
          agency_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          document_category?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          kyc_case_id?: string | null
          name?: string
          property_id?: string | null
          retention_until?: string | null
          sha256_hash?: string | null
          signature_request_id?: string | null
          signature_status?: string | null
          signed_at?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string
          transaction_id?: string | null
          type?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_signature_request_id_fkey"
            columns: ["signature_request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_events: {
        Row: {
          bounce_type: string | null
          created_at: string
          email_id: string | null
          event_type: string
          id: string
          occurred_at: string
          payload: Json | null
          provider: string
          provider_event_id: string
          reason: string | null
          recipient: string | null
          subject: string | null
        }
        Insert: {
          bounce_type?: string | null
          created_at?: string
          email_id?: string | null
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          provider?: string
          provider_event_id: string
          reason?: string | null
          recipient?: string | null
          subject?: string | null
        }
        Update: {
          bounce_type?: string | null
          created_at?: string
          email_id?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          provider?: string
          provider_event_id?: string
          reason?: string | null
          recipient?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      esign_provider_connections: {
        Row: {
          agency_id: string
          config: Json
          connected_at: string | null
          connected_by: string | null
          created_at: string | null
          default_legislation: string | null
          default_quality: string | null
          display_name: string | null
          environment: string
          id: string
          is_active: boolean
          last_error: string | null
          provider: string
          status: string
          updated_at: string | null
          vault_secret_id: string | null
        }
        Insert: {
          agency_id: string
          config?: Json
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string | null
          default_legislation?: string | null
          default_quality?: string | null
          display_name?: string | null
          environment?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          provider: string
          status?: string
          updated_at?: string | null
          vault_secret_id?: string | null
        }
        Update: {
          agency_id?: string
          config?: Json
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string | null
          default_legislation?: string | null
          default_quality?: string | null
          display_name?: string | null
          environment?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          provider?: string
          status?: string
          updated_at?: string | null
          vault_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esign_provider_connections_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esign_provider_connections_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flatfox_sync_runs: {
        Row: {
          chunks_completed: number | null
          ended_at: string | null
          error_message: string | null
          id: string
          last_chunk_at: string | null
          pages_fetched: number | null
          started_at: string
          status: string
          total_errors: number | null
          total_expected: number | null
          total_inserted: number | null
          total_removed: number | null
          total_seen: number | null
          total_touched: number | null
          total_updated: number | null
          total_upserted: number | null
          trigger_source: string | null
        }
        Insert: {
          chunks_completed?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          last_chunk_at?: string | null
          pages_fetched?: number | null
          started_at?: string
          status?: string
          total_errors?: number | null
          total_expected?: number | null
          total_inserted?: number | null
          total_removed?: number | null
          total_seen?: number | null
          total_touched?: number | null
          total_updated?: number | null
          total_upserted?: number | null
          trigger_source?: string | null
        }
        Update: {
          chunks_completed?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          last_chunk_at?: string | null
          pages_fetched?: number | null
          started_at?: string
          status?: string
          total_errors?: number | null
          total_expected?: number | null
          total_inserted?: number | null
          total_removed?: number | null
          total_seen?: number | null
          total_touched?: number | null
          total_updated?: number | null
          total_upserted?: number | null
          trigger_source?: string | null
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string | null
          google_email: string | null
          id: string
          last_sync_at: string | null
          refresh_token: string
          sync_enabled: boolean | null
          token_expires_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string | null
          google_email?: string | null
          id?: string
          last_sync_at?: string | null
          refresh_token: string
          sync_enabled?: boolean | null
          token_expires_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string | null
          google_email?: string | null
          id?: string
          last_sync_at?: string | null
          refresh_token?: string
          sync_enabled?: boolean | null
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      knowledge_snippets: {
        Row: {
          applies_to_actions: string[]
          body_md: string
          canton: string | null
          created_at: string
          domain: string
          id: string
          keywords: string[]
          lang: string
          priority: number
          review_after: string | null
          slug: string
          source_ref: string | null
          source_url: string
          status: string
          title: string
          updated_at: string
          verified_at: string
        }
        Insert: {
          applies_to_actions?: string[]
          body_md: string
          canton?: string | null
          created_at?: string
          domain: string
          id?: string
          keywords?: string[]
          lang?: string
          priority?: number
          review_after?: string | null
          slug: string
          source_ref?: string | null
          source_url: string
          status?: string
          title: string
          updated_at?: string
          verified_at: string
        }
        Update: {
          applies_to_actions?: string[]
          body_md?: string
          canton?: string | null
          created_at?: string
          domain?: string
          id?: string
          keywords?: string[]
          lang?: string
          priority?: number
          review_after?: string | null
          slug?: string
          source_ref?: string | null
          source_url?: string
          status?: string
          title?: string
          updated_at?: string
          verified_at?: string
        }
        Relationships: []
      }
      kyc_cases: {
        Row: {
          agency_id: string
          ai_analysis: Json | null
          completion_pct: number
          contact_id: string | null
          contact_nationality: string | null
          created_at: string
          dossier_status: string | null
          expires_at: string | null
          id: string
          last_screening_at: string | null
          notes: string | null
          pep_details: Json | null
          pep_status: string | null
          risk_factors: Json | null
          risk_level: Database["public"]["Enums"]["kyc_risk_level"]
          risk_score: number | null
          sanctions_details: Json | null
          sanctions_status: string | null
          screening_started_at: string | null
          screening_status: string | null
          source_of_funds_description: string | null
          source_of_funds_doc_id: string | null
          source_of_funds_type:
            | Database["public"]["Enums"]["kyc_source_of_funds_type"]
            | null
          status: Database["public"]["Enums"]["kyc_status"]
          transaction_amount: number | null
          transaction_id: string | null
          type: Database["public"]["Enums"]["kyc_person_type"]
          validated_at: string | null
          validated_by: string | null
          vigilance: string | null
        }
        Insert: {
          agency_id: string
          ai_analysis?: Json | null
          completion_pct?: number
          contact_id?: string | null
          contact_nationality?: string | null
          created_at?: string
          dossier_status?: string | null
          expires_at?: string | null
          id?: string
          last_screening_at?: string | null
          notes?: string | null
          pep_details?: Json | null
          pep_status?: string | null
          risk_factors?: Json | null
          risk_level?: Database["public"]["Enums"]["kyc_risk_level"]
          risk_score?: number | null
          sanctions_details?: Json | null
          sanctions_status?: string | null
          screening_started_at?: string | null
          screening_status?: string | null
          source_of_funds_description?: string | null
          source_of_funds_doc_id?: string | null
          source_of_funds_type?:
            | Database["public"]["Enums"]["kyc_source_of_funds_type"]
            | null
          status?: Database["public"]["Enums"]["kyc_status"]
          transaction_amount?: number | null
          transaction_id?: string | null
          type: Database["public"]["Enums"]["kyc_person_type"]
          validated_at?: string | null
          validated_by?: string | null
          vigilance?: string | null
        }
        Update: {
          agency_id?: string
          ai_analysis?: Json | null
          completion_pct?: number
          contact_id?: string | null
          contact_nationality?: string | null
          created_at?: string
          dossier_status?: string | null
          expires_at?: string | null
          id?: string
          last_screening_at?: string | null
          notes?: string | null
          pep_details?: Json | null
          pep_status?: string | null
          risk_factors?: Json | null
          risk_level?: Database["public"]["Enums"]["kyc_risk_level"]
          risk_score?: number | null
          sanctions_details?: Json | null
          sanctions_status?: string | null
          screening_started_at?: string | null
          screening_status?: string | null
          source_of_funds_description?: string | null
          source_of_funds_doc_id?: string | null
          source_of_funds_type?:
            | Database["public"]["Enums"]["kyc_source_of_funds_type"]
            | null
          status?: Database["public"]["Enums"]["kyc_status"]
          transaction_amount?: number | null
          transaction_id?: string | null
          type?: Database["public"]["Enums"]["kyc_person_type"]
          validated_at?: string | null
          validated_by?: string | null
          vigilance?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_cases_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_cases_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_cases_source_of_funds_doc_id_fkey"
            columns: ["source_of_funds_doc_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_cases_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_cases_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_checklist_items: {
        Row: {
          category: string | null
          completed_at: string | null
          completed_by: string | null
          document_id: string | null
          id: string
          is_completed: boolean
          is_required: boolean
          kyc_case_id: string
          label: string
          notes: string | null
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          document_id?: string | null
          id?: string
          is_completed?: boolean
          is_required?: boolean
          kyc_case_id: string
          label: string
          notes?: string | null
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          document_id?: string | null
          id?: string
          is_completed?: boolean
          is_required?: boolean
          kyc_case_id?: string
          label?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_checklist_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_checklist_items_kyc_case_id_fkey"
            columns: ["kyc_case_id"]
            isOneToOne: false
            referencedRelation: "kyc_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_magic_link_uploads: {
        Row: {
          agency_id: string
          confirmed_at: string | null
          confirmed_by_client: boolean
          document_id: string | null
          filename: string
          id: string
          kyc_case_id: string | null
          magic_link_id: string | null
          mime_type: string | null
          ocr_completed_at: string | null
          ocr_fields: Json | null
          ocr_provider: string | null
          sha256_hash: string | null
          size_bytes: number
          source: string
          storage_path: string
          type: Database["public"]["Enums"]["kyc_magic_link_upload_type"]
          uploaded_at: string
          wa_message_id: string | null
        }
        Insert: {
          agency_id: string
          confirmed_at?: string | null
          confirmed_by_client?: boolean
          document_id?: string | null
          filename: string
          id?: string
          kyc_case_id?: string | null
          magic_link_id?: string | null
          mime_type?: string | null
          ocr_completed_at?: string | null
          ocr_fields?: Json | null
          ocr_provider?: string | null
          sha256_hash?: string | null
          size_bytes: number
          source?: string
          storage_path: string
          type?: Database["public"]["Enums"]["kyc_magic_link_upload_type"]
          uploaded_at?: string
          wa_message_id?: string | null
        }
        Update: {
          agency_id?: string
          confirmed_at?: string | null
          confirmed_by_client?: boolean
          document_id?: string | null
          filename?: string
          id?: string
          kyc_case_id?: string | null
          magic_link_id?: string | null
          mime_type?: string | null
          ocr_completed_at?: string | null
          ocr_fields?: Json | null
          ocr_provider?: string | null
          sha256_hash?: string | null
          size_bytes?: number
          source?: string
          storage_path?: string
          type?: Database["public"]["Enums"]["kyc_magic_link_upload_type"]
          uploaded_at?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_magic_link_uploads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_magic_link_uploads_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_magic_link_uploads_kyc_case_id_fkey"
            columns: ["kyc_case_id"]
            isOneToOne: false
            referencedRelation: "kyc_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_magic_link_uploads_magic_link_id_fkey"
            columns: ["magic_link_id"]
            isOneToOne: false
            referencedRelation: "kyc_magic_links"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_magic_links: {
        Row: {
          agency_id: string
          channels: string[]
          client_ip: string | null
          client_user_agent: string | null
          confirmed_at: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          custom_message: string | null
          email_sent_at: string | null
          expired_at: string | null
          expires_at: string
          id: string
          kyc_case_id: string
          mode: Database["public"]["Enums"]["kyc_magic_link_mode"]
          opened_at: string | null
          sent_at: string
          status: Database["public"]["Enums"]["kyc_magic_link_status"]
          token: string
          updated_at: string
          uploaded_at: string | null
        }
        Insert: {
          agency_id: string
          channels?: string[]
          client_ip?: string | null
          client_user_agent?: string | null
          confirmed_at?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          custom_message?: string | null
          email_sent_at?: string | null
          expired_at?: string | null
          expires_at: string
          id?: string
          kyc_case_id: string
          mode?: Database["public"]["Enums"]["kyc_magic_link_mode"]
          opened_at?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["kyc_magic_link_status"]
          token: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Update: {
          agency_id?: string
          channels?: string[]
          client_ip?: string | null
          client_user_agent?: string | null
          confirmed_at?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          custom_message?: string | null
          email_sent_at?: string | null
          expired_at?: string | null
          expires_at?: string
          id?: string
          kyc_case_id?: string
          mode?: Database["public"]["Enums"]["kyc_magic_link_mode"]
          opened_at?: string | null
          sent_at?: string
          status?: Database["public"]["Enums"]["kyc_magic_link_status"]
          token?: string
          updated_at?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_magic_links_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_magic_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_magic_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_magic_links_kyc_case_id_fkey"
            columns: ["kyc_case_id"]
            isOneToOne: false
            referencedRelation: "kyc_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_screening_decisions: {
        Row: {
          agency_id: string
          decided_at: string
          decided_by: string
          decision: string
          decision_target: string
          id: string
          justification: string
          kyc_case_id: string
          screening_snapshot: Json
          supersedes_id: string | null
        }
        Insert: {
          agency_id: string
          decided_at?: string
          decided_by: string
          decision: string
          decision_target: string
          id?: string
          justification: string
          kyc_case_id: string
          screening_snapshot: Json
          supersedes_id?: string | null
        }
        Update: {
          agency_id?: string
          decided_at?: string
          decided_by?: string
          decision?: string
          decision_target?: string
          id?: string
          justification?: string
          kyc_case_id?: string
          screening_snapshot?: Json
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_screening_decisions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_screening_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_screening_decisions_kyc_case_id_fkey"
            columns: ["kyc_case_id"]
            isOneToOne: false
            referencedRelation: "kyc_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_screening_decisions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "kyc_screening_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_versions: {
        Row: {
          consent_type: string
          updated_at: string
          version: string
        }
        Insert: {
          consent_type: string
          updated_at?: string
          version: string
        }
        Update: {
          consent_type?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      legal_form_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          legal_form_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          legal_form_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          legal_form_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_form_aliases_legal_form_id_fkey"
            columns: ["legal_form_id"]
            isOneToOne: false
            referencedRelation: "legal_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_forms: {
        Row: {
          category: string
          code: string
          country: string
          created_at: string
          id: string
          label_de: string
          label_en: string
          label_fr: string
          label_it: string
          sort_order: number
        }
        Insert: {
          category: string
          code: string
          country: string
          created_at?: string
          id?: string
          label_de: string
          label_en: string
          label_fr: string
          label_it: string
          sort_order?: number
        }
        Update: {
          category?: string
          code?: string
          country?: string
          created_at?: string
          id?: string
          label_de?: string
          label_en?: string
          label_fr?: string
          label_it?: string
          sort_order?: number
        }
        Relationships: []
      }
      market_listings: {
        Row: {
          absent_first_at: string | null
          absent_probe_count: number
          address: string | null
          agency_contact_name: string | null
          agency_contact_phone: string | null
          agency_logo_url: string | null
          agency_name: string | null
          agency_phone: string | null
          agency_portal_id: string | null
          agency_profile_id: string | null
          agency_reference: string | null
          availability_date: string | null
          bathrooms: number | null
          bedrooms: number | null
          c2pa_verified: boolean | null
          canton: string
          charges_monthly: number | null
          city: string
          created_at: string
          currency: string
          current_price: number | null
          days_on_market: number | null
          deposit_months: number | null
          description: string | null
          description_de: string | null
          description_en: string | null
          description_it: string | null
          energy_label: string | null
          external_regie: Json | null
          features: Json | null
          first_seen_at: string
          floor: number | null
          floor_plan_hotspots: Json | null
          floor_plan_url: string | null
          has_balcony: boolean | null
          has_elevator: boolean | null
          has_fireplace: boolean | null
          has_garage: boolean | null
          has_nice_view: boolean | null
          has_parking: boolean | null
          has_swimming_pool: boolean | null
          id: string
          is_child_friendly: boolean | null
          is_furnished: boolean | null
          is_minergie: boolean | null
          is_new_building: boolean | null
          land_surface: number | null
          last_probe_at: string | null
          last_seen_at: string
          lat: number | null
          listing_type: string | null
          lng: number | null
          minergie_label: string | null
          parking_count: number | null
          pets_allowed: boolean | null
          photo_tags: Json | null
          photos: string[] | null
          photos_cf: Json | null
          photos_cf_processed_at: string | null
          photos_count: number | null
          platforms: string[] | null
          postal_code: string | null
          price: number | null
          price_at_first_seen: number | null
          price_per_m2: number | null
          price_reduced_at: string | null
          property_type_detail: string | null
          quality_flags: Json | null
          quality_score: number | null
          relevance_score: number | null
          rent: number | null
          rent_chf: number | null
          rooms: number | null
          source_created_at: string | null
          source_id: string
          source_payload: Json | null
          source_portal: string
          source_updated_at: string | null
          source_url: string | null
          status: string
          surface_m2: number | null
          title: string
          transaction_type: string
          type: string
          updated_at: string
          usable_surface: number | null
          visit_contact_name: string | null
          visit_contact_phone: string | null
          year_built: number | null
          year_renovated: number | null
        }
        Insert: {
          absent_first_at?: string | null
          absent_probe_count?: number
          address?: string | null
          agency_contact_name?: string | null
          agency_contact_phone?: string | null
          agency_logo_url?: string | null
          agency_name?: string | null
          agency_phone?: string | null
          agency_portal_id?: string | null
          agency_profile_id?: string | null
          agency_reference?: string | null
          availability_date?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          c2pa_verified?: boolean | null
          canton: string
          charges_monthly?: number | null
          city: string
          created_at?: string
          currency?: string
          current_price?: number | null
          days_on_market?: number | null
          deposit_months?: number | null
          description?: string | null
          description_de?: string | null
          description_en?: string | null
          description_it?: string | null
          energy_label?: string | null
          external_regie?: Json | null
          features?: Json | null
          first_seen_at?: string
          floor?: number | null
          floor_plan_hotspots?: Json | null
          floor_plan_url?: string | null
          has_balcony?: boolean | null
          has_elevator?: boolean | null
          has_fireplace?: boolean | null
          has_garage?: boolean | null
          has_nice_view?: boolean | null
          has_parking?: boolean | null
          has_swimming_pool?: boolean | null
          id?: string
          is_child_friendly?: boolean | null
          is_furnished?: boolean | null
          is_minergie?: boolean | null
          is_new_building?: boolean | null
          land_surface?: number | null
          last_probe_at?: string | null
          last_seen_at?: string
          lat?: number | null
          listing_type?: string | null
          lng?: number | null
          minergie_label?: string | null
          parking_count?: number | null
          pets_allowed?: boolean | null
          photo_tags?: Json | null
          photos?: string[] | null
          photos_cf?: Json | null
          photos_cf_processed_at?: string | null
          photos_count?: number | null
          platforms?: string[] | null
          postal_code?: string | null
          price?: number | null
          price_at_first_seen?: number | null
          price_per_m2?: number | null
          price_reduced_at?: string | null
          property_type_detail?: string | null
          quality_flags?: Json | null
          quality_score?: number | null
          relevance_score?: number | null
          rent?: number | null
          rent_chf?: number | null
          rooms?: number | null
          source_created_at?: string | null
          source_id: string
          source_payload?: Json | null
          source_portal?: string
          source_updated_at?: string | null
          source_url?: string | null
          status?: string
          surface_m2?: number | null
          title: string
          transaction_type?: string
          type?: string
          updated_at?: string
          usable_surface?: number | null
          visit_contact_name?: string | null
          visit_contact_phone?: string | null
          year_built?: number | null
          year_renovated?: number | null
        }
        Update: {
          absent_first_at?: string | null
          absent_probe_count?: number
          address?: string | null
          agency_contact_name?: string | null
          agency_contact_phone?: string | null
          agency_logo_url?: string | null
          agency_name?: string | null
          agency_phone?: string | null
          agency_portal_id?: string | null
          agency_profile_id?: string | null
          agency_reference?: string | null
          availability_date?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          c2pa_verified?: boolean | null
          canton?: string
          charges_monthly?: number | null
          city?: string
          created_at?: string
          currency?: string
          current_price?: number | null
          days_on_market?: number | null
          deposit_months?: number | null
          description?: string | null
          description_de?: string | null
          description_en?: string | null
          description_it?: string | null
          energy_label?: string | null
          external_regie?: Json | null
          features?: Json | null
          first_seen_at?: string
          floor?: number | null
          floor_plan_hotspots?: Json | null
          floor_plan_url?: string | null
          has_balcony?: boolean | null
          has_elevator?: boolean | null
          has_fireplace?: boolean | null
          has_garage?: boolean | null
          has_nice_view?: boolean | null
          has_parking?: boolean | null
          has_swimming_pool?: boolean | null
          id?: string
          is_child_friendly?: boolean | null
          is_furnished?: boolean | null
          is_minergie?: boolean | null
          is_new_building?: boolean | null
          land_surface?: number | null
          last_probe_at?: string | null
          last_seen_at?: string
          lat?: number | null
          listing_type?: string | null
          lng?: number | null
          minergie_label?: string | null
          parking_count?: number | null
          pets_allowed?: boolean | null
          photo_tags?: Json | null
          photos?: string[] | null
          photos_cf?: Json | null
          photos_cf_processed_at?: string | null
          photos_count?: number | null
          platforms?: string[] | null
          postal_code?: string | null
          price?: number | null
          price_at_first_seen?: number | null
          price_per_m2?: number | null
          price_reduced_at?: string | null
          property_type_detail?: string | null
          quality_flags?: Json | null
          quality_score?: number | null
          relevance_score?: number | null
          rent?: number | null
          rent_chf?: number | null
          rooms?: number | null
          source_created_at?: string | null
          source_id?: string
          source_payload?: Json | null
          source_portal?: string
          source_updated_at?: string | null
          source_url?: string | null
          status?: string
          surface_m2?: number | null
          title?: string
          transaction_type?: string
          type?: string
          updated_at?: string
          usable_surface?: number | null
          visit_contact_name?: string | null
          visit_contact_phone?: string | null
          year_built?: number | null
          year_renovated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_listings_agency_profile_id_fkey"
            columns: ["agency_profile_id"]
            isOneToOne: false
            referencedRelation: "agency_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_price_history: {
        Row: {
          change_pct: number | null
          detected_at: string
          id: string
          market_listing_id: string
          new_price: number
          old_price: number
        }
        Insert: {
          change_pct?: number | null
          detected_at?: string
          id?: string
          market_listing_id: string
          new_price: number
          old_price: number
        }
        Update: {
          change_pct?: number | null
          detected_at?: string
          id?: string
          market_listing_id?: string
          new_price?: number
          old_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_price_history_market_listing_id_fkey"
            columns: ["market_listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          agency_id: string
          client_search_id: string | null
          contact_id: string
          created_at: string | null
          id: string
          market_listing_id: string | null
          property_id: string | null
          reaction_motif: string | null
          reaction_note: string | null
          reasons: Json | null
          response_at: string | null
          score: number
          score_version: number | null
          sent_at: string | null
          sent_via: string | null
          snoozed_until: string | null
          source: string
          status: string
        }
        Insert: {
          agency_id: string
          client_search_id?: string | null
          contact_id: string
          created_at?: string | null
          id?: string
          market_listing_id?: string | null
          property_id?: string | null
          reaction_motif?: string | null
          reaction_note?: string | null
          reasons?: Json | null
          response_at?: string | null
          score: number
          score_version?: number | null
          sent_at?: string | null
          sent_via?: string | null
          snoozed_until?: string | null
          source?: string
          status?: string
        }
        Update: {
          agency_id?: string
          client_search_id?: string | null
          contact_id?: string
          created_at?: string | null
          id?: string
          market_listing_id?: string | null
          property_id?: string | null
          reaction_motif?: string | null
          reaction_note?: string | null
          reasons?: Json | null
          response_at?: string | null
          score?: number
          score_version?: number | null
          sent_at?: string | null
          sent_via?: string | null
          snoozed_until?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_client_search_id_fkey"
            columns: ["client_search_id"]
            isOneToOne: false
            referencedRelation: "client_searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_market_listing_id_fkey"
            columns: ["market_listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          agency_id: string
          body: string
          category: string
          channel: string
          created_at: string | null
          id: string
          is_ai_generated: boolean | null
          name: string
          subject: string | null
        }
        Insert: {
          agency_id: string
          body: string
          category: string
          channel: string
          created_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          name: string
          subject?: string | null
        }
        Update: {
          agency_id?: string
          body?: string
          category?: string
          channel?: string
          created_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          name?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          id: string
          property_id: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          property_id?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          property_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_calls: {
        Row: {
          agency_id: string
          attendee_answers: Json | null
          attendee_note: string | null
          attendee_phone: string | null
          booked_by: string
          calendar_event_id: string | null
          calendar_provider: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          confirmation_sent_at: string | null
          created_at: string
          duration_minutes: number
          host_display_name: string
          host_id: string
          id: string
          manage_token: string
          meeting_url: string | null
          reminder_sent_at: string | null
          rescheduled_count: number
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          attendee_answers?: Json | null
          attendee_note?: string | null
          attendee_phone?: string | null
          booked_by: string
          calendar_event_id?: string | null
          calendar_provider?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          duration_minutes?: number
          host_display_name: string
          host_id: string
          id?: string
          manage_token?: string
          meeting_url?: string | null
          reminder_sent_at?: string | null
          rescheduled_count?: number
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          attendee_answers?: Json | null
          attendee_note?: string | null
          attendee_phone?: string | null
          booked_by?: string
          calendar_event_id?: string | null
          calendar_provider?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          duration_minutes?: number
          host_display_name?: string
          host_id?: string
          id?: string
          manage_token?: string
          meeting_url?: string | null
          reminder_sent_at?: string | null
          rescheduled_count?: number
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_calls_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_calls_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_calls_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "onboarding_hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_host_exceptions: {
        Row: {
          created_at: string
          day: string
          host_id: string
          id: string
          is_closed: boolean
          reason: string | null
          slices: Json
        }
        Insert: {
          created_at?: string
          day: string
          host_id: string
          id?: string
          is_closed?: boolean
          reason?: string | null
          slices?: Json
        }
        Update: {
          created_at?: string
          day?: string
          host_id?: string
          id?: string
          is_closed?: boolean
          reason?: string | null
          slices?: Json
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_host_exceptions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "onboarding_hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_hosts: {
        Row: {
          buffer_after_minutes: number
          calendar_email: string | null
          created_at: string
          display_name: string
          duration_minutes: number
          horizon_days: number
          id: string
          is_active: boolean
          max_per_day: number | null
          min_notice_hours: number
          profile_id: string
          slot_minutes: number
          timezone: string
          updated_at: string
          weekly_hours: Json
        }
        Insert: {
          buffer_after_minutes?: number
          calendar_email?: string | null
          created_at?: string
          display_name: string
          duration_minutes?: number
          horizon_days?: number
          id?: string
          is_active?: boolean
          max_per_day?: number | null
          min_notice_hours?: number
          profile_id: string
          slot_minutes?: number
          timezone?: string
          updated_at?: string
          weekly_hours?: Json
        }
        Update: {
          buffer_after_minutes?: number
          calendar_email?: string | null
          created_at?: string
          display_name?: string
          duration_minutes?: number
          horizon_days?: number
          id?: string
          is_active?: boolean
          max_per_day?: number | null
          min_notice_hours?: number
          profile_id?: string
          slot_minutes?: number
          timezone?: string
          updated_at?: string
          weekly_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_hosts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          kind: string
          last_error: string | null
          next_retry_at: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          kind: string
          last_error?: string | null
          next_retry_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          kind?: string
          last_error?: string | null
          next_retry_at?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      outlook_calendar_sync: {
        Row: {
          created_at: string | null
          id: string
          last_synced_at: string | null
          outlook_event_id: string
          user_id: string
          visit_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          outlook_event_id: string
          user_id: string
          visit_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          outlook_event_id?: string
          user_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlook_calendar_sync_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      outlook_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          last_sync_at: string | null
          outlook_email: string | null
          refresh_token: string
          sync_enabled: boolean | null
          token_expires_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          outlook_email?: string | null
          refresh_token: string
          sync_enabled?: boolean | null
          token_expires_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          outlook_email?: string | null
          refresh_token?: string
          sync_enabled?: boolean | null
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "platform_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_announcements: {
        Row: {
          audience_agencies: string[]
          audience_plans: string[]
          body: string
          created_at: string
          created_by: string | null
          cta_href: string | null
          cta_label: string | null
          ends_at: string | null
          id: string
          published: boolean
          severity: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          audience_agencies?: string[]
          audience_plans?: string[]
          body: string
          created_at?: string
          created_by?: string | null
          cta_href?: string | null
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          published?: boolean
          severity?: string
          starts_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience_agencies?: string[]
          audience_plans?: string[]
          body?: string
          created_at?: string
          created_by?: string | null
          cta_href?: string | null
          cta_label?: string | null
          ends_at?: string | null
          id?: string
          published?: boolean
          severity?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_metrics: {
        Row: {
          id: string
          metadata: Json | null
          metric_type: string
          metric_value: number
          recorded_at: string | null
        }
        Insert: {
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_value: number
          recorded_at?: string | null
        }
        Update: {
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_value?: number
          recorded_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activation_checklist: Json | null
          agency_id: string | null
          agent_role: string | null
          avatar_url: string | null
          canton: string | null
          created_at: string | null
          day0_payload: Json | null
          deleted_at: string | null
          email: string
          email_signature: string | null
          email_signature_html: string | null
          first_day_completed_at: string | null
          first_day_done: boolean | null
          full_name: string
          id: string
          is_suspended: boolean
          language: string | null
          mobile_phone: string | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
          phone: string | null
          preferences: Json | null
          rcc: string | null
          role: string
          signature_mode: string | null
          spoken_languages: string[] | null
          weekly_digest_opt_out: boolean
        }
        Insert: {
          activation_checklist?: Json | null
          agency_id?: string | null
          agent_role?: string | null
          avatar_url?: string | null
          canton?: string | null
          created_at?: string | null
          day0_payload?: Json | null
          deleted_at?: string | null
          email: string
          email_signature?: string | null
          email_signature_html?: string | null
          first_day_completed_at?: string | null
          first_day_done?: boolean | null
          full_name: string
          id: string
          is_suspended?: boolean
          language?: string | null
          mobile_phone?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          phone?: string | null
          preferences?: Json | null
          rcc?: string | null
          role?: string
          signature_mode?: string | null
          spoken_languages?: string[] | null
          weekly_digest_opt_out?: boolean
        }
        Update: {
          activation_checklist?: Json | null
          agency_id?: string | null
          agent_role?: string | null
          avatar_url?: string | null
          canton?: string | null
          created_at?: string | null
          day0_payload?: Json | null
          deleted_at?: string | null
          email?: string
          email_signature?: string | null
          email_signature_html?: string | null
          first_day_completed_at?: string | null
          first_day_done?: boolean | null
          full_name?: string
          id?: string
          is_suspended?: boolean
          language?: string | null
          mobile_phone?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          phone?: string | null
          preferences?: Json | null
          rcc?: string | null
          role?: string
          signature_mode?: string | null
          spoken_languages?: string[] | null
          weekly_digest_opt_out?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          agency_id: string
          ai_generated_photos: string[]
          availability_date: string | null
          bathrooms: number | null
          bedrooms: number | null
          c2pa_verification_method: string | null
          c2pa_verified: boolean | null
          c2pa_verified_at: string | null
          canton: string | null
          charges_monthly: number | null
          city: string | null
          condition: string | null
          contact_layout: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deposit_months: number | null
          description: string | null
          egid: string | null
          energy_class: string | null
          energy_label: string | null
          external_regie: Json | null
          favorites_count: number | null
          features: Json | null
          floor: number | null
          floor_plan_hotspots: Json | null
          floor_plan_url: string | null
          gallery_layout: string
          id: string
          is_furnished: boolean | null
          lat: number | null
          lng: number | null
          mandate_commission_pct: number | null
          mandate_expires_at: string | null
          mandate_signed_at: string | null
          mandate_type: string | null
          minergie_label: string | null
          moderation_reason: string | null
          moderation_status: string | null
          neighborhood_variant: string
          partner_agency: string | null
          photo_tags: Json | null
          photos: string[] | null
          photos_cf: Json | null
          photos_cf_processed_at: string | null
          postal_code: string | null
          price: number | null
          private_notes: string | null
          published_at: string | null
          rooms: number | null
          status: Database["public"]["Enums"]["property_status"]
          surface_m2: number | null
          title: string
          total_floors: number | null
          transaction_type: string
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string | null
          views_count: number | null
          year_built: number | null
        }
        Insert: {
          address?: string | null
          agency_id: string
          ai_generated_photos?: string[]
          availability_date?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          c2pa_verification_method?: string | null
          c2pa_verified?: boolean | null
          c2pa_verified_at?: string | null
          canton?: string | null
          charges_monthly?: number | null
          city?: string | null
          condition?: string | null
          contact_layout?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deposit_months?: number | null
          description?: string | null
          egid?: string | null
          energy_class?: string | null
          energy_label?: string | null
          external_regie?: Json | null
          favorites_count?: number | null
          features?: Json | null
          floor?: number | null
          floor_plan_hotspots?: Json | null
          floor_plan_url?: string | null
          gallery_layout?: string
          id?: string
          is_furnished?: boolean | null
          lat?: number | null
          lng?: number | null
          mandate_commission_pct?: number | null
          mandate_expires_at?: string | null
          mandate_signed_at?: string | null
          mandate_type?: string | null
          minergie_label?: string | null
          moderation_reason?: string | null
          moderation_status?: string | null
          neighborhood_variant?: string
          partner_agency?: string | null
          photo_tags?: Json | null
          photos?: string[] | null
          photos_cf?: Json | null
          photos_cf_processed_at?: string | null
          postal_code?: string | null
          price?: number | null
          private_notes?: string | null
          published_at?: string | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          surface_m2?: number | null
          title: string
          total_floors?: number | null
          transaction_type?: string
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string | null
          views_count?: number | null
          year_built?: number | null
        }
        Update: {
          address?: string | null
          agency_id?: string
          ai_generated_photos?: string[]
          availability_date?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          c2pa_verification_method?: string | null
          c2pa_verified?: boolean | null
          c2pa_verified_at?: string | null
          canton?: string | null
          charges_monthly?: number | null
          city?: string | null
          condition?: string | null
          contact_layout?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deposit_months?: number | null
          description?: string | null
          egid?: string | null
          energy_class?: string | null
          energy_label?: string | null
          external_regie?: Json | null
          favorites_count?: number | null
          features?: Json | null
          floor?: number | null
          floor_plan_hotspots?: Json | null
          floor_plan_url?: string | null
          gallery_layout?: string
          id?: string
          is_furnished?: boolean | null
          lat?: number | null
          lng?: number | null
          mandate_commission_pct?: number | null
          mandate_expires_at?: string | null
          mandate_signed_at?: string | null
          mandate_type?: string | null
          minergie_label?: string | null
          moderation_reason?: string | null
          moderation_status?: string | null
          neighborhood_variant?: string
          partner_agency?: string | null
          photo_tags?: Json | null
          photos?: string[] | null
          photos_cf?: Json | null
          photos_cf_processed_at?: string | null
          postal_code?: string | null
          price?: number | null
          private_notes?: string | null
          published_at?: string | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          surface_m2?: number | null
          title?: string
          total_floors?: number | null
          transaction_type?: string
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string | null
          views_count?: number | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_scores: {
        Row: {
          agency_id: string
          avg_comparable_price: number | null
          comparable_count: number | null
          completeness_score: number | null
          created_at: string | null
          data_completeness: number | null
          days_on_market: number | null
          freshness_score: number | null
          heat_score: number | null
          id: string
          interest_level: number | null
          interest_score: number | null
          last_calculated_at: string | null
          market_listing_id: string | null
          market_position_score: number | null
          overall_score: number | null
          pipeline_score: number | null
          price_trend: string | null
          price_vs_market_pct: number | null
          property_id: string | null
          score_label: string | null
          source: string
          stagnation_risk: string | null
        }
        Insert: {
          agency_id: string
          avg_comparable_price?: number | null
          comparable_count?: number | null
          completeness_score?: number | null
          created_at?: string | null
          data_completeness?: number | null
          days_on_market?: number | null
          freshness_score?: number | null
          heat_score?: number | null
          id?: string
          interest_level?: number | null
          interest_score?: number | null
          last_calculated_at?: string | null
          market_listing_id?: string | null
          market_position_score?: number | null
          overall_score?: number | null
          pipeline_score?: number | null
          price_trend?: string | null
          price_vs_market_pct?: number | null
          property_id?: string | null
          score_label?: string | null
          source: string
          stagnation_risk?: string | null
        }
        Update: {
          agency_id?: string
          avg_comparable_price?: number | null
          comparable_count?: number | null
          completeness_score?: number | null
          created_at?: string | null
          data_completeness?: number | null
          days_on_market?: number | null
          freshness_score?: number | null
          heat_score?: number | null
          id?: string
          interest_level?: number | null
          interest_score?: number | null
          last_calculated_at?: string | null
          market_listing_id?: string | null
          market_position_score?: number | null
          overall_score?: number | null
          pipeline_score?: number | null
          price_trend?: string | null
          price_vs_market_pct?: number | null
          property_id?: string | null
          score_label?: string | null
          source?: string
          stagnation_risk?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_scores_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_scores_market_listing_id_fkey"
            columns: ["market_listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_scores_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_syndications: {
        Row: {
          agency_id: string
          created_at: string
          error: string | null
          external_ref: string | null
          id: string
          last_imported_at: string | null
          last_pushed_at: string | null
          portal: string
          property_id: string
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          error?: string | null
          external_ref?: string | null
          id?: string
          last_imported_at?: string | null
          last_pushed_at?: string | null
          portal?: string
          property_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          error?: string | null
          external_ref?: string | null
          id?: string
          last_imported_at?: string | null
          last_pushed_at?: string | null
          portal?: string
          property_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_syndications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_syndications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      realadvisor_probe_inflight: {
        Row: {
          fired_at: string
          kind: string
          offer_type: string
          request_id: number
          source_ids: string[]
        }
        Insert: {
          fired_at?: string
          kind?: string
          offer_type?: string
          request_id: number
          source_ids: string[]
        }
        Update: {
          fired_at?: string
          kind?: string
          offer_type?: string
          request_id?: number
          source_ids?: string[]
        }
        Relationships: []
      }
      realadvisor_slice_coverage: {
        Row: {
          canton: string
          canton_code: string | null
          cycle_id: string
          fully_enumerated: boolean
          gte: number | null
          id: number
          lte: number | null
          observed_at: string
          seen: number
          total: number
        }
        Insert: {
          canton: string
          canton_code?: string | null
          cycle_id: string
          fully_enumerated?: boolean
          gte?: number | null
          id?: number
          lte?: number | null
          observed_at?: string
          seen?: number
          total?: number
        }
        Update: {
          canton?: string
          canton_code?: string | null
          cycle_id?: string
          fully_enumerated?: boolean
          gte?: number | null
          id?: number
          lte?: number | null
          observed_at?: string
          seen?: number
          total?: number
        }
        Relationships: []
      }
      realadvisor_sync_runs: {
        Row: {
          chunks_completed: number | null
          ended_at: string | null
          error_message: string | null
          id: string
          last_chunk_at: string | null
          offer_type: string | null
          pages_fetched: number | null
          started_at: string
          status: string
          total_errors: number | null
          total_expected: number | null
          total_inserted: number | null
          total_removed: number | null
          total_seen: number | null
          total_updated: number | null
          total_upserted: number | null
          trigger_source: string | null
        }
        Insert: {
          chunks_completed?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          last_chunk_at?: string | null
          offer_type?: string | null
          pages_fetched?: number | null
          started_at?: string
          status?: string
          total_errors?: number | null
          total_expected?: number | null
          total_inserted?: number | null
          total_removed?: number | null
          total_seen?: number | null
          total_updated?: number | null
          total_upserted?: number | null
          trigger_source?: string | null
        }
        Update: {
          chunks_completed?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          last_chunk_at?: string | null
          offer_type?: string | null
          pages_fetched?: number | null
          started_at?: string
          status?: string
          total_errors?: number | null
          total_expected?: number | null
          total_inserted?: number | null
          total_removed?: number | null
          total_seen?: number | null
          total_updated?: number | null
          total_upserted?: number | null
          trigger_source?: string | null
        }
        Relationships: []
      }
      registry_companies: {
        Row: {
          business_registration_number: string
          capital_amount: number | null
          capital_currency: string | null
          city: string | null
          country: string
          created_at: string
          discovery_query: string | null
          fetched_at: string
          house_number: string | null
          id: string
          last_publication_date: string | null
          legal_form_code: string | null
          legal_form_id: string | null
          legal_form_label: string | null
          legal_name: string
          legal_seat: string | null
          legal_seat_code: string | null
          postal_code: string | null
          purpose: string | null
          raw_response: Json | null
          region_code: string | null
          registry_deletion_date: string | null
          registry_entity_id: string | null
          registry_excerpt_url: string | null
          registry_office_code: string | null
          registry_secondary_number: string | null
          registry_source: string
          status: string
          street: string | null
          updated_at: string
        }
        Insert: {
          business_registration_number: string
          capital_amount?: number | null
          capital_currency?: string | null
          city?: string | null
          country: string
          created_at?: string
          discovery_query?: string | null
          fetched_at?: string
          house_number?: string | null
          id?: string
          last_publication_date?: string | null
          legal_form_code?: string | null
          legal_form_id?: string | null
          legal_form_label?: string | null
          legal_name: string
          legal_seat?: string | null
          legal_seat_code?: string | null
          postal_code?: string | null
          purpose?: string | null
          raw_response?: Json | null
          region_code?: string | null
          registry_deletion_date?: string | null
          registry_entity_id?: string | null
          registry_excerpt_url?: string | null
          registry_office_code?: string | null
          registry_secondary_number?: string | null
          registry_source: string
          status: string
          street?: string | null
          updated_at?: string
        }
        Update: {
          business_registration_number?: string
          capital_amount?: number | null
          capital_currency?: string | null
          city?: string | null
          country?: string
          created_at?: string
          discovery_query?: string | null
          fetched_at?: string
          house_number?: string | null
          id?: string
          last_publication_date?: string | null
          legal_form_code?: string | null
          legal_form_id?: string | null
          legal_form_label?: string | null
          legal_name?: string
          legal_seat?: string | null
          legal_seat_code?: string | null
          postal_code?: string | null
          purpose?: string | null
          raw_response?: Json | null
          region_code?: string | null
          registry_deletion_date?: string | null
          registry_entity_id?: string | null
          registry_excerpt_url?: string | null
          registry_office_code?: string | null
          registry_secondary_number?: string | null
          registry_source?: string
          status?: string
          street?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_companies_legal_form_id_fkey"
            columns: ["legal_form_id"]
            isOneToOne: false
            referencedRelation: "legal_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      relance_items: {
        Row: {
          agency_id: string
          contact_id: string
          copied_at: string | null
          created_at: string
          generated_at: string | null
          generated_text: string | null
          id: string
          session_id: string
          status: string
        }
        Insert: {
          agency_id: string
          contact_id: string
          copied_at?: string | null
          created_at?: string
          generated_at?: string | null
          generated_text?: string | null
          id?: string
          session_id: string
          status: string
        }
        Update: {
          agency_id?: string
          contact_id?: string
          copied_at?: string | null
          created_at?: string
          generated_at?: string | null
          generated_text?: string | null
          id?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "relance_items_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relance_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relance_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "relance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      relance_sessions: {
        Row: {
          agency_id: string
          agent_id: string
          closed_at: string | null
          created_at: string
          id: string
          started_at: string
        }
        Insert: {
          agency_id: string
          agent_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          started_at?: string
        }
        Update: {
          agency_id?: string
          agent_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relance_sessions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          agency_id: string
          channel: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          draft_message: string | null
          id: string
          kind: string | null
          match_id: string | null
          message_template: string | null
          property_id: string | null
          status: string
          transaction_id: string | null
          trigger_at: string | null
          trigger_days: number | null
          trigger_rule: string
          type: string
        }
        Insert: {
          agency_id: string
          channel?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          draft_message?: string | null
          id?: string
          kind?: string | null
          match_id?: string | null
          message_template?: string | null
          property_id?: string | null
          status?: string
          transaction_id?: string | null
          trigger_at?: string | null
          trigger_days?: number | null
          trigger_rule: string
          type: string
        }
        Update: {
          agency_id?: string
          channel?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          draft_message?: string | null
          id?: string
          kind?: string | null
          match_id?: string | null
          message_template?: string | null
          property_id?: string | null
          status?: string
          transaction_id?: string | null
          trigger_at?: string | null
          trigger_days?: number | null
          trigger_rule?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      rpc_receipts: {
        Row: {
          actor_user_id: string | null
          idempotency_key: string
          result_hash: string | null
          rpc: string
          ts: string
        }
        Insert: {
          actor_user_id?: string | null
          idempotency_key: string
          result_hash?: string | null
          rpc: string
          ts?: string
        }
        Update: {
          actor_user_id?: string | null
          idempotency_key?: string
          result_hash?: string | null
          rpc?: string
          ts?: string
        }
        Relationships: []
      }
      seller_leads: {
        Row: {
          assigned_agency_id: string | null
          comparable_count: number | null
          contact_email: string
          contact_id: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          estimation_confidence: string | null
          estimation_max: number | null
          estimation_median: number | null
          estimation_min: number | null
          estimation_price_per_m2: number | null
          id: string
          motivation: string | null
          property_data: Json
          property_id: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_agency_id?: string | null
          comparable_count?: number | null
          contact_email: string
          contact_id?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          estimation_confidence?: string | null
          estimation_max?: number | null
          estimation_median?: number | null
          estimation_min?: number | null
          estimation_price_per_m2?: number | null
          id?: string
          motivation?: string | null
          property_data?: Json
          property_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_agency_id?: string | null
          comparable_count?: number | null
          contact_email?: string
          contact_id?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          estimation_confidence?: string | null
          estimation_max?: number | null
          estimation_median?: number | null
          estimation_min?: number | null
          estimation_price_per_m2?: number | null
          id?: string
          motivation?: string | null
          property_data?: Json
          property_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_leads_assigned_agency_id_fkey"
            columns: ["assigned_agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_requests: {
        Row: {
          agency_id: string
          completed_at: string | null
          context_id: string | null
          context_type: string | null
          created_at: string | null
          created_by: string | null
          document_id: string | null
          id: string
          last_error: string | null
          legislation: string | null
          provider: string
          provider_document_id: string | null
          provider_request_id: string | null
          quality: string | null
          raw_status: Json | null
          sent_at: string | null
          signed_document_path: string | null
          signed_sha256: string | null
          signers: Json
          signing_url: string | null
          status: string
          title: string
          updated_at: string | null
          webhook_token: string | null
        }
        Insert: {
          agency_id: string
          completed_at?: string | null
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          created_by?: string | null
          document_id?: string | null
          id?: string
          last_error?: string | null
          legislation?: string | null
          provider: string
          provider_document_id?: string | null
          provider_request_id?: string | null
          quality?: string | null
          raw_status?: Json | null
          sent_at?: string | null
          signed_document_path?: string | null
          signed_sha256?: string | null
          signers?: Json
          signing_url?: string | null
          status?: string
          title: string
          updated_at?: string | null
          webhook_token?: string | null
        }
        Update: {
          agency_id?: string
          completed_at?: string | null
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          created_by?: string | null
          document_id?: string | null
          id?: string
          last_error?: string | null
          legislation?: string | null
          provider?: string
          provider_document_id?: string | null
          provider_request_id?: string | null
          quality?: string | null
          raw_status?: Json | null
          sent_at?: string | null
          signed_document_path?: string | null
          signed_sha256?: string | null
          signers?: Json
          signing_url?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          webhook_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          event_created: string
          event_id: string
          event_type: string
          received_at: string
        }
        Insert: {
          event_created: string
          event_id: string
          event_type: string
          received_at?: string
        }
        Update: {
          event_created?: string
          event_id?: string
          event_type?: string
          received_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          agency_id: string
          billing_period: string | null
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          interval: string | null
          last_invoice_status: string | null
          last_stripe_event_at: string | null
          mrr_chf: number | null
          plan: string
          price: number | null
          status: string
          stripe_customer_id: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          billing_period?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interval?: string | null
          last_invoice_status?: string | null
          last_stripe_event_at?: string | null
          mrr_chf?: number | null
          plan?: string
          price?: number | null
          status?: string
          stripe_customer_id: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          billing_period?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interval?: string | null
          last_invoice_status?: string | null
          last_stripe_event_at?: string | null
          mrr_chf?: number | null
          plan?: string
          price?: number | null
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          access_token: string
          agency_id: string | null
          assigned_to: string | null
          category: string
          closed_at: string | null
          contact_id: string | null
          created_at: string | null
          csat_comment: string | null
          csat_rating: number | null
          description: string | null
          first_responded_at: string | null
          id: string
          metadata: Json | null
          priority: string
          resolved_at: string | null
          sla_breached: boolean | null
          sla_first_response_due: string | null
          sla_resolution_due: string | null
          source: string | null
          status: string
          subject: string
          submitter_email: string
          submitter_name: string
          tags: string[] | null
          ticket_number: string
          updated_at: string | null
        }
        Insert: {
          access_token?: string
          agency_id?: string | null
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          csat_comment?: string | null
          csat_rating?: number | null
          description?: string | null
          first_responded_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          resolved_at?: string | null
          sla_breached?: boolean | null
          sla_first_response_due?: string | null
          sla_resolution_due?: string | null
          source?: string | null
          status?: string
          subject: string
          submitter_email: string
          submitter_name: string
          tags?: string[] | null
          ticket_number: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          agency_id?: string | null
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          csat_comment?: string | null
          csat_rating?: number | null
          description?: string | null
          first_responded_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          resolved_at?: string | null
          sla_breached?: boolean | null
          sla_first_response_due?: string | null
          sla_resolution_due?: string | null
          source?: string | null
          status?: string
          subject?: string
          submitter_email?: string
          submitter_name?: string
          tags?: string[] | null
          ticket_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          agency_id: string
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          agency_id: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Update: {
          agency_id?: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          agency_id: string
          archived_at: string | null
          assigned_to: string | null
          contact_buyer_id: string | null
          contact_seller_id: string | null
          created_at: string
          id: string
          mandate_type: Database["public"]["Enums"]["mandate_type"] | null
          market_listing_id: string | null
          notes: string | null
          price_final: number | null
          price_offered: number | null
          property_id: string | null
          stage: Database["public"]["Enums"]["transaction_stage"]
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          archived_at?: string | null
          assigned_to?: string | null
          contact_buyer_id?: string | null
          contact_seller_id?: string | null
          created_at?: string
          id?: string
          mandate_type?: Database["public"]["Enums"]["mandate_type"] | null
          market_listing_id?: string | null
          notes?: string | null
          price_final?: number | null
          price_offered?: number | null
          property_id?: string | null
          stage?: Database["public"]["Enums"]["transaction_stage"]
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          archived_at?: string | null
          assigned_to?: string | null
          contact_buyer_id?: string | null
          contact_seller_id?: string | null
          created_at?: string
          id?: string
          mandate_type?: Database["public"]["Enums"]["mandate_type"] | null
          market_listing_id?: string | null
          notes?: string | null
          price_final?: number | null
          price_offered?: number | null
          property_id?: string | null
          stage?: Database["public"]["Enums"]["transaction_stage"]
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_contact_buyer_id_fkey"
            columns: ["contact_buyer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_contact_seller_id_fkey"
            columns: ["contact_seller_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_market_listing_id_fkey"
            columns: ["market_listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_cache: {
        Row: {
          content_hash: string
          created_at: string
          lang: string
          translated_text: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          lang: string
          translated_text: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          lang?: string
          translated_text?: string
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          accepted_at: string
          consent_type: string
          id: string
          ip_hash: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          id?: string
          ip_hash?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          id?: string
          ip_hash?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          fingerprint: string
          first_seen_at: string
          id: string
          ip: string | null
          last_seen_at: string
          os: string | null
          session_id: string | null
          trusted: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          fingerprint: string
          first_seen_at?: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          os?: string | null
          session_id?: string | null
          trusted?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          fingerprint?: string
          first_seen_at?: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          os?: string | null
          session_id?: string | null
          trusted?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      verification_check_config: {
        Row: {
          check_type: string
          id: string
          is_veto: boolean
          valid_from: string
          valid_to: string | null
          weight: number
        }
        Insert: {
          check_type: string
          id?: string
          is_veto?: boolean
          valid_from?: string
          valid_to?: string | null
          weight: number
        }
        Update: {
          check_type?: string
          id?: string
          is_veto?: boolean
          valid_from?: string
          valid_to?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "verification_check_config_check_type_fkey"
            columns: ["check_type"]
            isOneToOne: false
            referencedRelation: "verification_check_types"
            referencedColumns: ["code"]
          },
        ]
      }
      verification_check_types: {
        Row: {
          code: string
          created_at: string
          label_fr: string
          scope: string
        }
        Insert: {
          code: string
          created_at?: string
          label_fr: string
          scope: string
        }
        Update: {
          code?: string
          created_at?: string
          label_fr?: string
          scope?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          agency_id: string
          agent_id: string | null
          ai_objections: Json | null
          bon: Json | null
          buyer_email: string | null
          buyer_message: string | null
          buyer_name: string | null
          buyer_phone: string | null
          completed_at: string | null
          contact_id: string
          created_at: string | null
          duration_minutes: number | null
          feedback_agent: string | null
          feedback_buyer: string | null
          feedback_sent: boolean | null
          group_id: string | null
          id: string
          manage_token: string | null
          property_id: string
          qualification: Json | null
          rapport: Json | null
          rating: number | null
          reminder_sent: boolean | null
          scheduled_at: string
          status: string
          transaction_id: string | null
          video_link: string | null
          video_platform: string | null
          visit_type: string | null
        }
        Insert: {
          agency_id: string
          agent_id?: string | null
          ai_objections?: Json | null
          bon?: Json | null
          buyer_email?: string | null
          buyer_message?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          completed_at?: string | null
          contact_id: string
          created_at?: string | null
          duration_minutes?: number | null
          feedback_agent?: string | null
          feedback_buyer?: string | null
          feedback_sent?: boolean | null
          group_id?: string | null
          id?: string
          manage_token?: string | null
          property_id: string
          qualification?: Json | null
          rapport?: Json | null
          rating?: number | null
          reminder_sent?: boolean | null
          scheduled_at: string
          status?: string
          transaction_id?: string | null
          video_link?: string | null
          video_platform?: string | null
          visit_type?: string | null
        }
        Update: {
          agency_id?: string
          agent_id?: string | null
          ai_objections?: Json | null
          bon?: Json | null
          buyer_email?: string | null
          buyer_message?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          completed_at?: string | null
          contact_id?: string
          created_at?: string | null
          duration_minutes?: number | null
          feedback_agent?: string | null
          feedback_buyer?: string | null
          feedback_sent?: boolean | null
          group_id?: string | null
          id?: string
          manage_token?: string | null
          property_id?: string
          qualification?: Json | null
          rapport?: Json | null
          rating?: number | null
          reminder_sent?: boolean | null
          scheduled_at?: string
          status?: string
          transaction_id?: string | null
          video_link?: string | null
          video_platform?: string | null
          visit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_agent_links: {
        Row: {
          agency_id: string | null
          created_at: string
          id: string
          morning_brief_enabled: boolean
          otp_attempts: number
          otp_expires_at: string | null
          otp_hash: string | null
          otp_sent_count: number
          otp_window_started_at: string | null
          pairing_code: string | null
          pairing_expires_at: string | null
          pending_number: string | null
          profile_id: string
          verified: boolean
          verified_at: string | null
          wa_number: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          id?: string
          morning_brief_enabled?: boolean
          otp_attempts?: number
          otp_expires_at?: string | null
          otp_hash?: string | null
          otp_sent_count?: number
          otp_window_started_at?: string | null
          pairing_code?: string | null
          pairing_expires_at?: string | null
          pending_number?: string | null
          profile_id: string
          verified?: boolean
          verified_at?: string | null
          wa_number?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          id?: string
          morning_brief_enabled?: boolean
          otp_attempts?: number
          otp_expires_at?: string | null
          otp_hash?: string | null
          otp_sent_count?: number
          otp_window_started_at?: string | null
          pairing_code?: string | null
          pairing_expires_at?: string | null
          pending_number?: string | null
          profile_id?: string
          verified?: boolean
          verified_at?: string | null
          wa_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_agent_links_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_agent_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_async_jobs: {
        Row: {
          agency_id: string | null
          args: Json
          claimed_at: string | null
          contact_id: string | null
          created_at: string
          expires_at: string
          id: string
          lang: string
          last_error: string | null
          profile_id: string
          result_summary: string | null
          retry_count: number
          status: string
          tool: string
          wa_agent_phone: string
        }
        Insert: {
          agency_id?: string | null
          args?: Json
          claimed_at?: string | null
          contact_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          lang?: string
          last_error?: string | null
          profile_id: string
          result_summary?: string | null
          retry_count?: number
          status?: string
          tool: string
          wa_agent_phone: string
        }
        Update: {
          agency_id?: string | null
          args?: Json
          claimed_at?: string | null
          contact_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          lang?: string
          last_error?: string | null
          profile_id?: string
          result_summary?: string | null
          retry_count?: number
          status?: string
          tool?: string
          wa_agent_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_async_jobs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_confirmation_log: {
        Row: {
          agency_id: string | null
          created_at: string
          id: string
          outcome: string
          profile_id: string
          tool: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          id?: string
          outcome: string
          profile_id: string
          tool: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          id?: string
          outcome?: string
          profile_id?: string
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_confirmation_log_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_consents: {
        Row: {
          agency_id: string | null
          contact_id: string | null
          created_at: string
          event: string
          id: string
          ip_hash: string | null
          legal_basis: string
          profile_id: string | null
          proof: Json | null
          purpose: string
          recorded_by: string | null
          scope: string
          source: string
          source_ref: string | null
          subject_kind: string
          wa_phone: string
        }
        Insert: {
          agency_id?: string | null
          contact_id?: string | null
          created_at?: string
          event: string
          id?: string
          ip_hash?: string | null
          legal_basis?: string
          profile_id?: string | null
          proof?: Json | null
          purpose?: string
          recorded_by?: string | null
          scope?: string
          source: string
          source_ref?: string | null
          subject_kind: string
          wa_phone: string
        }
        Update: {
          agency_id?: string | null
          contact_id?: string | null
          created_at?: string
          event?: string
          id?: string
          ip_hash?: string | null
          legal_basis?: string
          profile_id?: string | null
          proof?: Json | null
          purpose?: string
          recorded_by?: string | null
          scope?: string
          source?: string
          source_ref?: string | null
          subject_kind?: string
          wa_phone?: string
        }
        Relationships: []
      }
      whatsapp_conversation_insights: {
        Row: {
          agency_id: string
          commitments: Json
          contact_id: string
          crm_summary: string | null
          crm_summary_updated_at: string | null
          entities: Json
          generated_at: string
          id: string
          intent: string | null
          language: string | null
          model: string | null
          next_action: Json | null
          objections: Json
          rolling_summary: string | null
          sentiment: string | null
          source_last_message_at: string | null
          source_message_count: number
          summary: string | null
          urgency: string | null
        }
        Insert: {
          agency_id: string
          commitments?: Json
          contact_id: string
          crm_summary?: string | null
          crm_summary_updated_at?: string | null
          entities?: Json
          generated_at?: string
          id?: string
          intent?: string | null
          language?: string | null
          model?: string | null
          next_action?: Json | null
          objections?: Json
          rolling_summary?: string | null
          sentiment?: string | null
          source_last_message_at?: string | null
          source_message_count?: number
          summary?: string | null
          urgency?: string | null
        }
        Update: {
          agency_id?: string
          commitments?: Json
          contact_id?: string
          crm_summary?: string | null
          crm_summary_updated_at?: string | null
          entities?: Json
          generated_at?: string
          id?: string
          intent?: string | null
          language?: string | null
          model?: string | null
          next_action?: Json | null
          objections?: Json
          rolling_summary?: string | null
          sentiment?: string | null
          source_last_message_at?: string | null
          source_message_count?: number
          summary?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_insights_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_insights_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_cron_locks: {
        Row: {
          job: string
          locked_until: string
        }
        Insert: {
          job: string
          locked_until?: string
        }
        Update: {
          job?: string
          locked_until?: string
        }
        Relationships: []
      }
      whatsapp_daily_briefs: {
        Row: {
          brief_date: string
          confirmed_at: string | null
          profile_id: string
          sent_at: string
        }
        Insert: {
          brief_date: string
          confirmed_at?: string | null
          profile_id: string
          sent_at?: string
        }
        Update: {
          brief_date?: string
          confirmed_at?: string | null
          profile_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_daily_briefs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_followup_suggestions: {
        Row: {
          action: string
          agency_id: string
          contact_id: string
          created_at: string
          dedup_key: string
          due_at: string | null
          id: string
          kind: string
          owner: string
          reminder_id: string | null
          source_insight_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action: string
          agency_id: string
          contact_id: string
          created_at?: string
          dedup_key: string
          due_at?: string | null
          id?: string
          kind?: string
          owner?: string
          reminder_id?: string | null
          source_insight_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string
          agency_id?: string
          contact_id?: string
          created_at?: string
          dedup_key?: string
          due_at?: string | null
          id?: string
          kind?: string
          owner?: string
          reminder_id?: string | null
          source_insight_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_followup_suggestions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_followup_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_followup_suggestions_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_corrections: {
        Row: {
          agency_id: string | null
          agent_final: string
          contact_id: string | null
          created_at: string
          id: string
          megga_draft: string
          profile_id: string
        }
        Insert: {
          agency_id?: string | null
          agent_final: string
          contact_id?: string | null
          created_at?: string
          id?: string
          megga_draft: string
          profile_id: string
        }
        Update: {
          agency_id?: string | null
          agent_final?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          megga_draft?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_corrections_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_corrections_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_corrections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          agency_id: string | null
          body: string | null
          claimed_at: string | null
          contact_id: string | null
          created_at: string
          delivery_error: string | null
          direction: string
          id: string
          is_agent_error: boolean
          is_automated: boolean
          last_error: string | null
          media_id: string | null
          media_kind: string | null
          media_mime: string | null
          media_r2_key: string | null
          media_type: string | null
          media_url: string | null
          processing_status: string
          provider: string
          provider_message_id: string
          raw: Json | null
          retry_count: number
          sent_by_profile_id: string | null
          session_id: string | null
          status: string
          status_updated_at: string | null
          stop_handled_at: string | null
          transcript: string | null
          transcript_confidence: number | null
          transcript_lang: string | null
          wa_from: string
          wa_timestamp: string | null
          wa_to: string | null
        }
        Insert: {
          agency_id?: string | null
          body?: string | null
          claimed_at?: string | null
          contact_id?: string | null
          created_at?: string
          delivery_error?: string | null
          direction?: string
          id?: string
          is_agent_error?: boolean
          is_automated?: boolean
          last_error?: string | null
          media_id?: string | null
          media_kind?: string | null
          media_mime?: string | null
          media_r2_key?: string | null
          media_type?: string | null
          media_url?: string | null
          processing_status?: string
          provider?: string
          provider_message_id: string
          raw?: Json | null
          retry_count?: number
          sent_by_profile_id?: string | null
          session_id?: string | null
          status?: string
          status_updated_at?: string | null
          stop_handled_at?: string | null
          transcript?: string | null
          transcript_confidence?: number | null
          transcript_lang?: string | null
          wa_from: string
          wa_timestamp?: string | null
          wa_to?: string | null
        }
        Update: {
          agency_id?: string | null
          body?: string | null
          claimed_at?: string | null
          contact_id?: string | null
          created_at?: string
          delivery_error?: string | null
          direction?: string
          id?: string
          is_agent_error?: boolean
          is_automated?: boolean
          last_error?: string | null
          media_id?: string | null
          media_kind?: string | null
          media_mime?: string | null
          media_r2_key?: string | null
          media_type?: string | null
          media_url?: string | null
          processing_status?: string
          provider?: string
          provider_message_id?: string
          raw?: Json | null
          retry_count?: number
          sent_by_profile_id?: string | null
          session_id?: string | null
          status?: string
          status_updated_at?: string | null
          stop_handled_at?: string | null
          transcript?: string | null
          transcript_confidence?: number | null
          transcript_lang?: string | null
          wa_from?: string
          wa_timestamp?: string | null
          wa_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_sent_by_profile_id_fkey"
            columns: ["sent_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_notices: {
        Row: {
          agency_id: string | null
          id: string
          sent_at: string
          wa_phone: string
        }
        Insert: {
          agency_id?: string | null
          id?: string
          sent_at?: string
          wa_phone: string
        }
        Update: {
          agency_id?: string | null
          id?: string
          sent_at?: string
          wa_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_notices_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_optin_invites: {
        Row: {
          agency_id: string
          consent_id: string | null
          consumed_at: string | null
          consumed_message_id: string | null
          contact_id: string
          created_at: string
          expires_at: string
          id: string
          lang: string
          purpose: string
          sent_by: string | null
          shown_text: string
          wa_phone: string
        }
        Insert: {
          agency_id: string
          consent_id?: string | null
          consumed_at?: string | null
          consumed_message_id?: string | null
          contact_id: string
          created_at?: string
          expires_at: string
          id?: string
          lang?: string
          purpose?: string
          sent_by?: string | null
          shown_text: string
          wa_phone: string
        }
        Update: {
          agency_id?: string
          consent_id?: string | null
          consumed_at?: string | null
          consumed_message_id?: string | null
          contact_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          lang?: string
          purpose?: string
          sent_by?: string | null
          shown_text?: string
          wa_phone?: string
        }
        Relationships: []
      }
      whatsapp_pending_actions: {
        Row: {
          agency_id: string | null
          args: Json
          created_at: string
          expires_at: string
          id: string
          profile_id: string
          summary: string
          tool: string
          wa_number: string
        }
        Insert: {
          agency_id?: string | null
          args?: Json
          created_at?: string
          expires_at?: string
          id?: string
          profile_id: string
          summary: string
          tool: string
          wa_number: string
        }
        Update: {
          agency_id?: string | null
          args?: Json
          created_at?: string
          expires_at?: string
          id?: string
          profile_id?: string
          summary?: string
          tool?: string
          wa_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_pending_actions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_pending_actions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_recent_auto_actions: {
        Row: {
          agency_id: string | null
          created_at: string
          id: string
          payload_undo: Json
          profile_id: string
          tool: string
          undo_until: string
          undone_at: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          id?: string
          payload_undo: Json
          profile_id: string
          tool: string
          undo_until: string
          undone_at?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          id?: string
          payload_undo?: Json
          profile_id?: string
          tool?: string
          undo_until?: string
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_recent_auto_actions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_rejected_drafts: {
        Row: {
          agency_id: string | null
          contact_id: string
          created_at: string
          draft: string
          profile_id: string
        }
        Insert: {
          agency_id?: string | null
          contact_id: string
          created_at?: string
          draft: string
          profile_id: string
        }
        Update: {
          agency_id?: string | null
          contact_id?: string
          created_at?: string
          draft?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_rejected_drafts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_rejected_drafts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_rejected_drafts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_tool_usage: {
        Row: {
          agency_id: string | null
          created_at: string
          id: string
          outcome: string
          profile_id: string
          tier: string
          tool: string
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          id?: string
          outcome: string
          profile_id: string
          tier: string
          tool: string
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          id?: string
          outcome?: string
          profile_id?: string
          tier?: string
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_tool_usage_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cantonal_price_medians: {
        Row: {
          canton: string | null
          median_price_per_m2: number | null
          sample_size: number | null
          transaction_type: string | null
          type: string | null
        }
        Relationships: []
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      market_rent_stats: {
        Row: {
          canton: string | null
          city: string | null
          level: string | null
          median_loyer_m2: number | null
          n_comparables: number | null
          p25_loyer_m2: number | null
          p75_loyer_m2: number | null
          postal_code: string | null
          seg_key: string | null
          surface_band: string | null
          type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _agency_identity_completeness_error: {
        Args: { p_agency_id: string }
        Returns: string
      }
      _analytics_decomp: {
        Args: { p: Database["public"]["Enums"]["transaction_stage"] }
        Returns: string
      }
      _latest_person_verification_check: {
        Args: { p_check_type: string; p_related_person_id: string }
        Returns: {
          check_id: string
          check_result: string
        }[]
      }
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      accept_followup_suggestion: { Args: { p_id: string }; Returns: string }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      admin_ai_drift_dismiss: {
        Args: { p_drift_key: string; p_month: string }
        Returns: Json
      }
      admin_changelog_delete: { Args: { p_id: string }; Returns: Json }
      admin_changelog_publish: { Args: { p_id: string }; Returns: Json }
      admin_changelog_save: {
        Args: {
          p_content: string
          p_id: string
          p_idempotency_key: string
          p_title: string
          p_version: string
        }
        Returns: Json
      }
      admin_changelog_schedule: {
        Args: { p_id: string; p_when: string }
        Returns: Json
      }
      admin_changelog_unpublish: { Args: { p_id: string }; Returns: Json }
      admin_console_session_state: { Args: never; Returns: Json }
      admin_create_agency: {
        Args: {
          p_canton?: string
          p_city?: string
          p_name: string
          p_note?: string
          p_plan?: string
          p_solo?: boolean
        }
        Returns: string
      }
      admin_cron_adhoc_sweep: { Args: never; Returns: number }
      admin_cron_job_is_inert: { Args: { p_jobname: string }; Returns: boolean }
      admin_cron_run_now: {
        Args: {
          p_confirm?: boolean
          p_idempotency_key: string
          p_jobname: string
        }
        Returns: Json
      }
      admin_error: {
        Args: { p_code: string; p_details?: Json; p_message_fr: string }
        Returns: Json
      }
      admin_kyc_link_lookup: {
        Args: {
          p_motive_agency_id: string
          p_motive_ref: string
          p_query: string
        }
        Returns: Json
      }
      admin_kyc_link_regenerate: {
        Args: {
          p_idempotency_key: string
          p_link_id: string
          p_motive_agency_id: string
          p_motive_ref: string
        }
        Returns: Json
      }
      admin_kyc_query_normalize: { Args: { p_query: string }; Returns: string }
      admin_lock_entity: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: undefined
      }
      admin_log_chain_verify_job: { Args: never; Returns: undefined }
      admin_log_console_entry: { Args: { p_metadata?: Json }; Returns: string }
      admin_log_export: {
        Args: {
          p_family?: string
          p_from: string
          p_idempotency_key?: string
          p_to: string
        }
        Returns: Json
      }
      admin_log_impersonation: {
        Args: { p_action: string; p_metadata?: Json; p_target_id: string }
        Returns: string
      }
      admin_log_payload_v1: {
        Args: {
          p_action: string
          p_action_params: Json
          p_actor_label: string
          p_actor_user_id: string
          p_agency_id: string
          p_entity_id: string
          p_entity_label: string
          p_entity_type: string
          p_family: string
          p_id: string
          p_ip: unknown
          p_metadata: Json
          p_routine: boolean
          p_seq: number
          p_session_id: string
          p_severity: string
          p_ts: string
          p_user_agent: string
        }
        Returns: string
      }
      admin_log_verify_chain: {
        Args: { p_from?: number; p_to?: number }
        Returns: Json
      }
      admin_log_write: {
        Args: {
          p_action: string
          p_action_params?: Json
          p_actor_label?: string
          p_agency_id?: string
          p_entity_id?: string
          p_entity_label?: string
          p_entity_type?: string
          p_family: string
          p_ip?: unknown
          p_metadata?: Json
          p_routine?: boolean
          p_session_id?: string
          p_severity?: string
          p_user_agent?: string
        }
        Returns: string
      }
      admin_ok: { Args: { p_data?: Json }; Returns: Json }
      admin_outbox_claim: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          kind: string
          last_error: string | null
          next_retry_at: string
          payload: Json
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "outbox_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_outbox_enqueue: {
        Args: { p_kind: string; p_payload: Json }
        Returns: string
      }
      admin_outbox_settle: {
        Args: { p_error?: string; p_id: string; p_max?: number; p_ok: boolean }
        Returns: string
      }
      admin_overview: { Args: never; Returns: Json }
      admin_plan_pricing_drift: { Args: { p_catalogue: Json }; Returns: Json }
      admin_receipt_seal: {
        Args: { p_key: string; p_result: Json }
        Returns: undefined
      }
      admin_receipt_try: {
        Args: { p_key: string; p_rpc: string }
        Returns: boolean
      }
      admin_reject_agency_review: {
        Args: { p_agency_id: string; p_reason: string }
        Returns: Json
      }
      admin_relaunch_agency_review: {
        Args: { p_agency_id: string }
        Returns: Json
      }
      admin_request_agency_correction: {
        Args: { p_agency_id: string; p_reason: string }
        Returns: Json
      }
      admin_resolve_agency_id_document: {
        Args: { p_agency_id: string; p_check_id: string; p_result: string }
        Returns: Json
      }
      admin_security_entity: {
        Args: {
          p_agency_name: string
          p_entity_label: string
          p_entity_type: string
        }
        Returns: string
      }
      admin_security_window: { Args: { p_window?: string }; Returns: string }
      admin_set_agency_plan: {
        Args: {
          p_agency_id: string
          p_note?: string
          p_plan: string
          p_status?: string
        }
        Returns: Json
      }
      admin_set_agency_quotas: {
        Args: { p_agency_id: string; p_note?: string; p_quotas: Json }
        Returns: Json
      }
      admin_set_onboarding_call_outcome: {
        Args: { p_call_id: string; p_status: string }
        Returns: Json
      }
      admin_set_onboarding_host_active: {
        Args: { p_active: boolean; p_host_id: string }
        Returns: Json
      }
      admin_set_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: Json
      }
      admin_upsert_onboarding_host: {
        Args: {
          p_buffer_after_minutes?: number
          p_display_name: string
          p_duration_minutes?: number
          p_horizon_days?: number
          p_max_per_day?: number
          p_min_notice_hours?: number
          p_profile_id: string
          p_slot_minutes?: number
          p_timezone?: string
          p_weekly_hours?: Json
        }
        Returns: Json
      }
      admin_validate_agency_review: {
        Args: { p_agency_id: string }
        Returns: Json
      }
      agency_for_wa_business_number: {
        Args: { p_wa_to: string }
        Returns: string
      }
      agency_mrr: { Args: { p_agency_id: string }; Returns: number }
      agency_mrr_rule: {
        Args: {
          p_agency_status: string
          p_billing_period: string
          p_plan: string
          p_pricing: Json
          p_sub_status: string
        }
        Returns: number
      }
      analytics_cockpit: {
        Args: { p_period?: string; p_scope?: string }
        Returns: Json
      }
      analytics_funnel: {
        Args: { p_period?: string; p_scope?: string }
        Returns: Json
      }
      analytics_objectif: {
        Args: { p_period?: string; p_scope?: string }
        Returns: Json
      }
      analytics_set_target: { Args: { p_yearly: number }; Returns: undefined }
      append_property_photo: {
        Args: { p_agency_id: string; p_property_id: string; p_url: string }
        Returns: number
      }
      backlink_whatsapp_orphans_for_contact: {
        Args: { p_contact_id: string }
        Returns: number
      }
      book_kyc_appointment: {
        Args: {
          p_client_ip?: string
          p_client_note?: string
          p_client_user_agent?: string
          p_magic_link_id: string
          p_mode?: string
          p_starts_at: string
        }
        Returns: string
      }
      calculate_contact_scores: { Args: { p_agency?: string }; Returns: number }
      calculate_property_scores: {
        Args: { p_agency?: string }
        Returns: number
      }
      calculate_sla: {
        Args: { p_created_at: string; p_priority: string }
        Returns: {
          first_response_due: string
          resolution_due: string
        }[]
      }
      can_auto_send: {
        Args: { p_action_type: string; p_agent_id: string }
        Returns: boolean
      }
      cancel_kyc_appointment: {
        Args: { p_appointment_id: string; p_client_ip?: string }
        Returns: undefined
      }
      cancel_visit_by_token: { Args: { p_token: string }; Returns: boolean }
      changelog_publish_due: { Args: never; Returns: number }
      check_email_exists: { Args: { p_email: string }; Returns: boolean }
      claim_pending_role: { Args: never; Returns: string }
      claim_whatsapp_async_jobs: {
        Args: { p_batch?: number }
        Returns: {
          agency_id: string | null
          args: Json
          claimed_at: string | null
          contact_id: string | null
          created_at: string
          expires_at: string
          id: string
          lang: string
          last_error: string | null
          profile_id: string
          result_summary: string | null
          retry_count: number
          status: string
          tool: string
          wa_agent_phone: string
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_async_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_whatsapp_jobs: {
        Args: { p_batch?: number }
        Returns: {
          agency_id: string | null
          body: string | null
          claimed_at: string | null
          contact_id: string | null
          created_at: string
          delivery_error: string | null
          direction: string
          id: string
          is_agent_error: boolean
          is_automated: boolean
          last_error: string | null
          media_id: string | null
          media_kind: string | null
          media_mime: string | null
          media_r2_key: string | null
          media_type: string | null
          media_url: string | null
          processing_status: string
          provider: string
          provider_message_id: string
          raw: Json | null
          retry_count: number
          sent_by_profile_id: string | null
          session_id: string | null
          status: string
          status_updated_at: string | null
          stop_handled_at: string | null
          transcript: string | null
          transcript_confidence: number | null
          transcript_lang: string | null
          wa_from: string
          wa_timestamp: string | null
          wa_to: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "whatsapp_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_orphan_property_drafts: { Args: never; Returns: number }
      compute_agent_preferences: { Args: { p_agent_id: string }; Returns: Json }
      compute_platform_mrr_estimate: { Args: never; Returns: number }
      consume_wa_optin_invite: {
        Args: { p_invite_id: string; p_message_id?: string; p_wa_phone: string }
        Returns: string
      }
      cancel_whatsapp_number_verification: {
        Args: never
        Returns: undefined
      }
      confirm_whatsapp_number_verification: {
        Args: { p_code: string }
        Returns: {
          ok: boolean
          reason: string
        }[]
      }
      contact_next_action: {
        Args: { p_agency: string; p_contact: string }
        Returns: Json
      }
      count_market_by_canton: {
        Args: { p_context?: string }
        Returns: {
          canton: string
          count: number
        }[]
      }
      count_market_by_type: {
        Args: { p_context?: string }
        Returns: {
          count: number
          type: string
        }[]
      }
      count_market_listings: {
        Args: {
          p_budget_max?: number
          p_budget_min?: number
          p_cantons?: string[]
          p_city?: string
          p_margin?: number
          p_min_quality?: number
          p_tx: string
          p_types?: string[]
        }
        Returns: number
      }
      create_agency_and_join: {
        Args: {
          p_canton: string
          p_city: string
          p_name: string
          p_solo: boolean
        }
        Returns: string
      }
      create_lead_with_optional_deal: {
        Args: {
          p_budget_announced?: number
          p_create_deal?: boolean
          p_deal_notes?: string
          p_deal_role?: string
          p_deal_stage?: string
          p_email?: string
          p_first_name: string
          p_import_raw_text?: string
          p_last_name: string
          p_notes?: string
          p_phone?: string
          p_property_id?: string
          p_score?: string
          p_search_zones?: string[]
          p_source?: string
          p_tags?: string[]
          p_type?: string
        }
        Returns: Json
      }
      create_wa_optin_invite: {
        Args: {
          p_contact_id: string
          p_days?: number
          p_lang?: string
          p_purpose?: string
          p_sent_by?: string
          p_shown_text: string
        }
        Returns: {
          agency_id: string
          id: string
          wa_phone: string
        }[]
      }
      crm_offer_chain: {
        Args: { p_deal_id: string }
        Returns: {
          agency_id: string
          amount: number
          attachments: Json
          by_id: string
          by_label: string
          closing_date: string
          conditions: Json
          created_at: string
          currency: string
          deal_id: string
          deposit: number
          expires_at: string
          from_party: Database["public"]["Enums"]["crm_offer_party"]
          id: string
          kind: Database["public"]["Enums"]["crm_offer_kind"]
          notes: string
          parent_offer_id: string
          responded_at: string
          status: Database["public"]["Enums"]["crm_offer_status"]
        }[]
      }
      crm_visits_by_property: {
        Args: { p_property_id: string }
        Returns: {
          agency_id: string
          agent_id: string | null
          ai_objections: Json | null
          bon: Json | null
          buyer_email: string | null
          buyer_message: string | null
          buyer_name: string | null
          buyer_phone: string | null
          completed_at: string | null
          contact_id: string
          created_at: string | null
          duration_minutes: number | null
          feedback_agent: string | null
          feedback_buyer: string | null
          feedback_sent: boolean | null
          group_id: string | null
          id: string
          manage_token: string | null
          property_id: string
          qualification: Json | null
          rapport: Json | null
          rating: number | null
          reminder_sent: boolean | null
          scheduled_at: string
          status: string
          transaction_id: string | null
          video_link: string | null
          video_platform: string | null
          visit_type: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "visits"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      daily_matching_scan: { Args: never; Returns: undefined }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      email_send_allowed: {
        Args: { p_contact_id?: string; p_email: string; p_purpose?: string }
        Returns: {
          allowed: boolean
          reason: string
        }[]
      }
      enablelongtransactions: { Args: never; Returns: string }
      ensure_wa_inbound_lead: {
        Args: {
          p_agency_id: string
          p_first_name: string
          p_last_name: string
          p_phone: string
        }
        Returns: {
          contact_id: string
          created: boolean
        }[]
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      esign_secret_delete: { Args: { p_id: string }; Returns: undefined }
      esign_secret_read: { Args: { p_id: string }; Returns: string }
      esign_secret_store: {
        Args: { p_name: string; p_secret: string }
        Returns: string
      }
      estimate_property_price: {
        Args: {
          p_canton: string
          p_city?: string
          p_surface?: number
          p_type?: string
        }
        Returns: Json
      }
      expire_crm_offers_now: { Args: never; Returns: number }
      expire_knowledge_snippets: { Args: never; Returns: number }
      find_contact_duplicates: {
        Args: {
          p_email?: string
          p_first_name?: string
          p_last_name?: string
          p_phone?: string
        }
        Returns: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          match_kind: string
          match_priority: number
          phone: string
          type: string
          user_id: string
        }[]
      }
      flatfox_sync_health: { Args: never; Returns: Json }
      focus_top_matches: {
        Args: { p_limit?: number }
        Returns: {
          city: string
          contact_id: string
          contact_name: string
          kind: string
          kyc_days_to_expiry: number
          kyc_risk_high: boolean
          lead_score: number
          match_id: string
          property_photo: string
          property_price: number
          property_title: string
          reason_keys: string[]
          reasons_match_count: number
          score: number
        }[]
      }
      generate_whatsapp_pairing_code: { Args: never; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_admin_agencies: {
        Args: { p_agency_id?: string; p_limit?: number; p_offset?: number }
        Returns: {
          agents: number
          canton: string
          city: string
          current_period_end: string
          deals: number
          email: string
          id: string
          last: string
          logo_url: string
          mrr: number
          name: string
          phone: string
          plan: string
          properties: number
          score: number
          since: string
          slug: string
          status: string
          sub: string
          verification_status: string
        }[]
      }
      get_admin_agency_detail: { Args: { p_agency_id: string }; Returns: Json }
      get_admin_agency_invitations: {
        Args: { p_agency_id?: string; p_limit?: number }
        Returns: {
          agency_id: string
          agency_name: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          is_expired: boolean
          role: string
          status: string
        }[]
      }
      get_admin_agency_review_detail: {
        Args: { p_agency_id: string }
        Returns: {
          applicable_weight: number
          check_id: string
          check_type: string
          checked_at: string
          is_veto: boolean
          raw_response: Json
          related_person_id: string
          result: string
          source: string
        }[]
      }
      get_admin_agency_review_queue: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          agency_id: string
          agency_name: string
          country: string
          identity_submitted_at: string
          total_count: number
          verification_score: number
          verification_status: string
          verification_sweep_attempts: number
        }[]
      }
      get_admin_agency_usage: {
        Args: { p_agency_id: string }
        Returns: {
          active_properties: number
          ai_calls_month: number
          ai_cost_month_usd: number
          contacts_count: number
          last_activity_at: string
          storage_est_mb: number
          wa_messages_month: number
        }[]
      }
      get_admin_ai_costs: {
        Args: { p_months?: number }
        Returns: {
          agency_id: string
          agency_name: string
          calls: number
          cost_usd: number
          module: string
          month: string
          provider: string
          tokens_in: number
          tokens_out: number
        }[]
      }
      get_admin_ai_month: { Args: { p_months?: number }; Returns: Json }
      get_admin_compliance_stats: {
        Args: never
        Returns: {
          avg_completion: number
          pending: number
          screening_match: number
          total: number
        }[]
      }
      get_admin_consent_stats: { Args: never; Returns: Json }
      get_admin_cron_runs: {
        Args: { p_jobname?: string; p_limit?: number }
        Returns: {
          active: boolean
          duration_s: number
          end_time: string
          jobname: string
          message: string
          schedule: string
          start_time: string
          status: string
        }[]
      }
      get_admin_dashboard_stats: {
        Args: never
        Returns: {
          active_agencies: number
          active_properties: number
          active_transactions: number
          high_risk_kyc: number
          new_agencies_this_month: number
          new_users_this_month: number
          total_users: number
        }[]
      }
      get_admin_end_user_stats: { Args: never; Returns: Json }
      get_admin_integrations_health: { Args: never; Returns: Json }
      get_admin_kyc_funnel_30d: {
        Args: never
        Returns: {
          cases_opened: number
          cases_pending: number
          cases_validated: number
          links_expired: number
          links_opened: number
          links_sent: number
          links_submitted: number
          median_hours_open: number
          window_days: number
        }[]
      }
      get_admin_kyc_magic_links: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          agency_name: string
          confirmed_at: string
          contact_name: string
          expires_at: string
          id: string
          mode: string
          opened_at: string
          sent_at: string
          status: string
          uploaded_at: string
        }[]
      }
      get_admin_live_feed: {
        Args: {
          p_action?: string
          p_category?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          action: string
          actor_kind: string
          actor_label: string
          agency_id: string
          agency_name: string
          category: string
          entity_type: string
          id: string
          object_label: string
          severity: string
          total_count: number
          ts: string
        }[]
      }
      get_admin_moderation_stats: {
        Args: never
        Returns: {
          flags_this_month: number
          published_count: number
          removes_this_month: number
        }[]
      }
      get_admin_monitoring_health: {
        Args: never
        Returns: {
          api_requests_today: number
          db_limit_mb: number
          db_size_mb: number
          emails_sent_today: number
          errors_last_24h: number
          last_scraping_at: string
          storage_limit_mb: number
          storage_used_mb: number
        }[]
      }
      get_admin_onboarding_calls: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          agency_id: string
          agency_name: string
          agency_slug: string
          attendee_answers: Json
          attendee_note: string
          attendee_phone: string
          booked_by: string
          booked_by_email: string
          booked_by_name: string
          cancel_reason: string
          created_at: string
          duration_minutes: number
          host_id: string
          host_name: string
          id: string
          meeting_url: string
          rescheduled_count: number
          scheduled_at: string
          status: string
          verification_status: string
        }[]
      }
      get_admin_onboarding_hosts: {
        Args: never
        Returns: {
          buffer_after_minutes: number
          calendar_email: string
          created_at: string
          display_name: string
          duration_minutes: number
          horizon_days: number
          id: string
          is_active: boolean
          max_per_day: number
          min_notice_hours: number
          profile_email: string
          profile_id: string
          slot_minutes: number
          timezone: string
          upcoming_calls: number
          weekly_hours: Json
        }[]
      }
      get_admin_plans_board: { Args: never; Returns: Json }
      get_admin_quota_breaches: {
        Args: never
        Returns: {
          agency_id: string
          agency_name: string
          cap: number
          metric: string
          threshold_pct: number
          usage: number
        }[]
      }
      get_admin_security_counters: {
        Args: { p_window?: string }
        Returns: Json
      }
      get_admin_security_journal: {
        Args: {
          p_filter?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_window?: string
        }
        Returns: {
          action: string
          action_params: Json
          actor: string
          entity: string
          fam: string
          id: string
          meta: Json
          sev: string
          total_count: number
          ts: string
        }[]
      }
      get_admin_security_routine: {
        Args: { p_limit?: number; p_window?: string }
        Returns: {
          action: string
          action_params: Json
          actor: string
          entity: string
          id: string
          routine_total: number
          ts: string
        }[]
      }
      get_admin_syndication_health: { Args: never; Returns: Json }
      get_admin_usage_overview: {
        Args: never
        Returns: {
          active_properties: number
          agency_id: string
          agency_name: string
          ai_cost_month_usd: number
          caps: Json
          contacts_count: number
          last_activity_at: string
          plan: string
          status: string
          storage_est_mb: number
          wa_messages_month: number
        }[]
      }
      get_admin_user_activity: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          action: string
          agency_id: string
          category: string
          created_at: string
          entity_id: string
          entity_label: string
          entity_type: string
          id: string
          severity: string
        }[]
      }
      get_admin_users: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          agency: string
          agency_id: string
          avatar_url: string
          consents: Json
          deleted_at: string
          email: string
          id: string
          invited_at: string
          last: string
          marketing: boolean
          name: string
          never: boolean
          phone: string
          role: string
          since: string
          stale_days: number
          suspended: boolean
        }[]
      }
      get_admin_whatsapp_health: { Args: never; Returns: Json }
      get_agency_activity_summary: {
        Args: { agency_ids: string[]; since_days?: number }
        Returns: {
          agency_id: string
          event_count: number
          last_activity_at: string
        }[]
      }
      get_agency_stats: {
        Args: { agency_ids: string[] }
        Returns: {
          agency_id: string
          agent_count: number
          property_count: number
          transaction_count: number
        }[]
      }
      get_agency_verification_config: { Args: never; Returns: Json }
      get_agent_changelog: {
        Args: { p_limit?: number }
        Returns: {
          content: string
          id: string
          published_at: string
          title: string
          version: string
        }[]
      }
      get_agent_learned_styles: {
        Args: never
        Returns: {
          agency_id: string
          agent_id: string
          agent_name: string
          learned_style: Json
        }[]
      }
      get_app_config: { Args: { config_key: string }; Returns: string }
      get_cities_by_canton: {
        Args: { p_canton: string; p_context?: string }
        Returns: {
          city: string
          count: number
        }[]
      }
      get_contact_next_action: { Args: { p_contact: string }; Returns: Json }
      get_contact_score_config: { Args: never; Returns: Json }
      get_cron_health: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          last_start: string
          last_status: string
          schedule: string
        }[]
      }
      get_kyc_appointment_public: {
        Args: { p_appointment_id: string }
        Returns: Json
      }
      get_market_map_points: {
        Args: {
          p_canton?: string
          p_city?: string
          p_context?: string
          p_features?: string[]
          p_max_price?: number
          p_min_price?: number
          p_min_rooms?: number
          p_min_surface?: number
          p_types?: string[]
        }
        Returns: {
          current_price: number
          id: string
          lat: number
          lng: number
          price: number
          rooms: number
          transaction_type: string
          type: string
        }[]
      }
      get_market_rent_reference_config: { Args: never; Returns: Json }
      get_my_agency_id: { Args: never; Returns: string }
      get_my_agency_plan: { Args: never; Returns: string }
      get_onboarding_call_by_token: { Args: { p_token: string }; Returns: Json }
      get_onboarding_milestones: {
        Args: { agency_ids: string[] }
        Returns: {
          agency_id: string
          has_contact: boolean
          has_kyc: boolean
          has_match: boolean
          has_property: boolean
          has_transaction: boolean
          last_activity_at: string
        }[]
      }
      get_price_hexagons: {
        Args: {
          p_hex_size_m: number
          p_max_lat: number
          p_max_lng: number
          p_min_count?: number
          p_min_lat: number
          p_min_lng: number
          p_transaction_type?: string
          p_types?: string[]
        }
        Returns: {
          geom: Json
          hex_id: string
          listing_count: number
          median_price_m2: number
          p25_price_m2: number
          p75_price_m2: number
        }[]
      }
      get_property_score_config: { Args: never; Returns: Json }
      get_signup_trigger_count: { Args: never; Returns: number }
      get_today_focus_config: { Args: never; Returns: Json }
      get_user_agency_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      get_visit_by_token: { Args: { p_token: string }; Returns: Json }
      get_whatsapp_autonomy_suggestions: {
        Args: never
        Returns: {
          agency_id: string
          agent_name: string
          autonomy: string
          last_no_at: string
          no_count: number
          profile_id: string
          suggest_resume: boolean
          tool: string
          yes_count: number
        }[]
      }
      get_whatsapp_deadletter_metrics: { Args: never; Returns: Json }
      get_whatsapp_tool_usage_stats: {
        Args: { p_known_tools?: string[] }
        Returns: {
          error_count: number
          error_rate: number
          last_used_at: string
          tool: string
          total_calls: number
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      hourly_automation_scan: { Args: never; Returns: undefined }
      insert_internal_matches: {
        Args: { p_rows: Json }
        Returns: {
          agency_id: string
          client_search_id: string | null
          contact_id: string
          created_at: string | null
          id: string
          market_listing_id: string | null
          property_id: string | null
          reaction_motif: string | null
          reaction_note: string | null
          reasons: Json | null
          response_at: string | null
          score: number
          score_version: number | null
          sent_at: string | null
          sent_via: string | null
          snoozed_until: string | null
          source: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      insert_market_matches: {
        Args: { p_rows: Json }
        Returns: {
          agency_id: string
          client_search_id: string | null
          contact_id: string
          created_at: string | null
          id: string
          market_listing_id: string | null
          property_id: string | null
          reaction_motif: string | null
          reaction_note: string | null
          reasons: Json | null
          response_at: string | null
          score: number
          score_version: number | null
          sent_at: string | null
          sent_via: string | null
          snoozed_until: string | null
          source: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_agency_admin: { Args: never; Returns: boolean }
      is_agency_lab_cleared: { Args: { p_agency_id: string }; Returns: boolean }
      is_service_role: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_within_sla_window: {
        Args: { p_agent_id: string; p_at?: string }
        Returns: boolean
      }
      join_agency: { Args: { p_agency_id: string }; Returns: undefined }
      kyb_identity_files: {
        Args: never
        Returns: {
          agency_id: string
          latest_result: string
          purge_due: boolean
          purge_reason: string
          related_person_id: string
          storage_path: string
          uploaded_at: string
        }[]
      }
      kyb_identity_orphans: {
        Args: never
        Returns: {
          storage_path: string
          uploaded_at: string
        }[]
      }
      kyb_identity_retention_days: { Args: never; Returns: number }
      kyc_booking_busy_ranges: {
        Args: {
          p_agent_id: string
          p_exclude_id?: string
          p_from: string
          p_to: string
        }
        Returns: {
          ends_at: string
          source: string
          starts_at: string
        }[]
      }
      kyc_by_contact_id: {
        Args: { p_contact_id: string }
        Returns: {
          agency_id: string
          checks_completed: number
          checks_total: number
          contact_id: string
          created_at: string
          dossier_status: string
          expires_at: string
          id: string
          last_screening_at: string
          pep_status: string
          risk_level: Database["public"]["Enums"]["kyc_risk_level"]
          risk_score: number
          sanctions_status: string
          transaction_id: string
          type: Database["public"]["Enums"]["kyc_person_type"]
          validated_at: string
          vigilance: string
        }[]
      }
      kyc_count_by_status: { Args: never; Returns: Json }
      kyc_latest_screening_decision: {
        Args: { p_kyc_case_id: string; p_target: string }
        Returns: {
          decided_at: string
          decided_by: string
          decision: string
          id: string
          justification: string
        }[]
      }
      kyc_magic_link_summary: {
        Args: { p_kyc_case_id: string }
        Returns: {
          channels: string[]
          confirmed_at: string
          expires_at: string
          id: string
          mode: Database["public"]["Enums"]["kyc_magic_link_mode"]
          opened_at: string
          sent_at: string
          status: Database["public"]["Enums"]["kyc_magic_link_status"]
          uploads_count: number
        }[]
      }
      kyc_slot_rejection: {
        Args: {
          p_agent_id: string
          p_ends_at: string
          p_exclude_id?: string
          p_starts_at: string
        }
        Returns: string
      }
      log_auth_event_limited: {
        Args: {
          p_action: string
          p_detail?: string
          p_ip_hash: string
          p_severity: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: string
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_stale_kyc_dossiers: {
        Args: never
        Returns: {
          id: string
        }[]
      }
      mark_suppression_ack_sent: {
        Args: { p_wa_phone: string }
        Returns: undefined
      }
      match_candidate_listings: {
        Args: {
          p_budget_max?: number
          p_budget_min?: number
          p_cantons?: string[]
          p_city?: string
          p_limit?: number
          p_margin?: number
          p_min_quality?: number
          p_tx: string
          p_types?: string[]
        }
        Returns: {
          canton: string
          city: string
          current_price: number
          features: Json
          id: string
          lat: number
          lng: number
          price: number
          price_at_first_seen: number
          rooms: number
          status: string
          surface_m2: number
          transaction_type: string
          type: string
        }[]
      }
      megga_agency_slug: { Args: { p_name: string }; Returns: string }
      ml_extract_rooms: {
        Args: { p_description: string; p_type: string }
        Returns: number
      }
      ml_extract_surface_m2: {
        Args: { p_description: string; p_type: string }
        Returns: number
      }
      normalize_legal_form_text: { Args: { p_text: string }; Returns: string }
      normalize_phone: { Args: { p_phone: string }; Returns: string }
      pending_consents: {
        Args: never
        Returns: {
          consent_type: string
          version: string
        }[]
      }
      pg_cron_installe: { Args: never; Returns: boolean }
      pg_database_size_mb: { Args: never; Returns: number }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      presence_touch: { Args: never; Returns: string }
      provision_solo_agency: {
        Args: { p_display_name: string; p_user: string }
        Returns: string
      }
      purge_activity_events_retention: { Args: never; Returns: number }
      purge_expired_import_raw_text: { Args: never; Returns: number }
      purge_stale_market_matches: { Args: never; Returns: number }
      realadvisor_fill_agency_logos: { Args: never; Returns: number }
      realadvisor_health_check: { Args: never; Returns: Json }
      realadvisor_probe_bookkeep: {
        Args: {
          p_absent: string[]
          p_min_gap_hours?: number
          p_present: string[]
        }
        Returns: undefined
      }
      realadvisor_probe_collect: { Args: never; Returns: Json }
      realadvisor_probe_fire: {
        Args: { p_batches?: number; p_offer_type?: string }
        Returns: number
      }
      realadvisor_probe_sweep: {
        Args: {
          p_apply?: boolean
          p_cap_abs?: number
          p_cap_pct?: number
          p_min_age_hours?: number
          p_offer_type?: string
          p_threshold?: number
        }
        Returns: Json
      }
      realadvisor_revive_collect: {
        Args: { p_max_revive?: number }
        Returns: Json
      }
      realadvisor_revive_fire: {
        Args: {
          p_batches?: number
          p_min_gap_days?: number
          p_offer_type?: string
          p_window_days?: number
        }
        Returns: number
      }
      realadvisor_sweep_enum: {
        Args: {
          p_apply?: boolean
          p_cap_abs?: number
          p_cap_pct?: number
          p_offer_type?: string
          p_window_days?: number
        }
        Returns: Json
      }
      recompute_agency_activation: {
        Args: { p_agency_id?: string }
        Returns: number
      }
      recompute_agency_verification: {
        Args: { p_agency_id: string }
        Returns: undefined
      }
      reconcile_wa_consent_cache: { Args: never; Returns: number }
      record_agency_verification_run: {
        Args: {
          p_agency_id: string
          p_checks: Json
          p_metadata: Json
          p_person_checks?: Json
          p_severity: string
        }
        Returns: undefined
      }
      record_buyer_reaction: {
        Args: {
          p_link_id: string
          p_match_id: string
          p_motif?: string
          p_note?: string
          p_reaction: string
        }
        Returns: undefined
      }
      record_consent: {
        Args: { p_type: string; p_version?: string }
        Returns: undefined
      }
      record_whatsapp_consent: {
        Args: {
          p_agency_id?: string
          p_contact_id?: string
          p_event: string
          p_kind: string
          p_legal_basis?: string
          p_profile_id?: string
          p_proof?: Json
          p_purpose?: string
          p_recorded_by?: string
          p_scope?: string
          p_source: string
          p_source_ref?: string
          p_wa_phone: string
        }
        Returns: string
      }
      redact_whatsapp_consent: { Args: { p_wa_phone: string }; Returns: number }
      reschedule_kyc_appointment: {
        Args: {
          p_appointment_id: string
          p_client_ip?: string
          p_new_starts_at: string
        }
        Returns: undefined
      }
      reschedule_visit_by_token: {
        Args: { p_new_at: string; p_token: string }
        Returns: boolean
      }
      resolve_contact_by_phone: {
        Args: { p_phone: string }
        Returns: {
          agency_id: string
          id: string
        }[]
      }
      revoke_reception_link: { Args: { p_link_id: string }; Returns: boolean }
      revoke_user_session: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: undefined
      }
      search_cities: {
        Args: { p_limit?: number; p_prefix: string; p_tx?: string }
        Returns: {
          canton: string
          city: string
          n: number
        }[]
      }
      search_directory: {
        Args: {
          filter_canton?: string
          filter_city?: string
          filter_languages?: string[]
          filter_specialties?: string[]
          filter_verified?: boolean
          page_number?: number
          page_size?: number
          search_query?: string
          search_type?: string
          sort_by?: string
        }
        Returns: Json
      }
      search_market_listings: {
        Args: {
          p_budget_max?: number
          p_budget_min?: number
          p_cantons?: string[]
          p_city?: string
          p_limit?: number
          p_margin?: number
          p_min_quality?: number
          p_tx: string
          p_types?: string[]
        }
        Returns: {
          created_at: string
          id: string
        }[]
      }
      set_agent_learned_style: {
        Args: { p_agent_id: string; p_status: string; p_traits?: string }
        Returns: undefined
      }
      set_morning_brief_enabled: {
        Args: { p_enabled: boolean }
        Returns: undefined
      }
      slugify: { Args: { input: string }; Returns: string }
      soft_delete_property: {
        Args: { p_property_id: string }
        Returns: boolean
      }
      start_whatsapp_number_verification: {
        Args: { p_number: string; p_profile_id: string }
        Returns: {
          code: string
          ok: boolean
          reason: string
        }[]
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      storage_size_mb: { Args: never; Returns: number }
      submit_agency_identity: {
        Args: { p_related_person_id?: string }
        Returns: undefined
      }
      submit_visit_feedback_by_token: {
        Args: {
          p_ai: Json
          p_comment: string
          p_rating: number
          p_token: string
        }
        Returns: boolean
      }
      super_admin_allowlist: { Args: never; Returns: string[] }
      super_admin_allowlist_match: {
        Args: { p_email: string }
        Returns: boolean
      }
      suppress_agency_logo_collisions: {
        Args: { sim_threshold?: number }
        Returns: number
      }
      suppress_contact_email: {
        Args: {
          p_agency_id?: string
          p_contact_id?: string
          p_email: string
          p_source_ref?: string
        }
        Returns: string
      }
      suppress_contact_phone: {
        Args: {
          p_agency_id?: string
          p_channel: string
          p_reason: string
          p_source_ref?: string
          p_wa_phone: string
        }
        Returns: string
      }
      sweep_pending_agency_verifications: { Args: never; Returns: undefined }
      team_remove_member: { Args: { p_member_id: string }; Returns: undefined }
      team_role_rank: { Args: { p_role: string }; Returns: number }
      team_set_member_role: {
        Args: { p_member_id: string; p_role: string }
        Returns: undefined
      }
      today_absence: { Args: { p_fallback_hours?: number }; Returns: Json }
      unaccent: { Args: { "": string }; Returns: string }
      unlink_whatsapp_number: { Args: never; Returns: undefined }
      unlockrows: { Args: { "": string }; Returns: number }
      unpublish_expired_mandates: { Args: never; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      wa_move_transaction_stage: {
        Args: {
          p_agency_id: string
          p_profile_id?: string
          p_stage: Database["public"]["Enums"]["transaction_stage"]
          p_transaction_id: string
        }
        Returns: number
      }
      wa_msg_is_foreign_agent_thread: {
        Args: { p_wa_from: string; p_wa_to: string }
        Returns: boolean
      }
      weekly_digest_scan: { Args: never; Returns: undefined }
      whatsapp_median_response_hour: {
        Args: { p_contact_id: string }
        Returns: {
          median_hour: number
          n: number
        }[]
      }
      whatsapp_pending_notices: {
        Args: { p_limit?: number }
        Returns: {
          agency_id: string
          wa_phone: string
        }[]
      }
      whatsapp_send_allowed: {
        Args: {
          p_agency_id?: string
          p_contact_id?: string
          p_profile_id?: string
          p_purpose?: string
          p_scope?: string
          p_wa_phone: string
          p_window_margin_minutes?: number
        }
        Returns: {
          allowed: boolean
          in_24h_window: boolean
          legal_basis: string
          public_reason: string
          reason: string
          subject_kind: string
        }[]
      }
      whatsapp_stale_insight_contacts: {
        Args: { p_limit?: number }
        Returns: {
          agency_id: string
          contact_id: string
          last_message_at: string
        }[]
      }
    }
    Enums: {
      crm_offer_kind: "offer" | "counter"
      crm_offer_party: "buyer" | "seller"
      crm_offer_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "expired"
        | "withdrawn"
      invitation_status: "pending" | "accepted" | "cancelled" | "expired"
      kyc_magic_link_mode: "libre" | "verifiee"
      kyc_magic_link_status:
        | "pending"
        | "opened"
        | "uploading"
        | "verifying"
        | "submitted"
        | "expired"
      kyc_magic_link_upload_type: "identity" | "address" | "funds" | "other"
      kyc_person_type: "buyer_pp" | "buyer_pm" | "seller_pp" | "seller_pm"
      kyc_risk_level: "low" | "medium" | "high" | "unassessed"
      kyc_source_of_funds_type:
        | "salary"
        | "sale_property"
        | "sale_business"
        | "inheritance"
        | "investment"
        | "crypto"
        | "loan"
        | "mixed"
        | "other"
      kyc_status:
        | "pending"
        | "in_progress"
        | "review"
        | "validated"
        | "rejected"
      mandate_type: "simple" | "semi_exclusive" | "exclusive"
      property_status: "draft" | "active" | "reserved" | "sold" | "archived"
      property_type: "apartment" | "house" | "villa" | "commercial" | "land"
      transaction_stage:
        | "lead"
        | "qualified"
        | "visit_planned"
        | "offer"
        | "negotiation"
        | "reserved"
        | "financing"
        | "notary"
        | "signed"
        | "closed"
        | "new_lead"
        | "to_qualify"
        | "active_search"
        | "visit_done"
        | "interest_confirmed"
        | "lost"
        | "to_recontact"
        | "visit_planned_legacy"
      transaction_status: "active" | "on_hold" | "cancelled" | "completed"
      user_role:
        | "buyer"
        | "seller"
        | "agent"
        | "manager"
        | "admin"
        | "assistant"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      crm_offer_kind: ["offer", "counter"],
      crm_offer_party: ["buyer", "seller"],
      crm_offer_status: [
        "pending",
        "accepted",
        "rejected",
        "expired",
        "withdrawn",
      ],
      invitation_status: ["pending", "accepted", "cancelled", "expired"],
      kyc_magic_link_mode: ["libre", "verifiee"],
      kyc_magic_link_status: [
        "pending",
        "opened",
        "uploading",
        "verifying",
        "submitted",
        "expired",
      ],
      kyc_magic_link_upload_type: ["identity", "address", "funds", "other"],
      kyc_person_type: ["buyer_pp", "buyer_pm", "seller_pp", "seller_pm"],
      kyc_risk_level: ["low", "medium", "high", "unassessed"],
      kyc_source_of_funds_type: [
        "salary",
        "sale_property",
        "sale_business",
        "inheritance",
        "investment",
        "crypto",
        "loan",
        "mixed",
        "other",
      ],
      kyc_status: ["pending", "in_progress", "review", "validated", "rejected"],
      mandate_type: ["simple", "semi_exclusive", "exclusive"],
      property_status: ["draft", "active", "reserved", "sold", "archived"],
      property_type: ["apartment", "house", "villa", "commercial", "land"],
      transaction_stage: [
        "lead",
        "qualified",
        "visit_planned",
        "offer",
        "negotiation",
        "reserved",
        "financing",
        "notary",
        "signed",
        "closed",
        "new_lead",
        "to_qualify",
        "active_search",
        "visit_done",
        "interest_confirmed",
        "lost",
        "to_recontact",
        "visit_planned_legacy",
      ],
      transaction_status: ["active", "on_hold", "cancelled", "completed"],
      user_role: ["buyer", "seller", "agent", "manager", "admin", "assistant"],
    },
  },
} as const
