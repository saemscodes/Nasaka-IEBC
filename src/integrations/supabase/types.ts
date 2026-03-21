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
    office_location: string;
    latitude: number;
    longitude: number;
    verified: boolean;
    formatted_address?: string;
    landmark?: string;
    contact_phone?: string;
    contact_email?: string;
    opening_hours?: string;
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
}

export interface Ward {
    id: number;
    county: string;
    constituency: string;
    ward_name: string;
    latitude: number;
    longitude: number;
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

// Database type map for Supabase client usage
export type Database = {
    public: {
        Tables: {
            iebc_offices: { Row: IEBCOffice; Insert: Partial<IEBCOffice>; Update: Partial<IEBCOffice> };
            api_keys: { Row: ApiKey; Insert: Partial<ApiKey>; Update: Partial<ApiKey> };
            nasaka_profiles: { Row: NasakaProfile; Insert: Partial<NasakaProfile>; Update: Partial<NasakaProfile> };
            nasaka_usage_log: { Row: NasakaUsageLog; Insert: Partial<NasakaUsageLog>; Update: Partial<NasakaUsageLog> };
            api_usage_log: { Row: ApiUsageLog; Insert: Partial<ApiUsageLog>; Update: Partial<ApiUsageLog> };
            nasaka_paystack_events: { Row: NasakaPaystackEvent; Insert: Partial<NasakaPaystackEvent>; Update: Partial<NasakaPaystackEvent> };
            nasaka_payment_history: { Row: NasakaPaymentHistory; Insert: Partial<NasakaPaymentHistory>; Update: Partial<NasakaPaymentHistory> };
            nasaka_enterprise_leads: { Row: NasakaEnterpriseLead; Insert: Partial<NasakaEnterpriseLead>; Update: Partial<NasakaEnterpriseLead> };
            nasaka_license_applications: { Row: NasakaLicenseApplication; Insert: Partial<NasakaLicenseApplication>; Update: Partial<NasakaLicenseApplication> };
            nasaka_discount_applications: { Row: NasakaDiscountApplication; Insert: Partial<NasakaDiscountApplication>; Update: Partial<NasakaDiscountApplication> };
            admin_tasks: { Row: AdminTask; Insert: Partial<AdminTask>; Update: Partial<AdminTask> };
            admin_task_logs: { Row: AdminTaskLog; Insert: Partial<AdminTaskLog>; Update: Partial<AdminTaskLog> };
            geocoding_service_log: { Row: GeocodingServiceLog; Insert: Partial<GeocodingServiceLog>; Update: Partial<GeocodingServiceLog> };
            wards: { Row: Ward; Insert: Partial<Ward>; Update: Partial<Ward> };
        };
        Functions: {
            validate_api_key: {
                Args: { p_key_hash: string };
                Returns: {
                    id: string;
                    tier: string;
                    requests_today: number;
                    is_active: boolean;
                    monthly_request_count: number;
                    credits_balance: number;
                    is_locked: boolean;
                    plan_status: string;
                    current_period_end: string;
                    monthly_reset_date: string;
                }[];
            };
            deduct_credits: {
                Args: { p_key_id: string; p_amount: number };
                Returns: void;
            };
            get_county_stats: {
                Args: Record<string, never>;
                Returns: {
                    county: string;
                    office_count: number;
                    mapped_count: number;
                    verified_count: number;
                }[];
            };
            get_tier_monthly_limit: {
                Args: { p_tier: string };
                Returns: number;
            };
            get_nearest_ward: {
                Args: { lat_param: number; lng_param: number };
                Returns: Ward[];
            };
        };
    };
};
