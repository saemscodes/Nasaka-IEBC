import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_SERVICE_URL,
  process.env.VITE_SUPABASE_SERVICE_KEY
);

export async function PUT(request) {
  try {
    const body = await request.json();
    const { officeId, adminId, updates, reason } = body;

    if (!officeId || !adminId || !updates) {
      return new Response(JSON.stringify({
        success: false,
        error: 'officeId, adminId, and updates are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify admin permissions
    const { data: adminProfile } = await supabase
      .from('nasaka_profiles')
      .select('role')
      .eq('user_id', adminId)
      .single();

    if (!adminProfile || !['admin', 'moderator'].includes(adminProfile.role)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Insufficient permissions'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get current office data
    const { data: currentOffice, error: fetchError } = await supabase
      .from('iebc_offices')
      .select('*')
      .eq('id', officeId)
      .single();

    if (fetchError) throw fetchError;

    // Create audit log entry
    const auditLog = {
      office_id: officeId,
      admin_id: adminId,
      action: 'update',
      old_values: {},
      new_values: updates,
      reason: reason || 'Administrative update',
      created_at: new Date().toISOString()
    };

    // Track changes for audit
    Object.keys(updates).forEach(key => {
      if (currentOffice[key] !== updates[key]) {
        auditLog.old_values[key] = currentOffice[key];
        auditLog.new_values[key] = updates[key];
      }
    });

    // Update office
    const { data: updatedOffice, error: updateError } = await supabase
      .from('iebc_offices')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        last_modified_by: adminId
      })
      .eq('id', officeId)
      .select(`
        *,
        confirmations(count),
        operational_status_history(
          status,
          created_at
        )
      `)
      .single();

    if (updateError) throw updateError;

    // Create audit log entry
    if (Object.keys(auditLog.old_values).length > 0) {
      await supabase
        .from('office_audit_logs')
        .insert(auditLog);
    }

    return new Response(JSON.stringify({
      success: true,
      data: updatedOffice,
      changes: auditLog,
      message: 'Office updated successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Update Office API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
