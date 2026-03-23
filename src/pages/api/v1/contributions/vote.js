import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { contributionId, userId, voteType } = body;

    if (!contributionId || !userId || !voteType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'contributionId, userId, and voteType are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate vote type
    const validVoteTypes = ['upvote', 'downvote', 'helpful', 'not_helpful'];
    if (!validVoteTypes.includes(voteType)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid vote type. Must be one of: ' + validVoteTypes.join(', ')
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get client IP for deduplication
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const deviceHash = createHash('sha256').update(clientIP + userId).digest('hex');

    // Check for existing vote
    const { data: existingVote } = await supabase
      .from('contribution_votes')
      .select('*')
      .eq('contribution_id', contributionId)
      .eq('user_id', userId)
      .single();

    if (existingVote) {
      // Update existing vote
      const { data: updatedVote, error } = await supabase
        .from('contribution_votes')
        .update({
          vote_type: voteType,
          device_hash: deviceHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingVote.id)
        .select()
        .single();

      if (error) throw error;

      // Update contribution vote count
      await updateContributionVoteCount(contributionId);

      return new Response(JSON.stringify({
        success: true,
        data: updatedVote,
        message: 'Vote updated successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Create new vote
      const { data: newVote, error } = await supabase
        .from('contribution_votes')
        .insert({
          contribution_id: contributionId,
          user_id: userId,
          vote_type: voteType,
          device_hash: deviceHash,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Update contribution vote count
      await updateContributionVoteCount(contributionId);

      return new Response(JSON.stringify({
        success: true,
        data: newVote,
        message: 'Vote recorded successfully'
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Vote API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const contributionId = url.searchParams.get('contributionId');
    const userId = url.searchParams.get('userId');

    let query = supabase
      .from('contribution_votes')
      .select(`
        *,
        contributions(
          id,
          contribution_type,
          description
        )
      `);

    if (contributionId) {
      query = query.eq('contribution_id', contributionId);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: votes, error } = await query;

    if (error) throw error;

    // Calculate vote statistics
    const voteStats = votes.reduce((acc, vote) => {
      acc[vote.vote_type] = (acc[vote.vote_type] || 0) + 1;
      return acc;
    }, {});

    return new Response(JSON.stringify({
      success: true,
      data: votes,
      stats: voteStats
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get Votes API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const contributionId = url.searchParams.get('contributionId');
    const userId = url.searchParams.get('userId');

    if (!contributionId || !userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'contributionId and userId are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { error } = await supabase
      .from('contribution_votes')
      .delete()
      .eq('contribution_id', contributionId)
      .eq('user_id', userId);

    if (error) throw error;

    // Update contribution vote count
    await updateContributionVoteCount(contributionId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Vote removed successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Delete Vote API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function updateContributionVoteCount(contributionId) {
  // Calculate new vote count
  const { data: votes } = await supabase
    .from('contribution_votes')
    .select('vote_type')
    .eq('contribution_id', contributionId);

  const voteScore = votes?.reduce((acc, vote) => {
    if (vote.vote_type === 'upvote' || vote.vote_type === 'helpful') return acc + 1;
    if (vote.vote_type === 'downvote' || vote.vote_type === 'not_helpful') return acc - 1;
    return acc;
  }, 0) || 0;

  // Update contribution
  await supabase
    .from('contributions')
    .update({
      votes_count: voteScore,
      updated_at: new Date().toISOString()
    })
    .eq('id', contributionId);
}
