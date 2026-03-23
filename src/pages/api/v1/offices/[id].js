import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const { data: office, error } = await supabase
      .from('iebc_offices')
      .select(`
        *,
        confirmations(count),
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
          submitted_by
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
        )
      `)
      .eq('id', id)
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

    // Get nearby offices for context
    const { data: nearbyOffices } = await supabase
      .rpc('nearby_offices', {
        lat: office.latitude,
        lng: office.longitude,
        radius_km: 10,
        limit_count: 5
      });

    // Get verification statistics
    const { data: stats } = await supabase
      .from('office_verification_stats')
      .select('*')
      .eq('office_id', id)
      .single();

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...office,
        nearbyOffices: nearbyOffices?.filter(o => o.id !== id) || [],
        verificationStats: stats
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Office Detail API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    const { data: office, error } = await supabase
      .from('iebc_offices')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      data: office
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Office Update API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    const { error } = await supabase
      .from('iebc_offices')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      message: 'Office deleted successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Office Delete API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
