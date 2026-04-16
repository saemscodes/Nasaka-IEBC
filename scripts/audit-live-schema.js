import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual ENV Parsing
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BACKUP_PATH = path.join(process.cwd(), 'backup.sql');

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function audit() {
    console.log('🔍 Starting Live Schema Audit (Dependency-Free)...');
    console.log(`📡 Target: ${SUPABASE_URL}`);

    // 1. Get Expected Schema from backup.sql
    console.log('📖 Reading backup.sql...');
    const backupContent = fs.readFileSync(BACKUP_PATH, 'utf8');
    const expectedTables = new Map();
    
    // Improved regex to find table and column names
    const tableRegex = /CREATE TABLE public\.(\w+) \(([\s\S]+?)\);/g;
    let match;
    while ((match = tableRegex.exec(backupContent)) !== null) {
        const tableName = match[1];
        const columnsText = match[2];
        const columns = columnsText.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('--') && !line.startsWith('CONSTRAINT') && !line.startsWith(');'))
            .map(line => line.split(/[ \t]/)[0].replace(/"/g, ''))
            .filter(name => name && name !== ')' && name !== 'PRIMARY' && name !== 'FOREIGN' && name !== 'CHECK');
        expectedTables.set(tableName, columns);
    }

    console.log(`📦 Found ${expectedTables.size} expected tables in backup.sql`);

    // 2. Audit Tables
    const disparities = [];

    for (const [tableName, expectedCols] of expectedTables) {
        // Skip some system tables or noise
        if (tableName.startsWith('pg_')) continue;

        process.stdout.write(`🕵️  Auditing ${tableName}... `);
        
        try {
            const { error: tableError, data: sampleData } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);

            if (tableError) {
                if (tableError.message.includes('does not exist') || tableError.code === '42P01') {
                    disparities.push({ type: 'TABLE_MISSING', table: tableName });
                    console.log('❌ MISSING TABLE');
                } else {
                    console.log(`⚠️ ERROR: ${tableError.message}`);
                }
                continue;
            }

            // Check columns
            const actualCols = Object.keys(sampleData[0] || {});
            
            // If table exists but is empty, Object.keys is []
            // We need another way to check columns if empty. 
            // We'll try a selection that we know SHOULD exist based on backup.
            
            const missingCols = [];
            for (const col of expectedCols) {
                const { error: colError } = await supabase
                    .from(tableName)
                    .select(col)
                    .limit(0);
                
                if (colError && (colError.message.includes('column') && colError.message.includes('does not exist'))) {
                    missingCols.push(col);
                }
            }
            
            if (missingCols.length > 0) {
                disparities.push({ type: 'COLUMNS_MISSING', table: tableName, columns: missingCols });
                console.log(`❌ ${missingCols.length} COLUMNS MISSING`);
            } else {
                console.log('✅ OK');
            }
        } catch (e) {
            console.log(`⚠️ CRASH: ${e.message}`);
        }
    }

    // 3. Report
    console.log('\n--- 📊 FINAL AUDIT REPORT ---');
    if (disparities.length === 0) {
        console.log('🎉 No disparities found! Live DB matches backup.sql.');
    } else {
        disparities.forEach(d => {
            if (d.type === 'TABLE_MISSING') {
                console.log(`[TABLE MISSING]  ->  ${d.table}`);
            } else {
                console.log(`[COL MISSING]    ->  ${d.table}: ${d.columns.join(', ')}`);
            }
        });
        
        console.log('\n💡 These disparities are causing build and runtime errors.');
        console.log('💡 I have made the build scripts resilient, but you should apply migrations soon.');
    }
}

audit();
