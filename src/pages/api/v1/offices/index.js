import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const county = url.searchParams.get('county');
    const constituency = url.searchParams.get('constituency');
    const status = url.searchParams.get('status');
    const verified = url.searchParams.get('verified');
    const limit = parseInt(url.searchParams.get('limit')) || 100;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    let query = supabase
      .from('iebc_offices')
      .select(`
        *,
        confirmations(count),
        operational_status_history(
          status,
          created_at,
          verified_by
        )
      `)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    // Apply filters
    if (county) {
      query = query.ilike('county', `%${county}%`);
    }
    if (constituency) {
      query = query.ilike('constituency_name', `%${constituency}%`);
    }
    if (status) {
      query = query.eq('operational_status', status);
    }
    if (verified !== null) {
      query = query.eq('verified', verified === 'true');
    }

    const { data: offices, error } = await query;

    if (error) throw error;

    // Get total count for pagination
    const { count } = await supabase
      .from('iebc_offices')
      .select('*', { count: 'exact', head: true });

    return new Response(JSON.stringify({
      success: true,
      data: offices,
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
    console.error('API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('iebc_offices')
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      data
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
