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
      status,
      notes,
      evidencePhotos,
      reportedAt
    } = body;

    if (!officeId || !userId || !status) {
      return new Response(JSON.stringify({
        success: false,
        error: 'officeId, userId, and status are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate status
    const validStatuses = ['operational', 'closed', 'relocated', 'under_construction', 'temporarily_unavailable'];
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get client IP for deduplication
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ipHash = createHash('sha256').update(clientIP).digest('hex');

    // Check for recent status report from this user/IP for the same office
    const { data: recentReport } = await supabase
      .from('operational_status_history')
      .select('*')
      .eq('office_id', officeId)
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
      .single();

    if (recentReport) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You have already reported a status change for this office within the last hour'
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create status report
    const { data: statusReport, error } = await supabase
      .from('operational_status_history')
      .insert({
        office_id: officeId,
        user_id: userId,
        status,
        notes: notes || null,
        evidence_photos: evidencePhotos || [],
        ip_hash: ipHash,
        verified_by: 'pending', // Will be verified by moderators
        reported_at: reportedAt || new Date().toISOString(),
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

    // Update office current status if this is the first report or if verified
    const { data: officeStatus } = await supabase
      .from('iebc_offices')
      .select('operational_status')
      .eq('id', officeId)
      .single();

    if (!officeStatus || officeStatus.operational_status === 'unknown') {
      await supabase
        .from('iebc_offices')
        .update({
          operational_status: status,
          operational_status_updated_at: new Date().toISOString()
        })
        .eq('id', officeId);
    }

    // Notify moderators
    console.log(`New status report: ${statusReport.id} for office ${officeId}`);

    return new Response(JSON.stringify({
      success: true,
      data: statusReport,
      message: 'Status report submitted successfully. It will be reviewed by moderators.'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Status Report API Error:', error);
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
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit')) || 20;

    let query = supabase
      .from('operational_status_history')
      .select(`
        *,
        iebc_offices(
          office_location,
          constituency_name,
          county
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (officeId) {
      query = query.eq('office_id', officeId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: statusReports, error } = await query;

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      data: statusReports
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get Status Reports API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
