export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      iebc_offices: {
        Row: {
          id: number
          county: string | null
          constituency: string | null
          constituency_name: string | null
          office_location: string | null
          latitude: number | null
          longitude: number | null
          verified: boolean | null
          formatted_address: string | null
          landmark: string | null
          landmark_normalized: string | null
          landmark_source: string | null
          walking_effort: number | null
          elevation_meters: number | null
          geocode_verified: boolean | null
          geocode_verified_at: string | null
          multi_source_confidence: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          county?: string | null
          constituency?: string | null
          constituency_name?: string | null
          office_location?: string | null
          latitude?: number | null
          longitude?: number | null
          verified?: boolean | null
          formatted_address?: string | null
          landmark?: string | null
          landmark_normalized?: string | null
          landmark_source?: string | null
          walking_effort?: number | null
          elevation_meters?: number | null
          geocode_verified?: boolean | null
          geocode_verified_at?: string | null
          multi_source_confidence?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          county?: string | null
          constituency?: string | null
          constituency_name?: string | null
          office_location?: string | null
          latitude?: number | null
          longitude?: number | null
          verified?: boolean | null
          formatted_address?: string | null
          landmark?: string | null
          landmark_normalized?: string | null
          landmark_source?: string | null
          walking_effort?: number | null
          elevation_meters?: number | null
          geocode_verified?: boolean | null
          geocode_verified_at?: string | null
          multi_source_confidence?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iebc_offices_county_fkey"
            columns: ["county"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["county_name"]
          },
          {
            foreignKeyName: "iebc_offices_constituency_fkey"
            columns: ["constituency"]
            isOneToOne: false
            referencedRelation: "constituencies"
            referencedColumns: ["constituency_name"]
          }
        ]
      }
      security_audit_log: {
        Row: {
          id: number
          action_type: string
          table_name: string
          record_id: string | null
          details: Json | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: number
          action_type: string
          table_name: string
          record_id?: string | null
          details?: Json | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          action_type?: string
          table_name?: string
          record_id?: string | null
          details?: Json | null
          user_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      petitions: {
        Row: {
          id: number
          title: string
          description: string
          category: string
          target_signatures: number
          current_signatures: number
          status: string
          creator_id: string
          created_at: string
          updated_at: string
          expires_at: string | null
          image_url: string | null
          county: string | null
          constituency: string | null
          tags: string[] | null
          featured: boolean
          priority: string
          petition_type: string
          target_audience: string
          verification_required: boolean
          verified_at: string | null
          rejected_reason: string | null
          admin_notes: string | null
          share_count: number
          view_count: number
          last_signed_at: string | null
        }
        Insert: {
          id?: number
          title: string
          description: string
          category: string
          target_signatures: number
          current_signatures?: number
          status?: string
          creator_id: string
          created_at?: string
          updated_at?: string
          expires_at?: string | null
          image_url?: string | null
          county?: string | null
          constituency?: string | null
          tags?: string[] | null
          featured?: boolean
          priority?: string
          petition_type?: string
          target_audience?: string
          verification_required?: boolean
          verified_at?: string | null
          rejected_reason?: string | null
          admin_notes?: string | null
          share_count?: number
          view_count?: number
          last_signed_at?: string | null
        }
        Update: {
          id?: number
          title?: string
          description?: string
          category?: string
          target_signatures?: number
          current_signatures?: number
          status?: string
          creator_id?: string
          created_at?: string
          updated_at?: string
          expires_at?: string | null
          image_url?: string | null
          county?: string | null
          constituency?: string | null
          tags?: string[] | null
          featured?: boolean
          priority?: string
          petition_type?: string
          target_audience?: string
          verification_required?: boolean
          verified_at?: string | null
          rejected_reason?: string | null
          admin_notes?: string | null
          share_count?: number
          view_count?: number
          last_signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "petitions_county_fkey"
            columns: ["county"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["county_name"]
          },
          {
            foreignKeyName: "petitions_constituency_fkey"
            columns: ["constituency"]
            isOneToOne: false
            referencedRelation: "constituencies"
            referencedColumns: ["constituency_name"]
          }
        ]
      }
      signatures: {
        Row: {
          id: number
          petition_id: number
          signer_id: string
          signer_name: string
          signer_email: string
          signer_phone: string | null
          county: string | null
          constituency: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
          verified: boolean
          verification_code: string | null
          verified_at: string | null
          anonymous: boolean
        }
        Insert: {
          id?: number
          petition_id: number
          signer_id: string
          signer_name: string
          signer_email: string
          signer_phone?: string | null
          county?: string | null
          constituency?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          verified?: boolean
          verification_code?: string | null
          verified_at?: string | null
          anonymous?: boolean
        }
        Update: {
          id?: number
          petition_id?: number
          signer_id?: string
          signer_name?: string
          signer_email?: string
          signer_phone?: string | null
          county?: string | null
          constituency?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          verified?: boolean
          verification_code?: string | null
          verified_at?: string | null
          anonymous?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "signatures_petition_id_fkey"
            columns: ["petition_id"]
            isOneToOne: false
            referencedRelation: "petitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_county_fkey"
            columns: ["county"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["county_name"]
          },
          {
            foreignKeyName: "signatures_constituency_fkey"
            columns: ["constituency"]
            isOneToOne: false
            referencedRelation: "constituencies"
            referencedColumns: ["constituency_name"]
          }
        ]
      }
      contributions: {
        Row: {
          id: number
          petition_id: number
          contributor_id: string
          contributor_name: string
          contributor_email: string
          amount: number
          currency: string
          payment_method: string
          transaction_id: string | null
          status: string
          created_at: string
          verified: boolean
          verified_at: string | null
          anonymous: boolean
        }
        Insert: {
          id?: number
          petition_id: number
          contributor_id: string
          contributor_name: string
          contributor_email: string
          amount: number
          currency?: string
          payment_method?: string
          transaction_id?: string | null
          status?: string
          created_at?: string
          verified?: boolean
          verified_at?: string | null
          anonymous?: boolean
        }
        Update: {
          id?: number
          petition_id?: number
          contributor_id?: string
          contributor_name?: string
          contributor_email?: string
          amount?: number
          currency?: string
          payment_method?: string
          transaction_id?: string | null
          status?: string
          created_at?: string
          verified?: boolean
          verified_at?: string | null
          anonymous?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contributions_petition_id_fkey"
            columns: ["petition_id"]
            isOneToOne: false
            referencedRelation: "petitions"
            referencedColumns: ["id"]
          }
        ]
      }
      geojson_data: {
        Row: {
          id: number
          data_type: string
          geojson: Json
          source: string | null
          created_at: string
          updated_at: string
          metadata: Json | null
          version: string | null
          active: boolean
          bounds: Json | null
          properties: Json | null
        }
        Insert: {
          id?: number
          data_type: string
          geojson: Json
          source?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
          version?: string | null
          active?: boolean
          bounds?: Json | null
          properties?: Json | null
        }
        Update: {
          id?: number
          data_type?: string
          geojson?: Json
          source?: string | null
          created_at?: string
          updated_at?: string
          metadata?: Json | null
          version?: string | null
          active?: boolean
          bounds?: Json | null
          properties?: Json | null
        }
        Relationships: []
      }
      counties: {
        Row: {
          county_name: string
          county_code: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          county_name: string
          county_code?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          county_name?: string
          county_code?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      constituencies: {
        Row: {
          constituency_name: string
          constituency_code: string | null
          county_name: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          constituency_name: string
          constituency_code?: string | null
          county_name?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          constituency_name?: string
          constituency_code?: string | null
          county_name?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "constituencies_county_name_fkey"
            columns: ["county_name"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["county_name"]
          }
        ]
      }
      evidence_documents: {
        Row: {
          id: number
          petition_id: number
          document_type: string
          file_url: string
          file_name: string
          file_size: number
          mime_type: string
          uploaded_by: string
          created_at: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
          metadata: Json | null
        }
        Insert: {
          id?: number
          petition_id: number
          document_type: string
          file_url: string
          file_name: string
          file_size: number
          mime_type: string
          uploaded_by: string
          created_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: number
          petition_id?: number
          document_type?: string
          file_url?: string
          file_name?: string
          file_size?: number
          mime_type?: string
          uploaded_by?: string
          created_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_documents_petition_id_fkey"
            columns: ["petition_id"]
            isOneToOne: false
            referencedRelation: "petitions"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_offices_in_bounds: {
        Args: {
          min_lat: number
          min_lng: number
          max_lat: number
          max_lng: number
          zoom_level: number
        }
        Returns: Array<{
          id: number
          county: string | null
          constituency: string | null
          constituency_name: string | null
          office_location: string | null
          latitude: number | null
          longitude: number | null
          verified: boolean | null
          formatted_address: string | null
          landmark: string | null
          landmark_normalized: string | null
          landmark_source: string | null
          walking_effort: number | null
          elevation_meters: number | null
          geocode_verified: boolean | null
          geocode_verified_at: string | null
          multi_source_confidence: number | null
          created_at: string | null
          updated_at: string | null
        }>
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
