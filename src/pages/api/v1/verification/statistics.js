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

    let query = supabase
      .from('office_verification_stats')
      .select('*');

    if (officeId) {
      query = query.eq('office_id', officeId);
    }
    if (county) {
      query = query.eq('county', county);
    }

    const { data: stats, error } = await query;

    if (error) throw error;

    // If no specific office/county, return overall statistics
    if (!officeId && !county) {
      const { data: overallStats } = await supabase
        .rpc('get_verification_overview');

      return new Response(JSON.stringify({
        success: true,
        data: overallStats,
        type: 'overview'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: stats,
      type: officeId ? 'office' : 'county'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Verification Statistics API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
