import { createClient } from '@supabase/supabase-js';
import Fuse from 'fuse.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const county = url.searchParams.get('county');
    const limit = parseInt(url.searchParams.get('limit')) || 20;

    if (!query) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Search query is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all offices or filter by county first
    let dbQuery = supabase
      .from('iebc_offices')
      .select(`
        *,
        ward_name:ward,
        confirmations(count),
        operational_status_history(
          status,
          created_at
        )
      `);

    if (county) {
      dbQuery = dbQuery.eq('county', county);
    }

    const { data: offices, error } = await dbQuery;

    if (error) throw error;

    // Configure Fuse.js for fuzzy search
    const fuseOptions = {
      keys: [
        'office_location',
        'constituency_name',
        'county',
        'ward_name',
        'landmark',
        'formatted_address'
      ],
      threshold: 0.4,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2
    };

    const fuse = new Fuse(offices || [], fuseOptions);
    const results = fuse.search(query, { limit });

    // Enhance results with relevance scoring
    const enhancedResults = results.map(result => {
      const item = result.item;
      const score = result.score || 1;

      // Calculate relevance based on match type and score
      let relevance = 1 - score;

      // Boost exact matches
      if (item.office_location?.toLowerCase() === query.toLowerCase()) {
        relevance += 0.3;
      }
      if (item.constituency_name?.toLowerCase() === query.toLowerCase()) {
        relevance += 0.2;
      }

      // Boost verified offices
      if (item.verified) {
        relevance += 0.1;
      }

      return {
        ...item,
        relevanceScore: Math.min(relevance, 1),
        matches: result.matches
      };
    });

    // Sort by relevance
    enhancedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return new Response(JSON.stringify({
      success: true,
      data: enhancedResults,
      query,
      total: enhancedResults.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Search API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
