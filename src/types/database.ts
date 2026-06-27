export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      admin_changelog: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          id: string
          published: boolean
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
      admin_notes: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          address: string | null
          billing: string | null
          canton: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          logo_url: string | null
          monthly_target: number | null
          name: string
          phone: string | null
          plan: Database["public"]["Enums"]["agency_plan"]
          quarterly_target: number | null
          slug: string
          solo: boolean | null
          status: string | null
          stripe_customer_id: string | null
          website: string | null
          yearly_target: number | null
          about_short: string | null
          country: string | null
          founded_year: number | null
          ide: string | null
          legal_name: string | null
          postal_code: string | null
          tva: string | null
        }
        Insert: {
          address?: string | null
          billing?: string | null
          canton?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          monthly_target?: number | null
          name: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["agency_plan"]
          quarterly_target?: number | null
          slug: string
          solo?: boolean | null
          status?: string | null
          stripe_customer_id?: string | null
          website?: string | null
          yearly_target?: number | null
          about_short?: string | null
          country?: string | null
          founded_year?: number | null
          ide?: string | null
          legal_name?: string | null
          postal_code?: string | null
          tva?: string | null
        }
        Update: {
          address?: string | null
          billing?: string | null
          canton?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          monthly_target?: number | null
          name?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["agency_plan"]
          quarterly_target?: number | null
          slug?: string
          solo?: boolean | null
          status?: string | null
          stripe_customer_id?: string | null
          website?: string | null
          yearly_target?: number | null
          about_short?: string | null
          country?: string | null
          founded_year?: number | null
          ide?: string | null
          legal_name?: string | null
          postal_code?: string | null
          tva?: string | null
        }
        Relationships: []
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
      agent_reviews: {
        Row: {
          agent_profile_id: string
          agent_responded_at: string | null
          agent_response: string | null
          comment: string | null
          created_at: string | null
          id: string
          is_verified: boolean | null
          moderated_at: string | null
          rating_local_knowledge: number
          rating_negotiation: number
          rating_overall: number | null
          rating_process_expertise: number
          rating_responsiveness: number
          reviewer_contact_id: string | null
          reviewer_email: string | null
          reviewer_name: string
          status: string
        }
        Insert: {
          agent_profile_id: string
          agent_responded_at?: string | null
          agent_response?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          moderated_at?: string | null
          rating_local_knowledge: number
          rating_negotiation: number
          rating_overall?: number | null
          rating_process_expertise: number
          rating_responsiveness: number
          reviewer_contact_id?: string | null
          reviewer_email?: string | null
          reviewer_name: string
          status?: string
        }
        Update: {
          agent_profile_id?: string
          agent_responded_at?: string | null
          agent_response?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          moderated_at?: string | null
          rating_local_knowledge?: number
          rating_negotiation?: number
          rating_overall?: number | null
          rating_process_expertise?: number
          rating_responsiveness?: number
          reviewer_contact_id?: string | null
          reviewer_email?: string | null
          reviewer_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_reviews_agent_profile_id_fkey"
            columns: ["agent_profile_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_reviews_reviewer_contact_id_fkey"
            columns: ["reviewer_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_actions_queue: {
        Row: {
          action_type: string
          agency_id: string
          agent_id: string
          autonomy_required: string
          created_at: string
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string
          expires_at: string | null
          id: string
          payload: Json
          scheduled_at: string
          sent_at: string | null
          source_event_id: string | null
          status: string
          updated_at: string
          validated_by: string | null
        }
        Insert: {
          action_type: string
          agency_id: string
          agent_id: string
          autonomy_required?: string
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type: string
          expires_at?: string | null
          id?: string
          payload?: Json
          scheduled_at?: string
          sent_at?: string | null
          source_event_id?: string | null
          status?: string
          updated_at?: string
          validated_by?: string | null
        }
        Update: {
          action_type?: string
          agency_id?: string
          agent_id?: string
          autonomy_required?: string
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string
          expires_at?: string | null
          id?: string
          payload?: Json
          scheduled_at?: string
          sent_at?: string | null
          source_event_id?: string | null
          status?: string
          updated_at?: string
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_queue_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_actions_queue_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_actions_queue_validated_by_fkey"
            columns: ["validated_by"]
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
      ai_usage_logs: {
        Row: {
          created_at: string
          edge_function: string
          estimated_cost_usd: number
          id: string
          input_tokens: number
          output_tokens: number
          provider: string
          was_fallback: boolean
        }
        Insert: {
          created_at?: string
          edge_function: string
          estimated_cost_usd: number
          id?: string
          input_tokens: number
          output_tokens: number
          provider: string
          was_fallback?: boolean
        }
        Update: {
          created_at?: string
          edge_function?: string
          estimated_cost_usd?: number
          id?: string
          input_tokens?: number
          output_tokens?: number
          provider?: string
          was_fallback?: boolean
        }
        Relationships: []
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
      article_feedback: {
        Row: {
          article_slug: string
          comment: string | null
          created_at: string | null
          helpful: boolean
          id: string
          user_id: string | null
        }
        Insert: {
          article_slug: string
          comment?: string | null
          created_at?: string | null
          helpful: boolean
          id?: string
          user_id?: string | null
        }
        Update: {
          article_slug?: string
          comment?: string | null
          created_at?: string | null
          helpful?: boolean
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      article_views: {
        Row: {
          article_slug: string
          created_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          article_slug: string
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          article_slug?: string
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
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
      chat_conversations: {
        Row: {
          accepted_at: string | null
          category: string | null
          conversation_ref: string
          created_at: string | null
          id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          category?: string | null
          conversation_ref: string
          created_at?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          category?: string | null
          conversation_ref?: string
          created_at?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
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
      coming_soon_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          locale: string
          source: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          locale?: string
          source?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          locale?: string
          source?: string
          user_agent?: string | null
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
          reactivity_score: number | null
          rejection_patterns: Json | null
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
          reactivity_score?: number | null
          rejection_patterns?: Json | null
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
          reactivity_score?: number | null
          rejection_patterns?: Json | null
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
      contacts: {
        Row: {
          agency_id: string | null
          created_at: string | null
          deleted_user_id: string | null
          email: string
          entity_type: string
          first_name: string
          form_data: Json | null
          id: string
          import_raw_text: string | null
          import_raw_text_received_at: string | null
          last_interaction_at: string | null
          last_name: string
          notes: string | null
          phone: string | null
          score: string | null
          search_criteria: Json | null
          source: string
          tags: string[] | null
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string | null
          deleted_user_id?: string | null
          email: string
          entity_type?: string
          first_name: string
          form_data?: Json | null
          id?: string
          import_raw_text?: string | null
          import_raw_text_received_at?: string | null
          last_interaction_at?: string | null
          last_name: string
          notes?: string | null
          phone?: string | null
          score?: string | null
          search_criteria?: Json | null
          source?: string
          tags?: string[] | null
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string | null
          deleted_user_id?: string | null
          email?: string
          entity_type?: string
          first_name?: string
          form_data?: Json | null
          id?: string
          import_raw_text?: string | null
          import_raw_text_received_at?: string | null
          last_interaction_at?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          score?: string | null
          search_criteria?: Json | null
          source?: string
          tags?: string[] | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      daily_actions: {
        Row: {
          action_type: string | null
          agency_id: string
          agent_id: string
          category: string
          completed_at: string | null
          description: string | null
          entity_id: string | null
          entity_type: string | null
          generated_at: string | null
          id: string
          is_completed: boolean | null
          priority: string
          title: string
        }
        Insert: {
          action_type?: string | null
          agency_id: string
          agent_id: string
          category: string
          completed_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          generated_at?: string | null
          id?: string
          is_completed?: boolean | null
          priority: string
          title: string
        }
        Update: {
          action_type?: string | null
          agency_id?: string
          agent_id?: string
          category?: string
          completed_at?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          generated_at?: string | null
          id?: string
          is_completed?: boolean | null
          priority?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_actions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_actions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          size_bytes?: number
          status?: string
          storage_path?: string
          transaction_id?: string | null
          type?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages_cache: {
        Row: {
          ai_classification: string | null
          ai_classified_at: string | null
          ai_intents: Json | null
          ai_priority: number | null
          ai_suggested_replies: Json | null
          cc_addresses: string[] | null
          contact_id: string | null
          external_message_id: string
          external_thread_id: string | null
          fetched_at: string | null
          from_address: string | null
          from_name: string | null
          has_attachments: boolean | null
          id: string
          is_unread: boolean | null
          provider: string
          sent_at: string
          snippet: string | null
          subject: string | null
          to_addresses: string[] | null
          user_id: string
        }
        Insert: {
          ai_classification?: string | null
          ai_classified_at?: string | null
          ai_intents?: Json | null
          ai_priority?: number | null
          ai_suggested_replies?: Json | null
          cc_addresses?: string[] | null
          contact_id?: string | null
          external_message_id: string
          external_thread_id?: string | null
          fetched_at?: string | null
          from_address?: string | null
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          is_unread?: boolean | null
          provider: string
          sent_at: string
          snippet?: string | null
          subject?: string | null
          to_addresses?: string[] | null
          user_id: string
        }
        Update: {
          ai_classification?: string | null
          ai_classified_at?: string | null
          ai_intents?: Json | null
          ai_priority?: number | null
          ai_suggested_replies?: Json | null
          cc_addresses?: string[] | null
          contact_id?: string | null
          external_message_id?: string
          external_thread_id?: string | null
          fetched_at?: string | null
          from_address?: string | null
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          is_unread?: boolean | null
          provider?: string
          sent_at?: string
          snippet?: string | null
          subject?: string | null
          to_addresses?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_cache_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_listings: {
        Row: {
          address: string | null
          agency_id: string | null
          canton: string | null
          city: string | null
          expires_at: string | null
          external_id: string | null
          fetched_at: string | null
          id: string
          photo_url: string | null
          price: number | null
          rooms: number | null
          search_hash: string
          source_agency: string | null
          source_logo_url: string | null
          source_portal: string | null
          source_url: string
          surface_m2: number | null
          title: string | null
          type: string | null
        }
        Insert: {
          address?: string | null
          agency_id?: string | null
          canton?: string | null
          city?: string | null
          expires_at?: string | null
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          photo_url?: string | null
          price?: number | null
          rooms?: number | null
          search_hash: string
          source_agency?: string | null
          source_logo_url?: string | null
          source_portal?: string | null
          source_url: string
          surface_m2?: number | null
          title?: string | null
          type?: string | null
        }
        Update: {
          address?: string | null
          agency_id?: string | null
          canton?: string | null
          city?: string | null
          expires_at?: string | null
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          photo_url?: string | null
          price?: number | null
          rooms?: number | null
          search_hash?: string
          source_agency?: string | null
          source_logo_url?: string | null
          source_portal?: string | null
          source_url?: string
          surface_m2?: number | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_listings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          gmail_email: string | null
          id: string
          last_sync_at: string | null
          refresh_token: string
          scopes: string
          sync_enabled: boolean | null
          token_expires_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          gmail_email?: string | null
          id?: string
          last_sync_at?: string | null
          refresh_token: string
          scopes?: string
          sync_enabled?: boolean | null
          token_expires_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          gmail_email?: string | null
          id?: string
          last_sync_at?: string | null
          refresh_token?: string
          scopes?: string
          sync_enabled?: boolean | null
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
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
      listing_reports: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          listing_id: string
          reason: Database["public"]["Enums"]["listing_report_reason"]
          status: Database["public"]["Enums"]["listing_report_status"]
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          listing_id: string
          reason: Database["public"]["Enums"]["listing_report_reason"]
          status?: Database["public"]["Enums"]["listing_report_status"]
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          reason?: Database["public"]["Enums"]["listing_report_reason"]
          status?: Database["public"]["Enums"]["listing_report_status"]
          user_id?: string | null
        }
        Relationships: []
      }
      listings: {
        Row: {
          agency_id: string
          description_ai: string | null
          expires_at: string | null
          favorites_count: number
          id: string
          is_featured: boolean
          is_hot: boolean
          price_display: string | null
          property_id: string
          published_at: string | null
          title: string
          views_count: number
        }
        Insert: {
          agency_id: string
          description_ai?: string | null
          expires_at?: string | null
          favorites_count?: number
          id?: string
          is_featured?: boolean
          is_hot?: boolean
          price_display?: string | null
          property_id: string
          published_at?: string | null
          title: string
          views_count?: number
        }
        Update: {
          agency_id?: string
          description_ai?: string | null
          expires_at?: string | null
          favorites_count?: number
          id?: string
          is_featured?: boolean
          is_hot?: boolean
          price_display?: string | null
          property_id?: string
          published_at?: string | null
          title?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "listings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      market_changes: {
        Row: {
          change_pct: number | null
          change_type: string
          detected_at: string | null
          id: string
          listing_canton: string | null
          listing_city: string | null
          listing_rooms: number | null
          listing_title: string | null
          listing_type: string | null
          market_listing_id: string | null
          new_price: number | null
          old_price: number | null
        }
        Insert: {
          change_pct?: number | null
          change_type: string
          detected_at?: string | null
          id?: string
          listing_canton?: string | null
          listing_city?: string | null
          listing_rooms?: number | null
          listing_title?: string | null
          listing_type?: string | null
          market_listing_id?: string | null
          new_price?: number | null
          old_price?: number | null
        }
        Update: {
          change_pct?: number | null
          change_type?: string
          detected_at?: string | null
          id?: string
          listing_canton?: string | null
          listing_city?: string | null
          listing_rooms?: number | null
          listing_title?: string | null
          listing_type?: string | null
          market_listing_id?: string | null
          new_price?: number | null
          old_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_changes_market_listing_id_fkey"
            columns: ["market_listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      market_favorites: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: []
      }
      market_hidden: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: []
      }
      market_listings: {
        Row: {
          address: string | null
          agency_contact_name: string | null
          agency_contact_phone: string | null
          agency_logo_url: string | null
          agency_name: string | null
          agency_phone: string | null
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
          property_type_detail: string | null
          quality_flags: Json | null
          quality_score: number | null
          relevance_score: number | null
          rent: number | null
          rent_chf: number | null
          rooms: number | null
          source_created_at: string | null
          source_id: string
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
          address?: string | null
          agency_contact_name?: string | null
          agency_contact_phone?: string | null
          agency_logo_url?: string | null
          agency_name?: string | null
          agency_phone?: string | null
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
          property_type_detail?: string | null
          quality_flags?: Json | null
          quality_score?: number | null
          relevance_score?: number | null
          rent?: number | null
          rent_chf?: number | null
          rooms?: number | null
          source_created_at?: string | null
          source_id: string
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
          address?: string | null
          agency_contact_name?: string | null
          agency_contact_phone?: string | null
          agency_logo_url?: string | null
          agency_name?: string | null
          agency_phone?: string | null
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
          property_type_detail?: string | null
          quality_flags?: Json | null
          quality_score?: number | null
          relevance_score?: number | null
          rent?: number | null
          rent_chf?: number | null
          rooms?: number | null
          source_created_at?: string | null
          source_id?: string
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
      marketplace_inquiries: {
        Row: {
          agency_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          ip_address: unknown
          listing_canton: string | null
          listing_city: string | null
          listing_prefixed_id: string | null
          listing_title: string | null
          listing_transaction_type: string | null
          market_listing_id: string | null
          message: string | null
          phone: string | null
          property_id: string | null
          referer: string | null
          source_portal: string | null
          source_url: string | null
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          agency_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          ip_address?: unknown
          listing_canton?: string | null
          listing_city?: string | null
          listing_prefixed_id?: string | null
          listing_title?: string | null
          listing_transaction_type?: string | null
          market_listing_id?: string | null
          message?: string | null
          phone?: string | null
          property_id?: string | null
          referer?: string | null
          source_portal?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          agency_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          ip_address?: unknown
          listing_canton?: string | null
          listing_city?: string | null
          listing_prefixed_id?: string | null
          listing_title?: string | null
          listing_transaction_type?: string | null
          market_listing_id?: string | null
          message?: string | null
          phone?: string | null
          property_id?: string | null
          referer?: string | null
          source_portal?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_inquiries_market_listing_id_fkey"
            columns: ["market_listing_id"]
            isOneToOne: false
            referencedRelation: "market_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_inquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
          reasons: Json | null
          response_at: string | null
          score: number
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
          reasons?: Json | null
          response_at?: string | null
          score: number
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
          reasons?: Json | null
          response_at?: string | null
          score?: number
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
      message_threads: {
        Row: {
          agency_id: string
          buyer_user_id: string | null
          channel: string | null
          contact_id: string | null
          contact_name: string
          contact_type: string
          created_at: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          property_id: string | null
          property_title: string | null
          unread_count: number | null
        }
        Insert: {
          agency_id: string
          buyer_user_id?: string | null
          channel?: string | null
          contact_id?: string | null
          contact_name: string
          contact_type: string
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          property_id?: string | null
          property_title?: string | null
          unread_count?: number | null
        }
        Update: {
          agency_id?: string
          buyer_user_id?: string | null
          channel?: string | null
          contact_id?: string | null
          contact_name?: string
          contact_type?: string
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          property_id?: string | null
          property_title?: string | null
          unread_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          read_at: string | null
          sender_id: string
          sender_name: string
          sender_type: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
          sender_name: string
          sender_type: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
          sender_name?: string
          sender_type?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
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
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          lang: string
          source: string
          status: string
          unsubscribed_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          lang?: string
          source?: string
          status?: string
          unsubscribed_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          lang?: string
          source?: string
          status?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      whatsapp_agent_links: {
        Row: {
          agency_id: string | null
          created_at: string
          id: string
          pairing_code: string | null
          pairing_expires_at: string | null
          profile_id: string
          verified: boolean
          verified_at: string | null
          wa_number: string | null
        }
        Insert: {
          agency_id?: string | null
          created_at?: string
          id?: string
          pairing_code?: string | null
          pairing_expires_at?: string | null
          profile_id: string
          verified?: boolean
          verified_at?: string | null
          wa_number?: string | null
        }
        Update: {
          agency_id?: string | null
          created_at?: string
          id?: string
          pairing_code?: string | null
          pairing_expires_at?: string | null
          profile_id?: string
          verified?: boolean
          verified_at?: string | null
          wa_number?: string | null
        }
        Relationships: []
      }
      whatsapp_conversation_insights: {
        Row: {
          agency_id: string
          commitments: Json
          contact_id: string
          entities: Json
          generated_at: string
          id: string
          intent: string | null
          model: string | null
          next_action: Json | null
          sentiment: string | null
          source_last_message_at: string | null
          source_message_count: number
          summary: string | null
        }
        Insert: {
          agency_id: string
          commitments?: Json
          contact_id: string
          entities?: Json
          generated_at?: string
          id?: string
          intent?: string | null
          model?: string | null
          next_action?: Json | null
          sentiment?: string | null
          source_last_message_at?: string | null
          source_message_count?: number
          summary?: string | null
        }
        Update: {
          agency_id?: string
          commitments?: Json
          contact_id?: string
          entities?: Json
          generated_at?: string
          id?: string
          intent?: string | null
          model?: string | null
          next_action?: Json | null
          sentiment?: string | null
          source_last_message_at?: string | null
          source_message_count?: number
          summary?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          agency_id: string | null
          body: string | null
          contact_id: string | null
          created_at: string
          direction: string
          id: string
          media_type: string | null
          media_url: string | null
          provider: string
          provider_message_id: string
          raw: Json | null
          session_id: string | null
          status: string
          wa_from: string
          wa_timestamp: string | null
          wa_to: string | null
          processing_status: string
          claimed_at: string | null
          retry_count: number
          last_error: string | null
          media_r2_key: string | null
          media_id: string | null
          media_mime: string | null
          transcript: string | null
          transcript_lang: string | null
          transcript_confidence: number | null
        }
        Insert: {
          agency_id?: string | null
          body?: string | null
          contact_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          provider?: string
          provider_message_id: string
          raw?: Json | null
          session_id?: string | null
          status?: string
          wa_from: string
          wa_timestamp?: string | null
          wa_to?: string | null
          processing_status?: string
          claimed_at?: string | null
          retry_count?: number
          last_error?: string | null
          media_r2_key?: string | null
          media_id?: string | null
          media_mime?: string | null
          transcript?: string | null
          transcript_lang?: string | null
          transcript_confidence?: number | null
        }
        Update: {
          agency_id?: string | null
          body?: string | null
          contact_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          provider?: string
          provider_message_id?: string
          raw?: Json | null
          session_id?: string | null
          status?: string
          wa_from?: string
          wa_timestamp?: string | null
          wa_to?: string | null
          processing_status?: string
          claimed_at?: string | null
          retry_count?: number
          last_error?: string | null
          media_r2_key?: string | null
          media_id?: string | null
          media_mime?: string | null
          transcript?: string | null
          transcript_lang?: string | null
          transcript_confidence?: number | null
        }
        Relationships: []
      }
      offers: {
        Row: {
          agency_id: string | null
          amount: number
          buyer_name: string
          conditions: string | null
          contact_buyer_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          property_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          agency_id?: string | null
          amount: number
          buyer_name: string
          conditions?: string | null
          contact_buyer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          property_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          agency_id?: string | null
          amount?: number
          buyer_name?: string
          conditions?: string | null
          contact_buyer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          property_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_contact_buyer_id_fkey"
            columns: ["contact_buyer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklist: {
        Row: {
          agency_id: string | null
          completed: boolean | null
          completed_at: string | null
          id: string
          step_key: string
          user_id: string
        }
        Insert: {
          agency_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          step_key: string
          user_id: string
        }
        Update: {
          agency_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          step_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklist_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
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
      outlook_mail_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          last_sync_at: string | null
          outlook_email: string | null
          refresh_token: string
          scopes: string
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
          scopes?: string
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
          scopes?: string
          sync_enabled?: boolean | null
          token_expires_at?: string
          updated_at?: string | null
          user_id?: string
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
          first_day_completed_at: string | null
          first_day_done: boolean | null
          full_name: string
          id: string
          onboarding_completed: boolean | null
          onboarding_step: number | null
          phone: string | null
          preferences: Json | null
          role: string
          spoken_languages: string[] | null
          email_signature_html: string | null
          mobile_phone: string | null
          rcc: string | null
          signature_mode: string | null
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
          first_day_completed_at?: string | null
          first_day_done?: boolean | null
          full_name: string
          id: string
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          phone?: string | null
          preferences?: Json | null
          role?: string
          spoken_languages?: string[] | null
          email_signature_html?: string | null
          mobile_phone?: string | null
          rcc?: string | null
          signature_mode?: string | null
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
          first_day_completed_at?: string | null
          first_day_done?: boolean | null
          full_name?: string
          id?: string
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          phone?: string | null
          preferences?: Json | null
          role?: string
          spoken_languages?: string[] | null
          email_signature_html?: string | null
          mobile_phone?: string | null
          rcc?: string | null
          signature_mode?: string | null
        }
        Relationships: []
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
          agency_id: string | null
          avg_comparable_price: number | null
          comparable_count: number | null
          created_at: string | null
          days_on_market: number | null
          heat_score: number | null
          id: string
          interest_level: number | null
          last_calculated_at: string | null
          market_listing_id: string | null
          market_position_score: number | null
          price_trend: string | null
          price_vs_market_pct: number | null
          property_id: string | null
          source: string
          stagnation_risk: string | null
        }
        Insert: {
          agency_id?: string | null
          avg_comparable_price?: number | null
          comparable_count?: number | null
          created_at?: string | null
          days_on_market?: number | null
          heat_score?: number | null
          id?: string
          interest_level?: number | null
          last_calculated_at?: string | null
          market_listing_id?: string | null
          market_position_score?: number | null
          price_trend?: string | null
          price_vs_market_pct?: number | null
          property_id?: string | null
          source: string
          stagnation_risk?: string | null
        }
        Update: {
          agency_id?: string | null
          avg_comparable_price?: number | null
          comparable_count?: number | null
          created_at?: string | null
          days_on_market?: number | null
          heat_score?: number | null
          id?: string
          interest_level?: number | null
          last_calculated_at?: string | null
          market_listing_id?: string | null
          market_position_score?: number | null
          price_trend?: string | null
          price_vs_market_pct?: number | null
          property_id?: string | null
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
      reminders: {
        Row: {
          agency_id: string
          channel: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          id: string
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
          id?: string
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
          id?: string
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
      saved_searches: {
        Row: {
          alert_email: string | null
          alert_enabled: boolean | null
          alert_frequency: string | null
          created_at: string | null
          filters: Json
          id: string
          last_alerted_at: string | null
          name: string
          results_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_email?: string | null
          alert_enabled?: boolean | null
          alert_frequency?: string | null
          created_at?: string | null
          filters: Json
          id?: string
          last_alerted_at?: string | null
          name: string
          results_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_email?: string | null
          alert_enabled?: boolean | null
          alert_frequency?: string | null
          created_at?: string | null
          filters?: Json
          id?: string
          last_alerted_at?: string | null
          name?: string
          results_count?: number | null
          updated_at?: string | null
          user_id?: string
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
      seller_portals: {
        Row: {
          agency_id: string | null
          agent_id: string
          contact_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          last_viewed_at: string | null
          property_id: string
          status: string
          token: string
          view_count: number | null
        }
        Insert: {
          agency_id?: string | null
          agent_id: string
          contact_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          property_id: string
          status?: string
          token: string
          view_count?: number | null
        }
        Update: {
          agency_id?: string | null
          agent_id?: string
          contact_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          property_id?: string
          status?: string
          token?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_portals_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
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
          plan: string
          price: number | null
          status: string
          stripe_customer_id: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
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
          plan?: string
          price?: number | null
          status?: string
          stripe_customer_id: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
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
          plan?: string
          price?: number | null
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
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
      ticket_canned_responses: {
        Row: {
          body: string
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          shortcut: string | null
          title: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          shortcut?: string | null
          title: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          shortcut?: string | null
          title?: string
        }
        Relationships: []
      }
      ticket_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string | null
          id: string
          new_value: string | null
          old_value: string | null
          ticket_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachments: Json | null
          author_id: string | null
          author_name: string
          author_type: string
          body: string
          created_at: string | null
          id: string
          is_internal_note: boolean | null
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          author_id?: string | null
          author_name: string
          author_type: string
          body: string
          created_at?: string | null
          id?: string
          is_internal_note?: boolean | null
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          author_id?: string | null
          author_name?: string
          author_type?: string
          body?: string
          created_at?: string | null
          id?: string
          is_internal_note?: boolean | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          agency_id: string
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
      user_profile_meta: {
        Row: {
          bio: string
          created_at: string
          mode: string
          notifications: Json
          preferences: Json
          privacy: Json
          security: Json
          updated_at: string
          user_id: string
          verifications: Json
        }
        Insert: {
          bio?: string
          created_at?: string
          mode?: string
          notifications?: Json
          preferences?: Json
          privacy?: Json
          security?: Json
          updated_at?: string
          user_id: string
          verifications?: Json
        }
        Update: {
          bio?: string
          created_at?: string
          mode?: string
          notifications?: Json
          preferences?: Json
          privacy?: Json
          security?: Json
          updated_at?: string
          user_id?: string
          verifications?: Json
        }
        Relationships: []
      }
      vendor_dossiers: {
        Row: {
          address: string
          agent: Json
          created_at: string
          estimation: Json | null
          id: string
          msg_id: string | null
          next_action: Json | null
          photos_count: number
          property_type: string
          publication: Json | null
          rooms: number | null
          status: string
          status_history: Json
          surface: string | null
          title: string
          transaction: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          agent: Json
          created_at?: string
          estimation?: Json | null
          id: string
          msg_id?: string | null
          next_action?: Json | null
          photos_count?: number
          property_type: string
          publication?: Json | null
          rooms?: number | null
          status?: string
          status_history?: Json
          surface?: string | null
          title: string
          transaction: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          agent?: Json
          created_at?: string
          estimation?: Json | null
          id?: string
          msg_id?: string | null
          next_action?: Json | null
          photos_count?: number
          property_type?: string
          publication?: Json | null
          rooms?: number | null
          status?: string
          status_history?: Json
          surface?: string | null
          title?: string
          transaction?: string
          updated_at?: string
          user_id?: string
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
    }
    Functions: {
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
      check_email_exists: { Args: { p_email: string }; Returns: boolean }
      cleanup_orphan_property_drafts: { Args: never; Returns: number }
      compute_agent_preferences: { Args: { p_agent_id: string }; Returns: Json }
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
      admin_set_user_role: {
        Args: { p_user_id: string; p_role: string }
        Returns: undefined
      }
      claim_pending_role: { Args: never; Returns: string }
      team_set_member_role: {
        Args: { p_member_id: string; p_role: string }
        Returns: undefined
      }
      team_remove_member: { Args: { p_member_id: string }; Returns: undefined }
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
      get_admin_compliance_stats: {
        Args: never
        Returns: {
          avg_completion: number
          pending: number
          screening_match: number
          total: number
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
          db_size_mb: number
          emails_sent_today: number
          errors_last_24h: number
          last_scraping_at: string
          storage_used_mb: number
        }[]
      }
      get_admin_support_stats: {
        Args: never
        Returns: {
          new_count: number
          open_count: number
          resolved_this_week: number
          sla_breached_open: number
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
      get_app_config: { Args: { config_key: string }; Returns: string }
      get_cities_by_canton: {
        Args: { p_canton: string; p_context?: string }
        Returns: {
          city: string
          count: number
        }[]
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
      get_my_agency_id: { Args: never; Returns: string }
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
      get_popular_articles: {
        Args: { limit_count?: number }
        Returns: {
          article_slug: string
          view_count: number
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
      get_user_agency_id: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      hourly_automation_scan: { Args: never; Returns: undefined }
      is_super_admin: { Args: never; Returns: boolean }
      is_within_sla_window: {
        Args: { p_agent_id: string; p_at?: string }
        Returns: boolean
      }
      join_agency: { Args: { p_agency_id: string }; Returns: undefined }
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
      mark_stale_kyc_dossiers: {
        Args: never
        Returns: {
          id: string
        }[]
      }
      normalize_phone: { Args: { p_phone: string }; Returns: string }
      pg_database_size_mb: { Args: never; Returns: number }
      purge_expired_import_raw_text: { Args: never; Returns: number }
      run_search_alerts: { Args: never; Returns: undefined }
      search_agencies: {
        Args: { lim?: number; q: string }
        Returns: {
          canton: string
          city: string
          id: string
          logo_url: string
          member_count: number
          name: string
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
      slugify: { Args: { input: string }; Returns: string }
      storage_size_mb: { Args: never; Returns: number }
      unpublish_expired_mandates: { Args: never; Returns: number }
    }
    Enums: {
      agency_plan: "starter" | "pro" | "agency" | "enterprise"
      contact_score: "hot" | "warm" | "cold"
      contact_type: "buyer" | "seller" | "both" | "lead"
      crm_offer_kind: "offer" | "counter"
      crm_offer_party: "buyer" | "seller"
      crm_offer_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "expired"
        | "withdrawn"
      document_status: "pending" | "validated" | "rejected"
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
      listing_report_reason:
        | "wrong_price"
        | "already_taken"
        | "wrong_photos"
        | "inaccurate_description"
        | "spam_fraud"
        | "other"
      listing_report_status: "open" | "reviewing" | "resolved" | "dismissed"
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
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agency_plan: ["starter", "pro", "agency", "enterprise"],
      contact_score: ["hot", "warm", "cold"],
      contact_type: ["buyer", "seller", "both", "lead"],
      crm_offer_kind: ["offer", "counter"],
      crm_offer_party: ["buyer", "seller"],
      crm_offer_status: [
        "pending",
        "accepted",
        "rejected",
        "expired",
        "withdrawn",
      ],
      document_status: ["pending", "validated", "rejected"],
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
      listing_report_reason: [
        "wrong_price",
        "already_taken",
        "wrong_photos",
        "inaccurate_description",
        "spam_fraud",
        "other",
      ],
      listing_report_status: ["open", "reviewing", "resolved", "dismissed"],
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

