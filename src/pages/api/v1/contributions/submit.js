import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      officeId,
      userId,
      contributionType,
      description,
      locationData,
      evidencePhotos,
      contactInfo
    } = body;

    if (!officeId || !userId || !contributionType || !description) {
      return new Response(JSON.stringify({
        success: false,
        error: 'officeId, userId, contributionType, and description are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check rate limits
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ipHash = createHash('sha256').update(clientIP).digest('hex');
    
    const { data: rateLimitCheck } = await supabase
      .from('contributions')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(5);

    if (rateLimitCheck && rateLimitCheck.length >= 5) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rate limit exceeded. Maximum 5 contributions per day.'
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create contribution
    const { data: contribution, error } = await supabase
      .from('contributions')
      .insert({
        office_id: officeId,
        user_id: userId,
        contribution_type: contributionType,
        description,
        location_data: locationData || null,
        evidence_photos: evidencePhotos || [],
        contact_info: contact_info || null,
        ip_hash: ipHash,
        status: 'pending',
        votes_count: 0,
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

    // Notify moderators (in production, this would send an email/push notification)
    console.log(`New contribution submitted: ${contribution.id} for office ${officeId}`);

    return new Response(JSON.stringify({
      success: true,
      data: contribution,
      message: 'Contribution submitted successfully. It will be reviewed by moderators.'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Contribution Submit API Error:', error);
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
    const officeId = url.searchParams.get('officeId');
    const userId = url.searchParams.get('userId');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit')) || 20;

    let query = supabase
      .from('contributions')
      .select(`
        *,
        iebc_offices(
          office_location,
          constituency_name,
          county
        ),
        contribution_votes(
          vote_type,
          created_at
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (officeId) {
      query = query.eq('office_id', officeId);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: contributions, error } = await query;

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      data: contributions
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get Contributions API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
