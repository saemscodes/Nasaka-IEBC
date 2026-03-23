import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const officeId = url.searchParams.get('id');

    if (!officeId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Office ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get office with all related data
    const { data: office, error } = await supabase
      .from('iebc_offices')
      .select(`
        *,
        confirmations(
          id,
          is_accurate,
          notes,
          created_at,
          user_id,
          confirmation_weight
        ),
        operational_status_history(
          id,
          status,
          notes,
          created_at,
          verified_by,
          evidence_photos
        ),
        contact_update_requests(
          id,
          field_name,
          new_value,
          old_value,
          status,
          created_at,
          submitted_by,
          approved_at
        ),
        contributions(
          id,
          contribution_type,
          description,
          evidence_photos,
          status,
          created_at,
          submitted_by,
          votes_count
        ),
        registration_deadlines(
          id,
          deadline_type,
          deadline_date,
          description,
          is_active
        )
      `)
      .eq('id', officeId)
      .single();

    if (error && error.code === 'PGRST116') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Office not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (error) throw error;

    // Get verification statistics
    const { data: verificationStats } = await supabase
      .from('office_verification_stats')
      .select('*')
      .eq('office_id', officeId)
      .single();

    // Get nearby offices
    if (office.latitude && office.longitude) {
      const { data: nearbyOffices } = await supabase
        .rpc('nearby_offices', {
          lat: office.latitude,
          lng: office.longitude,
          radius_km: 10,
          limit_count: 5
        });

      office.nearbyOffices = nearbyOffices?.filter(o => o.id !== officeId) || [];
    }

    // Calculate derived metrics
    const totalConfirmations = office.confirmations?.length || 0;
    const accurateConfirmations = office.confirmations?.filter(c => c.is_accurate).length || 0;
    const accuracyRate = totalConfirmations > 0 ? accurateConfirmations / totalConfirmations : 0;

    const pendingContributions = office.contributions?.filter(c => c.status === 'pending').length || 0;
    const approvedContributions = office.contributions?.filter(c => c.status === 'approved').length || 0;

    const pendingContactUpdates = office.contact_update_requests?.filter(r => r.status === 'pending').length || 0;

    const activeDeadlines = office.registration_deadlines?.filter(d => d.is_active).length || 0;

    // Enhanced office object
    const enhancedOffice = {
      ...office,
      verificationStats: verificationStats || {
        totalConfirmations,
        accurateConfirmations,
        accuracyRate: Math.round(accuracyRate * 100) / 100,
        lastConfirmedAt: office.confirmations?.[0]?.created_at || null
      },
      metrics: {
        totalConfirmations,
        accurateConfirmations,
        accuracyRate: Math.round(accuracyRate * 100) / 100,
        pendingContributions,
        approvedContributions,
        pendingContactUpdates,
        activeDeadlines,
        totalStatusReports: office.operational_status_history?.length || 0
      }
    };

    return new Response(JSON.stringify({
      success: true,
      data: enhancedOffice
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Office with Relations API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
