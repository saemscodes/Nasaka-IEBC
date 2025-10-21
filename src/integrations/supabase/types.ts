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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      audit_trail: {
        Row: {
          action_details: Json
          action_type: string
          id: string
          ip_address: unknown | null
          petition_id: string | null
          signature_id: string | null
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_details: Json
          action_type: string
          id?: string
          ip_address?: unknown | null
          petition_id?: string | null
          signature_id?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_details?: Json
          action_type?: string
          id?: string
          ip_address?: unknown | null
          petition_id?: string | null
          signature_id?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_trail_petition_id_fkey"
            columns: ["petition_id"]
            isOneToOne: false
            referencedRelation: "petitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_trail_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      confirmations: {
        Row: {
          confirmation_weight: number | null
          confirmed_at: string | null
          confirmer_accuracy_meters: number | null
          confirmer_device_hash: string | null
          confirmer_distance_meters: number | null
          confirmer_ip_hash: string
          confirmer_lat: number
          confirmer_lng: number
          confirmer_ua_hash: string
          contribution_id: number | null
          geom: unknown | null
          id: number
        }
        Insert: {
          confirmation_weight?: number | null
          confirmed_at?: string | null
          confirmer_accuracy_meters?: number | null
          confirmer_device_hash?: string | null
          confirmer_distance_meters?: number | null
          confirmer_ip_hash: string
          confirmer_lat: number
          confirmer_lng: number
          confirmer_ua_hash: string
          contribution_id?: number | null
          geom?: unknown | null
          id?: number
        }
        Update: {
          confirmation_weight?: number | null
          confirmed_at?: string | null
          confirmer_accuracy_meters?: number | null
          confirmer_device_hash?: string | null
          confirmer_distance_meters?: number | null
          confirmer_ip_hash?: string
          confirmer_lat?: number
          confirmer_lng?: number
          confirmer_ua_hash?: string
          contribution_id?: number | null
          geom?: unknown | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "confirmations_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "iebc_office_contributions"
            referencedColumns: ["id"]
          },
        ]
      }
      constituencies: {
        Row: {
          county_id: number
          id: number
          member_of_parliament: string | null
          name: string
          party: string | null
          registration_target: number
          women_rep: string | null
        }
        Insert: {
          county_id: number
          id?: number
          member_of_parliament?: string | null
          name: string
          party?: string | null
          registration_target: number
          women_rep?: string | null
        }
        Update: {
          county_id?: number
          id?: number
          member_of_parliament?: string | null
          name?: string
          party?: string | null
          registration_target?: number
          women_rep?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "constituencies_county_id_fkey"
            columns: ["county_id"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["id"]
          },
        ]
      }
      core_team: {
        Row: {
          added_at: string
          is_admin: boolean
          user_id: string
        }
        Insert: {
          added_at?: string
          is_admin?: boolean
          user_id: string
        }
        Update: {
          added_at?: string
          is_admin?: boolean
          user_id?: string
        }
        Relationships: []
      }
      counties: {
        Row: {
          county_code: string | null
          governor: string | null
          id: number
          name: string
          registration_target: number
          senator: string | null
          total_count: number | null
        }
        Insert: {
          county_code?: string | null
          governor?: string | null
          id?: number
          name: string
          registration_target: number
          senator?: string | null
          total_count?: number | null
        }
        Update: {
          county_code?: string | null
          governor?: string | null
          id?: number
          name?: string
          registration_target?: number
          senator?: string | null
          total_count?: number | null
        }
        Relationships: []
      }
      evidence_documents: {
        Row: {
          created_at: string
          document_title: string
          document_type: string
          file_path: string | null
          id: string
          petition_id: string
          uploaded_by: string | null
          verification_source: string | null
          verification_status: string | null
        }
        Insert: {
          created_at?: string
          document_title: string
          document_type: string
          file_path?: string | null
          id?: string
          petition_id: string
          uploaded_by?: string | null
          verification_source?: string | null
          verification_status?: string | null
        }
        Update: {
          created_at?: string
          document_title?: string
          document_type?: string
          file_path?: string | null
          id?: string
          petition_id?: string
          uploaded_by?: string | null
          verification_source?: string | null
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_documents_petition_id_fkey"
            columns: ["petition_id"]
            isOneToOne: false
            referencedRelation: "petitions"
            referencedColumns: ["id"]
          },
        ]
      }
      iebc_office_contributions: {
        Row: {
          confidence_score: number | null
          confirmation_count: number | null
          created_at: string
          device_fingerprint_hash: string | null
          device_metadata: Json | null
          duplicate_candidate_ids: number[] | null
          exif_metadata: Json | null
          geom: unknown | null
          google_maps_link: string | null
          id: number
          image_path: string | null
          image_public_url: string | null
          nearby_landmarks: Json | null
          original_office_id: number | null
          reverse_geocode_result: Json | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          submitted_accuracy_meters: number | null
          submitted_constituency: string | null
          submitted_constituency_code: number | null
          submitted_county: string | null
          submitted_landmark: string | null
          submitted_latitude: number
          submitted_longitude: number
          submitted_office_location: string | null
          submitted_timestamp: string | null
          updated_at: string
        }
        Insert: {
          confidence_score?: number | null
          confirmation_count?: number | null
          created_at?: string
          device_fingerprint_hash?: string | null
          device_metadata?: Json | null
          duplicate_candidate_ids?: number[] | null
          exif_metadata?: Json | null
          geom?: unknown | null
          google_maps_link?: string | null
          id?: number
          image_path?: string | null
          image_public_url?: string | null
          nearby_landmarks?: Json | null
          original_office_id?: number | null
          reverse_geocode_result?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          submitted_accuracy_meters?: number | null
          submitted_constituency?: string | null
          submitted_constituency_code?: number | null
          submitted_county?: string | null
          submitted_landmark?: string | null
          submitted_latitude: number
          submitted_longitude: number
          submitted_office_location?: string | null
          submitted_timestamp?: string | null
          updated_at?: string
        }
        Update: {
          confidence_score?: number | null
          confirmation_count?: number | null
          created_at?: string
          device_fingerprint_hash?: string | null
          device_metadata?: Json | null
          duplicate_candidate_ids?: number[] | null
          exif_metadata?: Json | null
          geom?: unknown | null
          google_maps_link?: string | null
          id?: number
          image_path?: string | null
          image_public_url?: string | null
          nearby_landmarks?: Json | null
          original_office_id?: number | null
          reverse_geocode_result?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          submitted_accuracy_meters?: number | null
          submitted_constituency?: string | null
          submitted_constituency_code?: number | null
          submitted_county?: string | null
          submitted_landmark?: string | null
          submitted_latitude?: number
          submitted_longitude?: number
          submitted_office_location?: string | null
          submitted_timestamp?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iebc_office_contributions_original_office_id_fkey"
            columns: ["original_office_id"]
            isOneToOne: false
            referencedRelation: "iebc_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iebc_office_contributions_original_office_id_fkey"
            columns: ["original_office_id"]
            isOneToOne: false
            referencedRelation: "public_iebc_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      iebc_offices: {
        Row: {
          accuracy_meters: number | null
          clean_office_location: string | null
          constituency: string
          constituency_code: number
          constituency_name: string
          contributor_image_url: string | null
          county: string
          created_at: string | null
          direction_distance: number | null
          direction_landmark: string | null
          direction_type: string | null
          distance_from_landmark: number | null
          formatted_address: string | null
          geocode_confidence: number | null
          geocode_method: string | null
          geocode_queries: string | null
          geocode_query: string | null
          geocode_status: string | null
          geom: unknown | null
          id: number
          importance_score: number | null
          landmark: string | null
          landmark_subtype: string | null
          landmark_type: string | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          office_location: string
          result_type: string | null
          source: string | null
          successful_geocode_query: string | null
          total_queries_tried: number | null
          updated_at: string | null
          verification_source: string | null
          verified: boolean | null
          verified_at: string | null
          verified_latitude: number | null
          verified_longitude: number | null
          verifier_id: string | null
        }
        Insert: {
          accuracy_meters?: number | null
          clean_office_location?: string | null
          constituency: string
          constituency_code: number
          constituency_name: string
          contributor_image_url?: string | null
          county: string
          created_at?: string | null
          direction_distance?: number | null
          direction_landmark?: string | null
          direction_type?: string | null
          distance_from_landmark?: number | null
          formatted_address?: string | null
          geocode_confidence?: number | null
          geocode_method?: string | null
          geocode_queries?: string | null
          geocode_query?: string | null
          geocode_status?: string | null
          geom?: unknown | null
          id?: number
          importance_score?: number | null
          landmark?: string | null
          landmark_subtype?: string | null
          landmark_type?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          office_location: string
          result_type?: string | null
          source?: string | null
          successful_geocode_query?: string | null
          total_queries_tried?: number | null
          updated_at?: string | null
          verification_source?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_latitude?: number | null
          verified_longitude?: number | null
          verifier_id?: string | null
        }
        Update: {
          accuracy_meters?: number | null
          clean_office_location?: string | null
          constituency?: string
          constituency_code?: number
          constituency_name?: string
          contributor_image_url?: string | null
          county?: string
          created_at?: string | null
          direction_distance?: number | null
          direction_landmark?: string | null
          direction_type?: string | null
          distance_from_landmark?: number | null
          formatted_address?: string | null
          geocode_confidence?: number | null
          geocode_method?: string | null
          geocode_queries?: string | null
          geocode_query?: string | null
          geocode_status?: string | null
          geom?: unknown | null
          id?: number
          importance_score?: number | null
          landmark?: string | null
          landmark_subtype?: string | null
          landmark_type?: string | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          office_location?: string
          result_type?: string | null
          source?: string | null
          successful_geocode_query?: string | null
          total_queries_tried?: number | null
          updated_at?: string | null
          verification_source?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_latitude?: number | null
          verified_longitude?: number | null
          verifier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iebc_offices_constituency_fkey"
            columns: ["constituency"]
            isOneToOne: false
            referencedRelation: "constituencies"
            referencedColumns: ["name"]
          },
        ]
      }
      index_usage_monitoring: {
        Row: {
          data: Json
          id: string
          recorded_at: string
        }
        Insert: {
          data: Json
          id?: string
          recorded_at?: string
        }
        Update: {
          data?: Json
          id?: string
          recorded_at?: string
        }
        Relationships: []
      }
      index_usage_monitoring_default: {
        Row: {
          data: Json
          id: string
          recorded_at: string
        }
        Insert: {
          data: Json
          id?: string
          recorded_at?: string
        }
        Update: {
          data?: Json
          id?: string
          recorded_at?: string
        }
        Relationships: []
      }
      index_usage_monitoring_y2023m07: {
        Row: {
          data: Json
          id: string
          recorded_at: string
        }
        Insert: {
          data: Json
          id?: string
          recorded_at?: string
        }
        Update: {
          data?: Json
          id?: string
          recorded_at?: string
        }
        Relationships: []
      }
      landmark_types: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: number
          permanence_score: number | null
          subtype: string
          triangulation_weight: number | null
          typical_accuracy_meters: number | null
          visibility_score: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: number
          permanence_score?: number | null
          subtype: string
          triangulation_weight?: number | null
          typical_accuracy_meters?: number | null
          visibility_score?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: number
          permanence_score?: number | null
          subtype?: string
          triangulation_weight?: number | null
          typical_accuracy_meters?: number | null
          visibility_score?: number | null
        }
        Relationships: []
      }
      landmarks: {
        Row: {
          accuracy_meters: number | null
          constituency: string | null
          county: string | null
          created_at: string | null
          description: string | null
          direction_description: string | null
          distance_from_reference: number | null
          geom: unknown | null
          id: number
          importance_score: number | null
          latitude: number
          longitude: number
          name: string
          permanence_score: number | null
          reference_landmark: string | null
          road_side: string | null
          source: string | null
          subtype: string
          type: string
          updated_at: string | null
          verified: boolean | null
          visibility_score: number | null
          ward: string | null
        }
        Insert: {
          accuracy_meters?: number | null
          constituency?: string | null
          county?: string | null
          created_at?: string | null
          description?: string | null
          direction_description?: string | null
          distance_from_reference?: number | null
          geom?: unknown | null
          id?: number
          importance_score?: number | null
          latitude: number
          longitude: number
          name: string
          permanence_score?: number | null
          reference_landmark?: string | null
          road_side?: string | null
          source?: string | null
          subtype: string
          type: string
          updated_at?: string | null
          verified?: boolean | null
          visibility_score?: number | null
          ward?: string | null
        }
        Update: {
          accuracy_meters?: number | null
          constituency?: string | null
          county?: string | null
          created_at?: string | null
          description?: string | null
          direction_description?: string | null
          distance_from_reference?: number | null
          geom?: unknown | null
          id?: number
          importance_score?: number | null
          latitude?: number
          longitude?: number
          name?: string
          permanence_score?: number | null
          reference_landmark?: string | null
          road_side?: string | null
          source?: string | null
          subtype?: string
          type?: string
          updated_at?: string | null
          verified?: boolean | null
          visibility_score?: number | null
          ward?: string | null
        }
        Relationships: []
      }
      map_landmarks: {
        Row: {
          centroid: unknown | null
          created_at: string | null
          geom: unknown | null
          id: number
          landmark_subtype: string | null
          landmark_type: string
          name: string | null
          osm_id: number | null
          permanence_score: number | null
          source: string
          tags: Json | null
          triangulation_weight: number | null
          typical_accuracy_meters: number | null
          updated_at: string | null
          verified: boolean | null
          visibility_score: number | null
        }
        Insert: {
          centroid?: unknown | null
          created_at?: string | null
          geom?: unknown | null
          id?: number
          landmark_subtype?: string | null
          landmark_type: string
          name?: string | null
          osm_id?: number | null
          permanence_score?: number | null
          source?: string
          tags?: Json | null
          triangulation_weight?: number | null
          typical_accuracy_meters?: number | null
          updated_at?: string | null
          verified?: boolean | null
          visibility_score?: number | null
        }
        Update: {
          centroid?: unknown | null
          created_at?: string | null
          geom?: unknown | null
          id?: number
          landmark_subtype?: string | null
          landmark_type?: string
          name?: string | null
          osm_id?: number | null
          permanence_score?: number | null
          source?: string
          tags?: Json | null
          triangulation_weight?: number | null
          typical_accuracy_meters?: number | null
          updated_at?: string | null
          verified?: boolean | null
          visibility_score?: number | null
        }
        Relationships: []
      }
      petitions: {
        Row: {
          constituency: string | null
          county: string
          county_target: number | null
          created_at: string
          created_by: string | null
          deadline: string
          description: string
          evidence_documents: Json | null
          grounds: string[]
          id: string
          mp_name: string
          signature_target: number | null
          status: string
          updated_at: string
          ward_target: number
        }
        Insert: {
          constituency?: string | null
          county: string
          county_target?: number | null
          created_at?: string
          created_by?: string | null
          deadline: string
          description: string
          evidence_documents?: Json | null
          grounds: string[]
          id?: string
          mp_name: string
          signature_target?: number | null
          status?: string
          updated_at?: string
          ward_target: number
        }
        Update: {
          constituency?: string | null
          county?: string
          county_target?: number | null
          created_at?: string
          created_by?: string | null
          deadline?: string
          description?: string
          evidence_documents?: Json | null
          grounds?: string[]
          id?: string
          mp_name?: string
          signature_target?: number | null
          status?: string
          updated_at?: string
          ward_target?: number
        }
        Relationships: [
          {
            foreignKeyName: "petitions_constituency_fkey"
            columns: ["constituency"]
            isOneToOne: false
            referencedRelation: "constituencies"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "petitions_county_fkey"
            columns: ["county"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "petitions_county_target_fkey"
            columns: ["county_target"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["registration_target"]
          },
          {
            foreignKeyName: "petitions_signature_target_fkey"
            columns: ["signature_target"]
            isOneToOne: false
            referencedRelation: "constituencies"
            referencedColumns: ["registration_target"]
          },
        ]
      }
      profiles: {
        Row: {
          constituency: string | null
          created_at: string
          full_name: string | null
          id: string
          is_verified: boolean | null
          national_id: string | null
          phone_number: string | null
          updated_at: string
          verification_data: Json | null
          ward: string | null
        }
        Insert: {
          constituency?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_verified?: boolean | null
          national_id?: string | null
          phone_number?: string | null
          updated_at?: string
          verification_data?: Json | null
          ward?: string | null
        }
        Update: {
          constituency?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_verified?: boolean | null
          national_id?: string | null
          phone_number?: string | null
          updated_at?: string
          verification_data?: Json | null
          ward?: string | null
        }
        Relationships: []
      }
      signature_access_log: {
        Row: {
          access_method: string
          access_timestamp: string
          accessed_by: string | null
          id: string
          ip_address: unknown | null
          signature_id: string | null
          user_agent: string | null
        }
        Insert: {
          access_method: string
          access_timestamp?: string
          accessed_by?: string | null
          id?: string
          ip_address?: unknown | null
          signature_id?: string | null
          user_agent?: string | null
        }
        Update: {
          access_method?: string
          access_timestamp?: string
          accessed_by?: string | null
          id?: string
          ip_address?: unknown | null
          signature_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_access_log_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          blockchain_hash: string | null
          constituency: string
          created_at: string
          csp_provider: string
          device_fingerprint: Json | null
          device_id: string | null
          geolocation: Json | null
          id: string
          key_version: string | null
          petition_id: string
          polling_station: string | null
          public_key: Json | null
          signature_certificate: string | null
          signature_payload: Json | null
          signature_timestamp: string
          signature_value: string | null
          verification_status: Json
          voter_id: string
          voter_name: string
          ward: string
        }
        Insert: {
          blockchain_hash?: string | null
          constituency: string
          created_at?: string
          csp_provider: string
          device_fingerprint?: Json | null
          device_id?: string | null
          geolocation?: Json | null
          id?: string
          key_version?: string | null
          petition_id: string
          polling_station?: string | null
          public_key?: Json | null
          signature_certificate?: string | null
          signature_payload?: Json | null
          signature_timestamp?: string
          signature_value?: string | null
          verification_status?: Json
          voter_id: string
          voter_name: string
          ward: string
        }
        Update: {
          blockchain_hash?: string | null
          constituency?: string
          created_at?: string
          csp_provider?: string
          device_fingerprint?: Json | null
          device_id?: string | null
          geolocation?: Json | null
          id?: string
          key_version?: string | null
          petition_id?: string
          polling_station?: string | null
          public_key?: Json | null
          signature_certificate?: string | null
          signature_payload?: Json | null
          signature_timestamp?: string
          signature_value?: string | null
          verification_status?: Json
          voter_id?: string
          voter_name?: string
          ward?: string
        }
        Relationships: [
          {
            foreignKeyName: "signatures_petition_id_fkey"
            columns: ["petition_id"]
            isOneToOne: false
            referencedRelation: "petitions"
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
      verification_log: {
        Row: {
          action: string
          actor: string
          contribution_id: number | null
          created_at: string | null
          details: Json | null
          id: number
          office_id: number | null
        }
        Insert: {
          action: string
          actor: string
          contribution_id?: number | null
          created_at?: string | null
          details?: Json | null
          id?: number
          office_id?: number | null
        }
        Update: {
          action?: string
          actor?: string
          contribution_id?: number | null
          created_at?: string | null
          details?: Json | null
          id?: number
          office_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_log_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "iebc_office_contributions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_log_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "iebc_offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_log_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "public_iebc_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      wards: {
        Row: {
          constituency: string
          county: string
          created_at: string
          id: string
          member_of_parliament: string | null
          registration_target: number | null
          total_count: number | null
          ward_name: string
        }
        Insert: {
          constituency: string
          county: string
          created_at?: string
          id?: string
          member_of_parliament?: string | null
          registration_target?: number | null
          total_count?: number | null
          ward_name: string
        }
        Update: {
          constituency?: string
          county?: string
          created_at?: string
          id?: string
          member_of_parliament?: string | null
          registration_target?: number | null
          total_count?: number | null
          ward_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "wards_member_of_parliament_fkey"
            columns: ["member_of_parliament"]
            isOneToOne: false
            referencedRelation: "constituencies"
            referencedColumns: ["member_of_parliament"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown | null
          f_table_catalog: unknown | null
          f_table_name: unknown | null
          f_table_schema: unknown | null
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown | null
          f_table_catalog: string | null
          f_table_name: unknown | null
          f_table_schema: unknown | null
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown | null
          f_table_catalog?: string | null
          f_table_name?: unknown | null
          f_table_schema?: unknown | null
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown | null
          f_table_catalog?: string | null
          f_table_name?: unknown | null
          f_table_schema?: unknown | null
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      map_landmarks_readable: {
        Row: {
          centroid_wkt: string | null
          id: number | null
          landmark_subtype: string | null
          landmark_type: string | null
          name: string | null
          tags: Json | null
          triangulation_weight: number | null
          typical_accuracy_meters: number | null
          verified: boolean | null
        }
        Insert: {
          centroid_wkt?: never
          id?: number | null
          landmark_subtype?: string | null
          landmark_type?: string | null
          name?: string | null
          tags?: Json | null
          triangulation_weight?: number | null
          typical_accuracy_meters?: number | null
          verified?: boolean | null
        }
        Update: {
          centroid_wkt?: never
          id?: number | null
          landmark_subtype?: string | null
          landmark_type?: string | null
          name?: string | null
          tags?: Json | null
          triangulation_weight?: number | null
          typical_accuracy_meters?: number | null
          verified?: boolean | null
        }
        Relationships: []
      }
      public_iebc_offices: {
        Row: {
          clean_office_location: string | null
          constituency: string | null
          constituency_code: number | null
          constituency_name: string | null
          county: string | null
          formatted_address: string | null
          geom: unknown | null
          id: number | null
          landmark: string | null
          latitude: number | null
          longitude: number | null
          office_location: string | null
          verified: boolean | null
        }
        Insert: {
          clean_office_location?: string | null
          constituency?: string | null
          constituency_code?: number | null
          constituency_name?: string | null
          county?: string | null
          formatted_address?: string | null
          geom?: unknown | null
          id?: number | null
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          office_location?: string | null
          verified?: boolean | null
        }
        Update: {
          clean_office_location?: string | null
          constituency?: string | null
          constituency_code?: number | null
          constituency_name?: string | null
          county?: string | null
          formatted_address?: string | null
          geom?: unknown | null
          id?: number | null
          landmark?: string | null
          latitude?: number | null
          longitude?: number | null
          office_location?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "iebc_offices_constituency_fkey"
            columns: ["constituency"]
            isOneToOne: false
            referencedRelation: "constituencies"
            referencedColumns: ["name"]
          },
        ]
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _postgis_scripts_pgsql_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_bestsrid: {
        Args: { "": unknown }
        Returns: number
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
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
      _st_equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
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
      _st_pointoutside: {
        Args: { "": unknown }
        Returns: unknown
      }
      _st_sortablehash: {
        Args: { geom: unknown }
        Returns: number
      }
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
      _st_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      addauth: {
        Args: { "": string }
        Returns: boolean
      }
      addgeometrycolumn: {
        Args:
          | {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
          | {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
          | {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
        Returns: string
      }
      approve_contribution: {
        Args: { admin_user_id?: string; contribution_id: number }
        Returns: Json
      }
      box: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box2d: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box2d_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2d_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2df_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box2df_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3d: {
        Args: { "": unknown } | { "": unknown }
        Returns: unknown
      }
      box3d_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3d_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      box3dtobox: {
        Args: { "": unknown }
        Returns: unknown
      }
      bytea: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      bytea_to_text: {
        Args: { data: string }
        Returns: string
      }
      calculate_bounding_box: {
        Args: { center_lat: number; center_lon: number; radius_meters: number }
        Returns: string
      }
      check_submission_rate_limit: {
        Args: { p_device_hash: string; p_ip_hash: string }
        Returns: {
          allowed: boolean
          reason: string
          retry_after_seconds: number
        }[]
      }
      cube: {
        Args: { "": number[] } | { "": number }
        Returns: unknown
      }
      cube_dim: {
        Args: { "": unknown }
        Returns: number
      }
      cube_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      cube_is_point: {
        Args: { "": unknown }
        Returns: boolean
      }
      cube_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      cube_recv: {
        Args: { "": unknown }
        Returns: unknown
      }
      cube_send: {
        Args: { "": unknown }
        Returns: string
      }
      cube_size: {
        Args: { "": unknown }
        Returns: number
      }
      disablelongtransactions: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      dropgeometrycolumn: {
        Args:
          | {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
          | { column_name: string; schema_name: string; table_name: string }
          | { column_name: string; table_name: string }
        Returns: string
      }
      dropgeometrytable: {
        Args:
          | { catalog_name: string; schema_name: string; table_name: string }
          | { schema_name: string; table_name: string }
          | { table_name: string }
        Returns: string
      }
      earth: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      enablelongtransactions: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      fetch_and_store_osm_landmarks: {
        Args: { p_lat: number; p_lng: number; p_radius_meters?: number }
        Returns: {
          landmarks_added: number
          total_landmarks: number
        }[]
      }
      find_duplicate_offices: {
        Args: {
          p_lat: number
          p_lng: number
          p_name: string
          p_radius_meters?: number
        }
        Returns: {
          distance_meters: number
          is_likely_duplicate: boolean
          name_similarity: number
          office_id: number
          office_name: string
        }[]
      }
      find_nearby_offices: {
        Args: { lat: number; lon: number; radius?: number }
        Returns: {
          distance: number
          id: number
          latitude: number
          longitude: number
          office_location: string
        }[]
      }
      gc_to_sec: {
        Args: { "": number }
        Returns: number
      }
      geography: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      geography_analyze: {
        Args: { "": unknown }
        Returns: boolean
      }
      geography_gist_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_gist_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_send: {
        Args: { "": unknown }
        Returns: string
      }
      geography_spgist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geography_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      geography_typmod_out: {
        Args: { "": number }
        Returns: unknown
      }
      geometry: {
        Args:
          | { "": string }
          | { "": string }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
          | { "": unknown }
        Returns: unknown
      }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_analyze: {
        Args: { "": unknown }
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
      geometry_gist_compress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_decompress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_decompress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_gist_sortsupport_2d: {
        Args: { "": unknown }
        Returns: undefined
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_hash: {
        Args: { "": unknown }
        Returns: number
      }
      geometry_in: {
        Args: { "": unknown }
        Returns: unknown
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
      geometry_out: {
        Args: { "": unknown }
        Returns: unknown
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
      geometry_recv: {
        Args: { "": unknown }
        Returns: unknown
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
      geometry_send: {
        Args: { "": unknown }
        Returns: string
      }
      geometry_sortsupport: {
        Args: { "": unknown }
        Returns: undefined
      }
      geometry_spgist_compress_2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_spgist_compress_3d: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_spgist_compress_nd: {
        Args: { "": unknown }
        Returns: unknown
      }
      geometry_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      geometry_typmod_out: {
        Args: { "": number }
        Returns: unknown
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometrytype: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      geomfromewkb: {
        Args: { "": string }
        Returns: unknown
      }
      geomfromewkt: {
        Args: { "": string }
        Returns: unknown
      }
      get_nearby_iebc_offices: {
        Args: { p_lat: number; p_lng: number; p_radius: number }
        Returns: {
          constituency_code: number
          constituency_name: string
          county: string
          distance_meters: number
          office_direction_distance: number
          office_direction_landmark: string
          office_direction_type: string
          office_id: number
          office_landmark: string
          office_landmark_type: string
          office_latitude: number
          office_location: string
          office_longitude: number
          office_name: string
        }[]
      }
      get_optimal_triangulation_landmarks: {
        Args: {
          p_lat: number
          p_lng: number
          p_max_landmarks?: number
          p_radius_meters?: number
        }
        Returns: {
          bearing_degrees: number
          direction_description: string
          distance_meters: number
          landmark_id: number
          landmark_latitude: number
          landmark_longitude: number
          landmark_name: string
          landmark_subtype: string
          landmark_type: string
          quality_score: number
          side_of_road: string
          triangulation_weight: number
          typical_accuracy_meters: number
        }[]
      }
      get_proj4_from_srid: {
        Args: { "": number }
        Returns: string
      }
      gettransactionid: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      gidx_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gidx_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_delete: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_get: {
        Args: { data: Json; uri: string } | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
      }
      http_list_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_post: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { data: Json; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_reset_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      insert_index_usage_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      is_admin_user: {
        Args: Record<PropertyKey, never> | { user_id: string }
        Returns: boolean
      }
      json: {
        Args: { "": unknown }
        Returns: Json
      }
      jsonb: {
        Args: { "": unknown }
        Returns: Json
      }
      latitude: {
        Args: { "": unknown }
        Returns: number
      }
      longitude: {
        Args: { "": unknown }
        Returns: number
      }
      longtransactionsenabled: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      map_osm_element_to_landmark: {
        Args: { element_data: Json }
        Returns: {
          accuracy_meters: number
          landmark_subtype: string
          landmark_type: string
          latitude: number
          longitude: number
          name: string
          permanence_score: number
          triangulation_weight: number
          visibility_score: number
        }[]
      }
      normalize_county_name: {
        Args: { name: string }
        Returns: string
      }
      normalize_text: {
        Args: { text_to_normalize: string }
        Returns: string
      }
      path: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_asflatgeobuf_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asgeobuf_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asmvt_finalfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_asmvt_serialfn: {
        Args: { "": unknown }
        Returns: string
      }
      pgis_geometry_clusterintersecting_finalfn: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      pgis_geometry_clusterwithin_finalfn: {
        Args: { "": unknown }
        Returns: unknown[]
      }
      pgis_geometry_collect_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_makeline_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_polygonize_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_union_parallel_finalfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      pgis_geometry_union_parallel_serialfn: {
        Args: { "": unknown }
        Returns: string
      }
      point: {
        Args: { "": unknown }
        Returns: unknown
      }
      polygon: {
        Args: { "": unknown }
        Returns: unknown
      }
      populate_geometry_columns: {
        Args:
          | { tbl_oid: unknown; use_typmod?: boolean }
          | { use_typmod?: boolean }
        Returns: string
      }
      postgis_addbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
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
      postgis_dropbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_extensions_upgrade: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_full_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_geos_noop: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_geos_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_getbbox: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_hasbbox: {
        Args: { "": unknown }
        Returns: boolean
      }
      postgis_index_supportfn: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_lib_build_date: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_lib_revision: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_lib_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libjson_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_liblwgeom_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libprotobuf_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_libxml_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_noop: {
        Args: { "": unknown }
        Returns: unknown
      }
      postgis_proj_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_build_date: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_installed: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_scripts_released: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_svn_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_typmod_dims: {
        Args: { "": number }
        Returns: number
      }
      postgis_typmod_srid: {
        Args: { "": number }
        Returns: number
      }
      postgis_typmod_type: {
        Args: { "": number }
        Returns: string
      }
      postgis_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      postgis_wagyu_version: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      promote_contribution_to_office: {
        Args: {
          p_admin_id: string
          p_contribution_id: number
          p_office_data?: Json
        }
        Returns: {
          message: string
          new_office_id: number
          success: boolean
        }[]
      }
      proper_case: {
        Args: { name: string }
        Returns: string
      }
      sec_to_gc: {
        Args: { "": number }
        Returns: number
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      spheroid_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      spheroid_out: {
        Args: { "": unknown }
        Returns: unknown
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
      st_3dlength: {
        Args: { "": unknown }
        Returns: number
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
      st_3dperimeter: {
        Args: { "": unknown }
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
      st_angle: {
        Args:
          | { line1: unknown; line2: unknown }
          | { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
        Returns: number
      }
      st_area: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_area2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_asbinary: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
      }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkb: {
        Args: { "": unknown }
        Returns: string
      }
      st_asewkt: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      st_asgeojson: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; options?: number }
          | { geom: unknown; maxdecimaldigits?: number; options?: number }
          | {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
        Returns: string
      }
      st_asgml: {
        Args:
          | { "": string }
          | {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
          | {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
          | {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
          | { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_ashexewkb: {
        Args: { "": unknown }
        Returns: string
      }
      st_askml: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
          | { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
        Returns: string
      }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: {
        Args: { format?: string; geom: unknown }
        Returns: string
      }
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
      st_assvg: {
        Args:
          | { "": string }
          | { geog: unknown; maxdecimaldigits?: number; rel?: number }
          | { geom: unknown; maxdecimaldigits?: number; rel?: number }
        Returns: string
      }
      st_astext: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      st_astwkb: {
        Args:
          | {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
          | {
              geom: unknown
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
      st_azimuth: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_boundary: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer: {
        Args:
          | { geom: unknown; options?: string; radius: number }
          | { geom: unknown; quadsegs: number; radius: number }
        Returns: unknown
      }
      st_buildarea: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_centroid: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      st_cleangeometry: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_clusterintersecting: {
        Args: { "": unknown[] }
        Returns: unknown[]
      }
      st_collect: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collectionextract: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_collectionhomogenize: {
        Args: { "": unknown }
        Returns: unknown
      }
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
      st_convexhull: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_coorddim: {
        Args: { geometry: unknown }
        Returns: number
      }
      st_coveredby: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_covers: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
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
      st_dimension: {
        Args: { "": unknown }
        Returns: number
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance: {
        Args:
          | { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
          | { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_distancesphere: {
        Args:
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; radius: number }
        Returns: number
      }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dump: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumppoints: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumprings: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
      }
      st_dumpsegments: {
        Args: { "": unknown }
        Returns: Database["public"]["CompositeTypes"]["geometry_dump"][]
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
      st_endpoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_envelope: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_equals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_expand: {
        Args:
          | { box: unknown; dx: number; dy: number }
          | { box: unknown; dx: number; dy: number; dz?: number }
          | { dm?: number; dx: number; dy: number; dz?: number; geom: unknown }
        Returns: unknown
      }
      st_exteriorring: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_flipcoordinates: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_force2d: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_force3d: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
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
      st_forcecollection: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcecurve: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcepolygonccw: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcepolygoncw: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcerhr: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_forcesfs: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_generatepoints: {
        Args:
          | { area: unknown; npoints: number }
          | { area: unknown; npoints: number; seed: number }
        Returns: unknown
      }
      st_geogfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geogfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geographyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geohash: {
        Args:
          | { geog: unknown; maxchars?: number }
          | { geom: unknown; maxchars?: number }
        Returns: string
      }
      st_geomcollfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomcollfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geometrytype: {
        Args: { "": unknown }
        Returns: string
      }
      st_geomfromewkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromewkt: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromgeojson: {
        Args: { "": Json } | { "": Json } | { "": string }
        Returns: unknown
      }
      st_geomfromgml: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromkml: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfrommarc21: {
        Args: { marc21xml: string }
        Returns: unknown
      }
      st_geomfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromtwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_geomfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_gmltosql: {
        Args: { "": string }
        Returns: unknown
      }
      st_hasarc: {
        Args: { geometry: unknown }
        Returns: boolean
      }
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
      st_intersects: {
        Args:
          | { geog1: unknown; geog2: unknown }
          | { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_isclosed: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_iscollection: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isempty: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_ispolygonccw: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_ispolygoncw: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isring: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_issimple: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isvalid: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
      }
      st_isvalidreason: {
        Args: { "": unknown }
        Returns: string
      }
      st_isvalidtrajectory: {
        Args: { "": unknown }
        Returns: boolean
      }
      st_length: {
        Args:
          | { "": string }
          | { "": unknown }
          | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_length2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_letters: {
        Args: { font?: Json; letters: string }
        Returns: unknown
      }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefrommultipoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_linefromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_linefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linemerge: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_linestringfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_linetocurve: {
        Args: { geometry: unknown }
        Returns: unknown
      }
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
      st_m: {
        Args: { "": unknown }
        Returns: number
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { "": unknown[] } | { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makepolygon: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { "": unknown } | { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_maximuminscribedcircle: {
        Args: { "": unknown }
        Returns: Record<string, unknown>
      }
      st_memsize: {
        Args: { "": unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_minimumboundingradius: {
        Args: { "": unknown }
        Returns: Record<string, unknown>
      }
      st_minimumclearance: {
        Args: { "": unknown }
        Returns: number
      }
      st_minimumclearanceline: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_mlinefromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mlinefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpolyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_mpolyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multi: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_multilinefromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multilinestringfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipolyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_multipolygonfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_ndims: {
        Args: { "": unknown }
        Returns: number
      }
      st_node: {
        Args: { g: unknown }
        Returns: unknown
      }
      st_normalize: {
        Args: { geom: unknown }
        Returns: unknown
      }
      st_npoints: {
        Args: { "": unknown }
        Returns: number
      }
      st_nrings: {
        Args: { "": unknown }
        Returns: number
      }
      st_numgeometries: {
        Args: { "": unknown }
        Returns: number
      }
      st_numinteriorring: {
        Args: { "": unknown }
        Returns: number
      }
      st_numinteriorrings: {
        Args: { "": unknown }
        Returns: number
      }
      st_numpatches: {
        Args: { "": unknown }
        Returns: number
      }
      st_numpoints: {
        Args: { "": unknown }
        Returns: number
      }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_orientedenvelope: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { "": unknown } | { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_perimeter2d: {
        Args: { "": unknown }
        Returns: number
      }
      st_pointfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_pointfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointonsurface: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_points: {
        Args: { "": unknown }
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
      st_polyfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_polyfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonfromtext: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonfromwkb: {
        Args: { "": string }
        Returns: unknown
      }
      st_polygonize: {
        Args: { "": unknown[] }
        Returns: unknown
      }
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
      st_relate: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: string
      }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_reverse: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid: {
        Args: { geog: unknown; srid: number } | { geom: unknown; srid: number }
        Returns: unknown
      }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shiftlongitude: {
        Args: { "": unknown }
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
      st_split: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid: {
        Args: { geog: unknown } | { geom: unknown }
        Returns: number
      }
      st_startpoint: {
        Args: { "": unknown }
        Returns: unknown
      }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_summary: {
        Args: { "": unknown } | { "": unknown }
        Returns: string
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
      st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_transform: {
        Args:
          | { from_proj: string; geom: unknown; to_proj: string }
          | { from_proj: string; geom: unknown; to_srid: number }
          | { geom: unknown; to_proj: string }
        Returns: unknown
      }
      st_triangulatepolygon: {
        Args: { g1: unknown }
        Returns: unknown
      }
      st_union: {
        Args:
          | { "": unknown[] }
          | { geom1: unknown; geom2: unknown }
          | { geom1: unknown; geom2: unknown; gridsize: number }
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
      st_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_wkbtosql: {
        Args: { wkb: string }
        Returns: unknown
      }
      st_wkttosql: {
        Args: { "": string }
        Returns: unknown
      }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      st_x: {
        Args: { "": unknown }
        Returns: number
      }
      st_xmax: {
        Args: { "": unknown }
        Returns: number
      }
      st_xmin: {
        Args: { "": unknown }
        Returns: number
      }
      st_y: {
        Args: { "": unknown }
        Returns: number
      }
      st_ymax: {
        Args: { "": unknown }
        Returns: number
      }
      st_ymin: {
        Args: { "": unknown }
        Returns: number
      }
      st_z: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmax: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmflag: {
        Args: { "": unknown }
        Returns: number
      }
      st_zmin: {
        Args: { "": unknown }
        Returns: number
      }
      submit_signature: {
        Args: {
          constituency: string
          device_id: string
          key_version: string
          petition_id: string
          public_key: Json
          signature_payload: Json
          signature_value: string
          voter_id: string
          voter_name: string
          ward: string
        }
        Returns: string
      }
      text: {
        Args: { "": unknown }
        Returns: string
      }
      text_to_bytea: {
        Args: { data: string }
        Returns: string
      }
      unlockrows: {
        Args: { "": string }
        Returns: number
      }
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
      urlencode: {
        Args: { data: Json } | { string: string } | { string: string }
        Returns: string
      }
      verify_signature: {
        Args: { payload: Json; public_key: Json; signature: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown | null
      }
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown | null
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown | null
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
    Enums: {},
  },
} as const
