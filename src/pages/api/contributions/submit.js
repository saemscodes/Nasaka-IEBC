// src/pages/api/contributions/submit.js
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    const contribution = await req.json();

    // Validate required fields
    if (!contribution.submitted_latitude || !contribution.submitted_longitude || !contribution.submitted_office_location) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limits
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ipHash = await hashString(clientIP);
    
    const { data: rateLimitCheck } = await supabase
      .rpc('check_submission_rate_limit', {
        p_ip_hash: ipHash,
        p_device_hash: contribution.device_fingerprint_hash
      });

    if (!rateLimitCheck?.[0]?.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: rateLimitCheck?.[0]?.reason,
          retry_after: rateLimitCheck?.[0]?.retry_after_seconds
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert contribution
    const { data, error } = await supabase
      .from('iebc_office_contributions')
      .insert({
        ...contribution,
        device_metadata: {
          ...contribution.device_metadata,
          ip_hash: ipHash
        }
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function hashString(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
