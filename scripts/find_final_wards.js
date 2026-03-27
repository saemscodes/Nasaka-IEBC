const https = require('https');

const url = 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/kenya_wards_centroids.json';
const namesToFind = [
    'Kabuoch', 'Kaksingri', 'Eselenkei', 'Isongo', 'Mbirikani', 'Bobasi',
    'Ruiri', 'Kale', 'Woodley', 'Igambang', 'Landhies', 'Kinamba',
    'Muthwani', 'Ndithini', 'Kisau', 'Njukiini', 'Kapsuser', 'Kabsuser'
];

https.get(url, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            // Fix NaN in raw text before parsing
            const sanitized = rawData.replace(/"id"\s*:\s*NaN/g, '"id":null');
            const data = JSON.parse(sanitized);
            const results = data.filter(w =>
                namesToFind.some(name => w.name.toLowerCase().includes(name.toLowerCase()))
            );
            console.log(JSON.stringify(results, null, 2));
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });
}).on('error', (e) => {
    console.error('Error fetching JSON:', e.message);
});
