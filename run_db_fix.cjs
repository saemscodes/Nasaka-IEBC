const { Client } = require('pg');
const fs = require('fs');

async function runFix() {
  const connectionString = "postgresql://postgres.ftswzvqwxdwgkvfbwfpx:1268Saem'sTunes!@aws-0-eu-north-1.pooler.supabase.com:6543/postgres";
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log("Connected to Supabase.");
    
    const sql = fs.readFileSync('d:/CEKA/NASAKA/v005/supabase/migrations/20260412_permanent_coordinate_fix.sql', 'utf8');
    
    console.log("Executing migration...");
    const res = await client.query(sql);
    console.log("Migration executed successfully.");
    
    // Verification query
    const verifySql = `
      SELECT COUNT(*) AS still_swapped
      FROM iebc_offices
      WHERE latitude BETWEEN 33.9099 AND 41.9262
        AND longitude BETWEEN -4.8386 AND 4.9778;
    `;
    const verifyRes = await client.query(verifySql);
    console.log("Still swapped count:", verifyRes.rows[0].still_swapped);
    
  } catch (err) {
    console.error("Error executing fix:", err);
  } finally {
    await client.end();
  }
}

runFix();
