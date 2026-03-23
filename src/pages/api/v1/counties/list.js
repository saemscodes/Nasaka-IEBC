import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const includeOfficeCount = url.searchParams.get('includeOfficeCount') === 'true';

    let query = supabase
      .from('iebc_offices')
      .select('county', { count: 'exact', distinct: true });

    const { data: counties, error } = await query;

    if (error) throw error;

    // Extract unique counties
    const uniqueCounties = [...new Set(counties?.map(c => c.county) || [])]
      .filter(Boolean)
      .sort();

    let result = {
      success: true,
      data: uniqueCounties.map(county => ({ county })),
      total: uniqueCounties.length
    };

    // Include office counts if requested
    if (includeOfficeCount) {
      const { data: officesWithCounts } = await supabase
        .from('iebc_offices')
        .select('county, verified, operational_status')
        .in('county', uniqueCounties);

      const countyStats = uniqueCounties.reduce((acc, county) => {
        const countyOffices = officesWithCounts?.filter(o => o.county === county) || [];
        acc[county] = {
          totalOffices: countyOffices.length,
          verifiedOffices: countyOffices.filter(o => o.verified).length,
          operationalOffices: countyOffices.filter(o => o.operational_status === 'operational').length
        };
        return acc;
      }, {});

      result.data = uniqueCounties.map(county => ({
        county,
        ...countyStats[county]
      }));
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Counties List API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
