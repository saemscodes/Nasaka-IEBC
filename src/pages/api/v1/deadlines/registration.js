import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const officeId = url.searchParams.get('officeId');
    const county = url.searchParams.get('county');
    const active = url.searchParams.get('active');

    let query = supabase
      .from('registration_deadlines')
      .select(`
        *,
        iebc_offices(
          office_location,
          constituency_name,
          county
        )
      `)
      .order('deadline_date', { ascending: true });

    if (officeId) {
      query = query.eq('office_id', officeId);
    }
    if (county) {
      query = query.eq('county', county);
    }
    if (active !== null) {
      const isActive = active === 'true';
      query = query.eq('is_active', isActive);
    }

    const { data: deadlines, error } = await query;

    if (error) throw error;

    // Enhance deadlines with days remaining
    const enhancedDeadlines = deadlines.map(deadline => {
      const today = new Date();
      const deadlineDate = new Date(deadline.deadline_date);
      const daysRemaining = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
      const isOverdue = daysRemaining < 0;
      const isUrgent = daysRemaining >= 0 && daysRemaining <= 7;

      return {
        ...deadline,
        daysRemaining,
        isOverdue,
        isUrgent,
        iebc_offices: deadline.iebc_offices ? {
          office_location: deadline.iebc_offices.office_location,
          constituency_name: deadline.iebc_offices.constituency_name,
          county: deadline.iebc_offices.county
        } : null
      };
    });

    return new Response(JSON.stringify({
      success: true,
      data: enhancedDeadlines,
      total: enhancedDeadlines.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Registration Deadlines API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      officeId,
      deadlineType,
      deadlineDate,
      description,
      isActive
    } = body;

    if (!officeId || !deadlineType || !deadlineDate) {
      return new Response(JSON.stringify({
        success: false,
        error: 'officeId, deadlineType, and deadlineDate are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate deadline type
    const validTypes = ['voter_registration', 'candidate_registration', 'special_event', 'verification_deadline'];
    if (!validTypes.includes(deadlineType)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid deadline type. Must be one of: ' + validTypes.join(', ')
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get office information for county
    const { data: office } = await supabase
      .from('iebc_offices')
      .select('county, constituency_name')
      .eq('id', officeId)
      .single();

    const { data: deadline, error } = await supabase
      .from('registration_deadlines')
      .insert({
        office_id: officeId,
        county: office?.county || 'Unknown',
        deadline_type: deadlineType,
        deadline_date: deadlineDate,
        description: description || null,
        is_active: isActive !== undefined ? isActive : true,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        iebc_offices(
          office_location,
          constituency_name,
          county
        )
      `)
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      data: deadline,
      message: 'Registration deadline created successfully'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Create Deadline API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
