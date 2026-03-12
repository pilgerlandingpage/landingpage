import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const dotEnvStr = fs.readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
dotEnvStr.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        env[match[1].trim()] = val;
    }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.log('Missing env variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('configs').select('*');
    console.log('Configs:', JSON.stringify(data, null, 2));
}

run();
