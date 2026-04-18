import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function debug() {
    console.log("GOOGLE_KEY exists:", !!GOOGLE_KEY);
    if (!GOOGLE_KEY) return;
    
    const query = "BOKORIN PRIMARY SCHOOL, Baringo Central, Baringo, Kenya";
    console.log("Testing Query:", query);
    
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_KEY}&region=ke`;
        const res = await fetch(url);
        console.log("Status:", res.status);
        const data = await res.json() as any;
        console.log("Data Status:", data.status);
        if (data.results && data.results.length > 0) {
            console.log("Result 0:", data.results[0].formatted_address);
        } else {
            console.log("Zero results or error message:", data.error_message);
        }
    } catch (e: any) {
        console.error("Fetch Error:", e.message);
    }
}

debug();
