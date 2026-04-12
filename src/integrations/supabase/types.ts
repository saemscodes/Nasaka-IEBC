// src/integrations/supabase/types.ts
// Nasaka IEBC — Supabase Table Type Definitions

export interface ApiKey {
    id: string;
    key_hash: string;
    key_prefix?: string;
    user_id?: string;
    owner_name: string;
    owner_email: string;
    organization?: string;
    tier: 'jamii' | 'mwananchi' | 'taifa' | 'serikali' | 'enterprise' | 'free' | 'standard';
    is_active: boolean;
    created_at: string;
    expires_at?: string;
    last_used_at?: string;
    requests_today: number;
    requests_this_month: number;
    metadata?: Record<string, any>;
    // Billing columns (20260316)
    paystack_customer_code?: string;
    paystack_subscription_code?: string;
    paystack_plan_code?: string;
    tier_currency: string;
    billing_interval: 'monthly' | 'annual' | 'one_time' | 'credit_pack' | 'data_license';
    plan_status: 'active' | 'non_renewing' | 'past_due' | 'cancelled' | 'paused';
    current_period_start?: string;
    current_period_end?: string;
    monthly_request_count: number;
    monthly_reset_date?: string;
    credits_balance: number;
    is_locked: boolean;
    mpesa_renewal_method: 'manual_prompt' | 'card_fallback';
    renewal_reminder_sent_at?: string;
    // CEKA columns (20260317)
    ceka_user_id?: string;
}

export interface NasakaProfile {
    id: string;
    user_id: string;
    display_name?: string;
    avatar_url?: string;
    onboarding_completed: boolean;
    created_at: string;
    updated_at: string;
    ceka_id?: string;
    ceka_data?: Record<string, any>;
}

export interface NasakaUsageLog {
    id: string;
    api_key_id: string;
    endpoint: string;
    response_code: number;
    ip_hash?: string;
    request_weight: number;
    created_at: string;
}

export interface ApiUsageLog {
    id: number;
    api_key_id: string;
    endpoint: string;
    method: string;
    response_status?: number;
    response_time_ms?: number;
    ip_address?: string;
    created_at: string;
}

export interface NasakaPaystackEvent {
    id: string;
    paystack_event_id: string;
    event_type: string;
    api_key_id?: string;
    raw_payload: Record<string, any>;
    processed_at: string;
}

export interface NasakaPaymentHistory {
    id: string;
    api_key_id?: string;
    paystack_reference: string;
    channel: 'card' | 'mobile_money' | 'bank_transfer';
    amount_kobo: number;
    currency: string;
    tier_purchased: string;
    billing_interval: string;
    status: 'success' | 'failed' | 'reversed';
    paid_at?: string;
    created_at: string;
}

