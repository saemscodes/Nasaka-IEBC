import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const url = 'https://bfatlkobozblunojtltp.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmYXRsa29ib3pibHVub2p0bHRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODAxMjE0MywiZXhwIjoyMDkzNTg4MTQzfQ.QJDDGuBytvSSpxBuLGMan2G9s9dEQiiMOqfFsxJztmE';

const supabase = createClient(url, key);

async function test() {
    console.log('Testing connectivity...');
    const { data, error } = await supabase.from('iebc_offices').select('count', { count: 'exact', head: true });
    if (error) {
        console.error('Connection failed:', error.message);
    } else {
        console.log('Connection successful! Row count:', data);
    }
}

test();
