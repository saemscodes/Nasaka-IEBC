import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 20;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    const county = url.searchParams.get('county');
    const contributionType = url.searchParams.get('type');

    let query = supabase
      .from('contributions')
      .select(`
        *,
        iebc_offices(
          office_location,
          constituency_name,
          county,
          latitude,
          longitude
        ),
        nasaka_profiles(
          display_name,
          reputation_score,
          created_at
        ),
        contribution_votes(
          vote_type,
          created_at
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (county) {
      query = query.eq('county', county);
    }
    if (contributionType) {
      query = query.eq('contribution_type', contributionType);
    }

    const { data: contributions, error } = await query;

    if (error) throw error;

    // Get total count for pagination
    let countQuery = supabase
      .from('contributions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (county) {
      countQuery = countQuery.eq('county', county);
    }
    if (contributionType) {
      countQuery = countQuery.eq('contribution_type', contributionType);
    }

    const { count } = await countQuery;

    // Enhance contributions
    const enhancedContributions = contributions.map(contribution => {
      const votes = contribution.contribution_votes || [];
      const upvotes = votes.filter(v => v.vote_type === 'upvote' || v.vote_type === 'helpful').length;
      const downvotes = votes.filter(v => v.vote_type === 'downvote' || v.vote_type === 'not_helpful').length;
      
      return {
        ...contribution,
        voteScore: upvotes - downvotes,
        totalVotes: votes.length,
        contributorName: contribution.nasaka_profiles?.display_name || 'Anonymous',
        contributorReputation: contribution.nasaka_profiles?.reputation_score || 0,
        contributorSince: contribution.nasaka_profiles?.created_at,
        contribution_votes: undefined,
        nasaka_profiles: undefined
      };
    });

    return new Response(JSON.stringify({
      success: true,
      data: enhancedContributions,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Pending Contributions API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