export interface NasakaEnterpriseLead {
    id: string;
    organisation_name: string;
    contact_name: string;
    contact_email: string;
    contact_phone?: string;
    organisation_type: 'county_government' | 'ngo' | 'development_agency' | 'media_house' | 'research_institution' | 'election_observer' | 'other';
    use_case: string;
    estimated_monthly_requests?: string;
    preferred_currency: string;
    status: 'new' | 'contacted' | 'proposal_sent' | 'contracted' | 'closed_lost';
    assigned_to?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface NasakaLicenseApplication {
    id: string;
    api_key_id?: string;
    applicant_name: string;
    institution: string;
    use_case_type: 'academic' | 'commercial' | 'nonprofit';
    use_case_description: string;
    license_type: 'academic' | 'commercial';
    status: 'pending' | 'approved' | 'rejected';
    paystack_reference?: string;
    approved_at?: string;
    download_url?: string;
    download_expires_at?: string;
    created_at: string;
}

export interface NasakaDiscountApplication {
    id: string;
    api_key_id?: string;
    applicant_email: string;
    organisation: string;
    discount_type: 'nonprofit' | 'academic';
    proof_document_url?: string;
    status: 'pending' | 'approved' | 'rejected';
    reviewed_at?: string;
    created_at: string;
}

export interface IEBCOffice {
    id: number;
    county: string;
    constituency: string;
    constituency_name?: string;
    constituency_code?: number;
    office_location: string;
    clean_office_location?: string;
    latitude: number;
    longitude: number;
    verified: boolean;
    formatted_address?: string;
    landmark?: string;
    distance_from_landmark?: string;
    contact_phone?: string;
    contact_email?: string;
    opening_hours?: string;
    // Ward hierarchy (20260321)
    ward?: string;
    ward_id?: string;
    // Mar 12 Enhancements
    elevation_meters?: number;
    isochrone_15min?: Record<string, any>;
    isochrone_30min?: Record<string, any>;
    isochrone_45min?: Record<string, any>;
    landmark_normalized?: string;
    landmark_source?: string;
    walking_effort?: 'low' | 'moderate' | 'high' | 'extreme';
    geocode_verified: boolean;
    geocode_verified_at?: string;
    multi_source_confidence?: number;
    created_at: string;
    updated_at: string;
    distance_km?: number; // Computed field
    // Gazette Extensions (20260331)
    centre_code?: string;
    caw_code?: string;
    county_code?: string;
    ward_code?: string;
    office_type?: 'CONSTITUENCY_OFFICE' | 'REGISTRATION_CENTRE';
    category?: 'office' | 'registration_centre';
    // Verification fields (20260331)
    verification_source?: string;
    image_url?: string;
}

export interface Ward {
    id: number;
    county: string;
    constituency: string;
    ward_name: string;
    latitude?: number;
    longitude?: number;
    total_voters?: number;
    total_count?: number;
    registration_target?: number;
    geocode_verified?: boolean;
    geocode_verified_at?: string;
    geocode_status?: string;
    geocode_method?: string;
    geocode_confidence?: number;
    multi_source_confidence?: number;
    formatted_address?: string;
    created_at: string;
    // Gazette Extensions (20260331)
    caw_code?: string;
    registration_centre_count?: number;
    // Statistics (20260331)
}

export interface VerificationLog {
    id: number;
    contribution_id?: number;
    office_id?: number;
    action: string;
    actor: string;
    details: Record<string, any>;
    created_at: string;
}

export interface SecurityAuditLog {
    id: number;
    action_type: string;
    table_name: string;
    record_id?: any;
    details: string;
    user_id?: string;
    created_at: string;
}

export interface IEBCOfficeContribution {
    id: number;
    original_office_id?: number;
    submitted_office_location: string;
    status: 'pending' | 'verified' | 'rejected' | 'merged';
    submission_method: string;
    submission_source: string;
    submitted_by?: string;
    review_notes?: string;
    reviewed_at?: string;
    created_at: string;
    // Extended fields
    county?: string;
    constituency?: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
}

export interface OperationalStatusHistory {
    id: number;
    office_id: number;
    status: 'operational' | 'closed' | 'relocated' | 'under_renovation';
    reason: string;
    reported_at: string;
    reported_by?: string;
}

export interface ContactUpdateRequest {
    id: number;
    office_id: number;
    phone?: string;
    email?: string;
    hours?: string;
    notes?: string;
    submitted_at: string;
    submitted_by?: string;
    status: 'pending' | 'approved' | 'rejected';
}

export interface ContributionVote {
    id: number;
    contribution_id: number;
    user_id: string;
    vote_type: 'upvote' | 'downvote' | 'helpful' | 'not_helpful';
    created_at: string;
}

export interface EvidenceDocument {
    id: string;
    petition_id: string;
    document_title: string;
    document_type: string;
    file_path: string;
    verification_status: 'pending' | 'verified' | 'rejected';
    uploaded_by?: string;
    created_at: string;
}

export interface Confirmation {
    id: number;
    contribution_id?: number;
    confirmer_lat: number;
    confirmer_lng: number;
    confirmer_accuracy_meters?: number;
    confirmer_ip_hash: string;
    confirmer_ua_hash?: string;
    confirmer_device_hash?: string;
    confirmation_weight?: number;
    confirmed_at: string;
    // Enhancement columns (20260327)
    office_id?: number;
    user_id?: string;
    is_accurate?: boolean;
    notes?: string;
}

export interface GeocodeAudit {
    id: string;
    office_id: number;
    constituency: string;
    county: string;
    issue_type: 'DISPLACED' | 'NULL_COORDS' | 'CLUSTERING' | 'DISPLACED_REVERIFY' | 'NULL_COORDS_REVERIFY' | 'CLUSTERING_REVERIFY';
    old_latitude?: number;
    old_longitude?: number;
    new_latitude?: number;
    new_longitude?: number;
    source_results?: any[];
    consensus_confidence?: number;
    agreement_count?: number;
    spread_km?: number;
    sources_used?: string[];
    resolution_method: 'auto' | 'admin_manual' | 'gold_standard' | 'multi_source_consensus';
    resolved_by?: string;
    applied: boolean;
    created_at: string;
}

export interface GeocodeHitlQueue {
    id: string;
    office_id: number;
    audit_id?: string;
    issue_type: string;
    proposed_latitude?: number;
    proposed_longitude?: number;
    confidence?: number;
    agreement_count?: number;
    spread_km?: number;
    source_details?: any[];
    status: 'pending' | 'approved' | 'dismissed' | 'auto_resolved';
    resolved_by?: string;
    resolved_at?: string;
    final_latitude?: number;
    final_longitude?: number;
    dismiss_reason?: string;
    created_at: string;
}

export interface AdminTask {
    id: string;
    task_type: string;
    status: 'pending' | 'running' | 'awaiting_approval' | 'completed' | 'failed';
    params: Record<string, any>;
    proposed_changes: any[];
    error_message?: string;
    created_at: string;
    updated_at: string;
    completed_at?: string;
    created_by?: string;
}

export interface AdminTaskLog {
    id: number;
    task_id: string;
    level: 'info' | 'warn' | 'error' | 'step' | 'success';
    message: string;
    metadata: Record<string, any>;
    timestamp: string;
}

export interface GeocodingServiceLog {
    id: number;
    service_name: 'nominatim' | 'opencage' | 'openrouteservice' | 'opentopo' | 'ipapi';
    request_type: 'forward_geocode' | 'reverse_geocode' | 'isochrone' | 'elevation' | 'ip_geolocation' | 'routing';
    query_text?: string;
    office_id?: number;
    response_status?: number;
    response_time_ms?: number;
    credits_used: number;
    created_at: string;
}

export interface DiasporaRegistrationCentre {
    id: string; // Mnemonic ID now
    mission_name: string;
    mission_type?: string;
    city: string;
    country: string;
    country_code?: string;
    continent?: string;
    region?: string;
    latitude: number;
    longitude: number;
    address?: string;
    google_maps_url?: string;
    phone?: string;
    email?: string;
    website_url?: string;
    whatsapp?: string;
    designation_state: 'embassy_only' | 'embassy_probable' | 'iebc_confirmed';
    designated_2017: boolean;
    designated_2022: boolean;
    designation_count: number;
    is_iebc_confirmed_2027: boolean;
    confirmed_2027_source_url?: string;
    confirmed_2027_gazette_ref?: string;
    services_2027?: string[];
    registration_opens_at?: string;
    registration_closes_at?: string;
    voting_date?: string;
    registration_requirements?: string[];
    inquiry_contact_name?: string;
    inquiry_contact_email?: string;
    inquiry_notes?: string;
    verified_at?: string;
    verification_source?: string;
    last_checked_at?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    geocode_status: 'precise' | 'approximate' | 'manual' | 'failed';
    geocode_method?: string;
    geocode_confidence?: number;
    formatted_address?: string;
}

export interface Signature {
    id: string;
    petition_id: string;
    voter_id: string;
    voter_name: string;
    constituency: string;
    ward: string;
    polling_station?: string;
    csp_provider?: string;
    signature_certificate?: any;
    verification_status?: any;
    device_fingerprint?: any;
    signature_timestamp: string;
    blockchain_hash?: string;
    created_at: string;
}

export interface Petition {
    id: string;
    mp_name: string;
    constituency: string;
    county: string;
    description: string;
    grounds: string[];
    signature_target: number;
    ward_target: number;
    deadline: string;
    status: 'active' | 'completed' | 'closed';
    created_by?: string;
    created_at: string;
    updated_at: string;
}

export interface AuditTrail {
    id: number;
    action_type: string;
    petition_id?: string;
    signature_id?: string;
    action_details: any;
    created_at: string;
}


export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]


