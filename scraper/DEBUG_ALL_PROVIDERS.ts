import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const query = "BOKORIN PRIMARY SCHOOL, Baringo Central, Baringo, Kenya";

async function testProvider(name: string, url: string) {
    console.log(`Testing ${name}...`);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'NasakaIEBC/2.0' } });
        console.log(`  Status: ${res.status}`);
        const text = await res.text();
        console.log(`  Response: ${text.substring(0, 100)}...`);
    } catch (e: any) {
        console.error(`  Fetch Error for ${name}: ${e.message}`);
    }
}

async function debugAll() {
    const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
    const ARCGIS_KEY = process.env.ARCGIS_API_KEY_PRIMARY;
    const OPENCAGE_KEY = process.env.OPENCAGE_API_KEY;

    if (GOOGLE_KEY) await testProvider("Google", `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`);
    if (ARCGIS_KEY) await testProvider("ArcGIS", `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?address=${encodeURIComponent(query)}&f=json&token=${ARCGIS_KEY}&maxLocations=1`);
    if (OPENCAGE_KEY) await testProvider("OpenCage", `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_KEY}&limit=1`);
    
    await testProvider("Nominatim", `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
}

debugAll();
