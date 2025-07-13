export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
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
      constituencies: {
        Row: {
          county_id: number
          id: number
          member_of_parliament: string | null
          name: string
          registration_target: number
        }
        Insert: {
          county_id: number
          id?: number
          member_of_parliament?: string | null
          name: string
          registration_target: number
        }
        Update: {
          county_id?: number
          id?: number
          member_of_parliament?: string | null
          name?: string
          registration_target?: number
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
      counties: {
        Row: {
          governor: string | null
          id: number
          name: string
          registration_target: number
          senator: string | null
        }
        Insert: {
          governor?: string | null
          id?: number
          name: string
          registration_target: number
          senator?: string | null
        }
        Update: {
          governor?: string | null
          id?: number
          name?: string
          registration_target?: number
          senator?: string | null
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
      petitions: {
        Row: {
          constituency: string
          county: string
          created_at: string
          created_by: string | null
          deadline: string
          description: string
          evidence_documents: Json | null
          grounds: string[]
          id: string
          mp_name: string
          signature_target: number
          status: string
          updated_at: string
          ward_target: number
        }
        Insert: {
          constituency: string
          county: string
          created_at?: string
          created_by?: string | null
          deadline: string
          description: string
          evidence_documents?: Json | null
          grounds: string[]
          id?: string
          mp_name: string
          signature_target: number
          status?: string
          updated_at?: string
          ward_target: number
        }
        Update: {
          constituency?: string
          county?: string
          created_at?: string
          created_by?: string | null
          deadline?: string
          description?: string
          evidence_documents?: Json | null
          grounds?: string[]
          id?: string
          mp_name?: string
          signature_target?: number
          status?: string
          updated_at?: string
          ward_target?: number
        }
        Relationships: []
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
      signatures: {
        Row: {
          blockchain_hash: string | null
          constituency: string
          created_at: string
          csp_provider: string
          device_fingerprint: Json | null
          geolocation: Json | null
          id: string
          petition_id: string
          polling_station: string | null
          signature_certificate: string | null
          signature_timestamp: string
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
          geolocation?: Json | null
          id?: string
          petition_id: string
          polling_station?: string | null
          signature_certificate?: string | null
          signature_timestamp?: string
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
          geolocation?: Json | null
          id?: string
          petition_id?: string
          polling_station?: string | null
          signature_certificate?: string | null
          signature_timestamp?: string
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
      wards: {
        Row: {
          constituency: string
          county: string
          created_at: string
          id: string
          member_of_parliament: string | null
          registration_target: number | null
          ward_name: string
        }
        Insert: {
          constituency: string
          county: string
          created_at?: string
          id?: string
          member_of_parliament?: string | null
          registration_target?: number | null
          ward_name: string
        }
        Update: {
          constituency?: string
          county?: string
          created_at?: string
          id?: string
          member_of_parliament?: string | null
          registration_target?: number | null
          ward_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
