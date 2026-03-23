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
      fieldName,
      newValue,
      oldValue,
      evidence,
      reason
    } = body;

    if (!officeId || !userId || !fieldName || !newValue) {
      return new Response(JSON.stringify({
        success: false,
        error: 'officeId, userId, fieldName, and newValue are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate field name
    const validFields = ['phone', 'email', 'operating_hours', 'address', 'landmark'];
    if (!validFields.includes(fieldName)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid field name. Must be one of: ' + validFields.join(', ')
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get client IP for deduplication
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ipHash = createHash('sha256').update(clientIP).digest('hex');

    // Check for existing suggestion for the same field
    const { data: existing } = await supabase
      .from('contact_update_requests')
      .select('*')
      .eq('office_id', officeId)
      .eq('field_name', fieldName)
      .eq('user_id', userId)
      .in('status', ['pending', 'under_review'])
      .single();

    if (existing) {
      return new Response(JSON.stringify({
        success: false,
        error: 'You already have a pending update request for this field'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get current value if not provided
    let currentOldValue = oldValue;
    if (!currentOldValue) {
      const { data: office } = await supabase
        .from('iebc_offices')
        .select(fieldName)
        .eq('id', officeId)
        .single();
      
      currentOldValue = office?.[fieldName] || null;
    }

    // Create contact update request
    const { data: updateRequest, error } = await supabase
      .from('contact_update_requests')
      .insert({
        office_id: officeId,
        user_id: userId,
        field_name: fieldName,
        new_value: newValue,
        old_value: currentOldValue,
        evidence: evidence || null,
        reason: reason || null,
        ip_hash: ipHash,
        status: 'pending',
        auto_approved: false,
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

    // Check for auto-approval conditions
    const autoApprove = await checkAutoApprovalConditions(fieldName, newValue, userId);
    
    if (autoApprove) {
      await supabase
        .from('contact_update_requests')
        .update({
          status: 'approved',
          auto_approved: true,
          approved_at: new Date().toISOString(),
          approved_by: 'system'
        })
        .eq('id', updateRequest.id);

      // Update the office field
      await supabase
        .from('iebc_offices')
        .update({
          [fieldName]: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', officeId);

      updateRequest.status = 'approved';
      updateRequest.auto_approved = true;
    }

    // Notify moderators if not auto-approved
    if (!autoApprove) {
      console.log(`New contact update request: ${updateRequest.id} for office ${officeId}`);
    }

    return new Response(JSON.stringify({
      success: true,
      data: updateRequest,
      message: autoApprove 
        ? 'Contact information updated successfully.'
        : 'Update request submitted successfully. It will be reviewed by moderators.'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Contact Update API Error:', error);
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
      .from('contact_update_requests')
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
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: requests, error } = await query;

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      data: requests
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get Contact Updates API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function checkAutoApprovalConditions(fieldName, newValue, userId) {
  // Auto-approve if user has high reputation
  const { data: userProfile } = await supabase
    .from('nasaka_profiles')
    .select('reputation_score')
    .eq('user_id', userId)
    .single();

  if (userProfile?.reputation_score >= 0.9) {
    return true;
  }

  // Auto-approve if it's a minor update (e.g., formatting)
  if (fieldName === 'operating_hours') {
    // Simple time format validation
    const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeFormat.test(newValue);
  }

  return false;
}
