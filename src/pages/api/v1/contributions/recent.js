import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 10;
    const officeId = url.searchParams.get('officeId');
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
        contribution_votes(
          vote_type,
          created_at
        ),
        nasaka_profiles(
          display_name,
          reputation_score
        )
      `)
      .in('status', ['approved', 'pending'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (officeId) {
      query = query.eq('office_id', officeId);
    }
    if (contributionType) {
      query = query.eq('contribution_type', contributionType);
    }

    const { data: contributions, error } = await query;

    if (error) throw error;

    // Enhance contributions with vote counts and user info
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
        contribution_votes: undefined, // Remove raw votes
        nasaka_profiles: undefined // Remove profile object
      };
    });

    return new Response(JSON.stringify({
      success: true,
      data: enhancedContributions,
      total: enhancedContributions.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Recent Contributions API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
