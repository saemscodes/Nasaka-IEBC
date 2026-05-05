const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const URL = "https://ftswzvqwxdwgkvfbwfpx.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3d6dnF3eGR3Z2t2ZmJ3ZnB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1NDU1MSwiZXhwIjoyMDY3OTMwNTUxfQ.939Uqckn6DsQ7J3-Ts9WiqOXFfiGF9uqmJT7kpgNbvE";

const supabase = createClient(URL, KEY);

async function downloadRecursive(bucketName, folderPath = '') {
    const { data: items, error } = await supabase.storage.from(bucketName).list(folderPath, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
    });

    if (error) {
        console.error(`Error listing ${bucketName}/${folderPath}:`, error.message);
        return;
    }

    for (const item of (items || [])) {
        const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;
        
        if (item.id === null) { // It's a folder
            await downloadRecursive(bucketName, fullPath);
        } else { // It's a file
            console.log(`Downloading: ${bucketName}/${fullPath}`);
            const { data, error: downloadError } = await supabase.storage.from(bucketName).download(fullPath);
            
            if (downloadError) {
                console.error(`Error downloading ${fullPath}:`, downloadError.message);
                continue;
            }

            const localPath = path.join('./storage_backup', bucketName, fullPath);
            const localDir = path.dirname(localPath);
            
            if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
            
            const buffer = Buffer.from(await data.arrayBuffer());
            fs.writeFileSync(localPath, buffer);
        }
    }
}

async function downloadEverything() {
    console.log('🚀 Starting Wholesome Storage Export...');
    
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
        console.error('Error listing buckets:', error.message);
        return;
    }

    console.log(`Found ${buckets.length} buckets: ${buckets.map(b => b.name).join(', ')}`);

    for (const bucket of buckets) {
        console.log(`\n--- Processing Bucket: ${bucket.name} ---`);
        await downloadRecursive(bucket.name);
    }
    
    console.log('\n✅ ALL BUCKETS DOWNLOADED SUCCESSFULLY!');
}

downloadEverything();
