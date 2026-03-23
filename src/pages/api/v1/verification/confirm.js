import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { officeId, userId, isAccurate, notes, evidencePhotos } = body;

    if (!officeId || !userId || isAccurate === undefined) {
      return new Response(JSON.stringify({
        success: false,
        error: 'officeId, userId, and isAccurate are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get client IP for deduplication
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ipHash = createHash('sha256').update(clientIP).digest('hex');

    // Check for existing confirmation from this user/IP
    const { data: existing } = await supabase
      .from('confirmations')
      .select('*')
      .eq('office_id', officeId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You have already confirmed this office'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create confirmation
    const { data: confirmation, error } = await supabase
      .from('confirmations')
      .insert({
        office_id: officeId,
        user_id: userId,
        is_accurate: isAccurate,
        notes: notes || null,
        evidence_photos: evidencePhotos || [],
        ip_hash: ipHash,
        confirmation_weight: 1.0, // Standard weight
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Update office verification count
    await supabase.rpc('update_verification_count', {
      office_id_param: officeId
    });

    // Get updated verification statistics
    const { data: stats } = await supabase
      .from('office_verification_stats')
      .select('*')
      .eq('office_id', officeId)
      .single();

    return new Response(JSON.stringify({
      success: true,
      data: confirmation,
      verificationStats: stats
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Confirmation API Error:', error);
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

    let query = supabase
      .from('confirmations')
      .select(`
        *,
        iebc_offices(
          office_location,
          constituency_name,
          county
        )
      `);

    if (officeId) {
      query = query.eq('office_id', officeId);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: confirmations, error } = await query;

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      data: confirmations
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get Confirmations API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
