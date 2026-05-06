import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '.env');

console.log('Checking envPath:', envPath);
console.log('Exists:', existsSync(envPath));

if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            let key = match[1];
            let value = match[2] || '';
            console.log(`Key: ${key}, Value length: ${value.length}`);
            if (key === 'SUPABASE_URL') console.log(`Value: ${value}`);
        }
    });
}