export type Database = {
    public: {
        Tables: {
            iebc_offices: { Row: IEBCOffice; Insert: Partial<IEBCOffice>; Update: Partial<IEBCOffice>; Relationships: [] };
            diaspora_registration_centres: { Row: DiasporaRegistrationCentre; Insert: Partial<DiasporaRegistrationCentre>; Update: Partial<DiasporaRegistrationCentre>; Relationships: [] };
            wards: { Row: Ward; Insert: Partial<Ward>; Update: Partial<Ward>; Relationships: [] };
            confirmations: { Row: Confirmation; Insert: Partial<Confirmation>; Update: Partial<Confirmation>; Relationships: [] };
            geocode_audit: { Row: GeocodeAudit; Insert: Partial<GeocodeAudit>; Update: Partial<GeocodeAudit>; Relationships: [] };
            geocode_hitl_queue: { Row: GeocodeHitlQueue; Insert: Partial<GeocodeHitlQueue>; Update: Partial<GeocodeHitlQueue>; Relationships: [] };
            signatures: { Row: Signature; Insert: Partial<Signature>; Update: Partial<Signature>; Relationships: [] };
            petitions: { Row: Petition; Insert: Partial<Petition>; Update: Partial<Petition>; Relationships: [] };
            audit_trail: { Row: AuditTrail; Insert: Partial<AuditTrail>; Update: Partial<AuditTrail>; Relationships: [] };
            api_keys: { Row: ApiKey; Insert: Partial<ApiKey>; Update: Partial<ApiKey>; Relationships: [] };
            nasaka_profiles: { Row: NasakaProfile; Insert: Partial<NasakaProfile>; Update: Partial<NasakaProfile>; Relationships: [] };
            nasaka_usage_log: { Row: NasakaUsageLog; Insert: Partial<NasakaUsageLog>; Update: Partial<NasakaUsageLog>; Relationships: [] };
            api_usage_log: { Row: ApiUsageLog; Insert: Partial<ApiUsageLog>; Update: Partial<ApiUsageLog>; Relationships: [] };
            nasaka_paystack_events: { Row: NasakaPaystackEvent; Insert: Partial<NasakaPaystackEvent>; Update: Partial<NasakaPaystackEvent>; Relationships: [] };
            nasaka_payment_history: { Row: NasakaPaymentHistory; Insert: Partial<NasakaPaymentHistory>; Update: Partial<NasakaPaymentHistory>; Relationships: [] };
            nasaka_enterprise_leads: { Row: NasakaEnterpriseLead; Insert: Partial<NasakaEnterpriseLead>; Update: Partial<NasakaEnterpriseLead>; Relationships: [] };
            nasaka_license_applications: { Row: NasakaLicenseApplication; Insert: Partial<NasakaLicenseApplication>; Update: Partial<NasakaLicenseApplication>; Relationships: [] };
            nasaka_discount_applications: { Row: NasakaDiscountApplication; Insert: Partial<NasakaDiscountApplication>; Update: Partial<NasakaDiscountApplication>; Relationships: [] };
            admin_tasks: { Row: AdminTask; Insert: Partial<AdminTask>; Update: Partial<AdminTask>; Relationships: [] };
            admin_task_logs: { Row: AdminTaskLog; Insert: Partial<AdminTaskLog>; Update: Partial<AdminTaskLog>; Relationships: [] };
            geocoding_service_log: { Row: GeocodingServiceLog; Insert: Partial<GeocodingServiceLog>; Update: Partial<GeocodingServiceLog>; Relationships: [] };
            verification_log: { Row: VerificationLog; Insert: Partial<VerificationLog>; Update: Partial<VerificationLog>; Relationships: [] };
            security_audit_log: { Row: SecurityAuditLog; Insert: Partial<SecurityAuditLog>; Update: Partial<SecurityAuditLog>; Relationships: [] };
            iebc_office_contributions: { Row: IEBCOfficeContribution; Insert: Partial<IEBCOfficeContribution>; Update: Partial<IEBCOfficeContribution>; Relationships: [] };
            operational_status_history: { Row: OperationalStatusHistory; Insert: Partial<OperationalStatusHistory>; Update: Partial<OperationalStatusHistory>; Relationships: [] };
            contact_update_requests: { Row: ContactUpdateRequest; Insert: Partial<ContactUpdateRequest>; Update: Partial<ContactUpdateRequest>; Relationships: [] };
            contribution_votes: { Row: ContributionVote; Insert: Partial<ContributionVote>; Update: Partial<ContributionVote>; Relationships: [] };
            evidence_documents: { Row: EvidenceDocument; Insert: Partial<EvidenceDocument>; Update: Partial<EvidenceDocument>; Relationships: [] };
            constituencies: { Row: any; Insert: any; Update: any; Relationships: [] };
            counties: { Row: any; Insert: any; Update: any; Relationships: [] };
        };
        Views: {
            petition_stats: { Row: any; Relationships: [] };
        };
        Functions: {
            validate_api_key: { Args: { p_key_hash: string }; Returns: any[] };
            deduct_credits: { Args: { p_key_id: string; p_amount: number }; Returns: void };
            get_county_stats: { Args: Record<string, any>; Returns: any[] };
            get_tier_monthly_limit: { Args: { p_tier: string }; Returns: number };
            get_nearest_ward: { Args: { lat_param: number; lng_param: number }; Returns: any[] };
            find_offices_near_place: { Args: { search_lat: number; search_lng: number; radius_km?: number; max_results?: number }; Returns: any[] };
            search_offices_by_text_and_location: { Args: { search_query: string; search_lat?: number; search_lng?: number; radius_km?: number; max_results?: number }; Returns: any[] };
            search_offices_by_text_and_location_v2: { Args: { search_query: string; search_lat?: number; search_lng?: number; radius_km?: number; max_results?: number }; Returns: any[] };
            nearby_offices: { Args: { user_lat: number; user_lng: number; radius_km?: number }; Returns: any[] };
            charge_usage: { Args: { p_key_id: string; p_endpoint_weight?: number }; Returns: any[] };
            get_offices_by_walking_effort: { Args: { effort_level: string; limit_count?: number }; Returns: any[] };
            refresh_ward_metadata: { Args: Record<string, any>; Returns: void };
            get_office_stats: { Args: { office_id_param: number }; Returns: any[] };
            get_pending_contributions: { Args: { p_limit?: number; p_offset?: number }; Returns: any[] };
            get_contribution_details: { Args: { p_contribution_id: number }; Returns: any[] };
            get_trending_contributions: { Args: { days_back?: number; limit_count?: number }; Returns: any[] };
            search_offices_fuzzy: { Args: { search_term: string; limit_count?: number }; Returns: any[] };
            get_offices_by_status: { Args: { status_filter: string; limit_count?: number }; Returns: any[] };
            get_most_verified_offices: { Args: { limit_count?: number }; Returns: any[] };
            get_offices_needing_verification: { Args: { min_confirmations?: number; limit_count?: number }; Returns: any[] };
            bulk_update_verification: { Args: { office_ids: number[]; verified_status: boolean; verified_by_user?: string }; Returns: any[] };
            auto_approve_contact_updates: { Args: { min_confirmations?: number }; Returns: any[] };
            moderate_contribution: { Args: { p_contribution_id: number; p_action_type: string; p_actor: string; p_review_notes: string; p_archive_reason: string; p_original_office_id: number }; Returns: any };
            get_contributions_dashboard_stats: { Args: { constituency_name?: string; county_name?: string }; Returns: any };
            get_or_create_constituency: { Args: { constituency_name: string; county_name: string }; Returns: number };
            fix_all_constituency_relationships: { Args: Record<string, any>; Returns: any[] };
            get_archived_contributions: { Args: { p_limit: number; p_offset: number }; Returns: any[] };
            archive_contribution: { Args: { p_contribution_id: number; p_action_type: string; p_actor: string; p_review_notes: string; p_archive_reason: string; p_original_office_id: number | null }; Returns: any };
            find_duplicate_offices: { Args: { p_lat: number; p_lng: number; p_name: string; p_radius_meters: number }; Returns: any[] };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
    EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
    ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof Database
    }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
    ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
