import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_SERVICE_URL,
  process.env.VITE_SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { contributionId, adminId, notes, autoApply } = body;

    if (!contributionId || !adminId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'contributionId and adminId are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify admin permissions
    const { data: adminProfile } = await supabase
      .from('nasaka_profiles')
      .select('role')
      .eq('user_id', adminId)
      .single();

    if (!adminProfile || !['admin', 'moderator'].includes(adminProfile.role)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Insufficient permissions'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get contribution details
    const { data: contribution, error: fetchError } = await supabase
      .from('contributions')
      .select('*')
      .eq('id', contributionId)
      .single();

    if (fetchError) throw fetchError;

    // Update contribution status
    const { data: updatedContribution, error: updateError } = await supabase
      .from('contributions')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: adminId,
        admin_notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', contributionId)
      .select(`
        *,
        iebc_offices(
          office_location,
          constituency_name,
          county
        )
      `)
      .single();

    if (updateError) throw updateError;

    // Auto-apply changes if requested and applicable
    if (autoApply && contribution.contribution_type === 'location_update' && contribution.location_data) {
      const { error: applyError } = await supabase
        .from('iebc_offices')
        .update({
          latitude: contribution.location_data.latitude,
          longitude: contribution.location_data.longitude,
          formatted_address: contribution.location_data.address,
          landmark: contribution.location_data.landmark,
          updated_at: new Date().toISOString()
        })
        .eq('id', contribution.office_id);

      if (applyError) throw applyError;
    }

    // Update contributor reputation
    await updateUserReputation(contribution.user_id, 0.1);

    return new Response(JSON.stringify({
      success: true,
      data: updatedContribution,
      message: 'Contribution approved successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Approve Contribution API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function updateUserReputation(userId, increment) {
  const { data: profile } = await supabase
    .from('nasaka_profiles')
    .select('reputation_score')
    .eq('user_id', userId)
    .single();

  const newScore = Math.min(1, Math.max(0, (profile?.reputation_score || 0) + increment));

  await supabase
    .from('nasaka_profiles')
    .update({
      reputation_score: newScore,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);
}
