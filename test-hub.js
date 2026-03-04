require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
async function test() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await supabase.from('app_config').select('key, value').in('key', ['connectyhub_api_url', 'connectyhub_api_key', 'connectyhub_instance']);
    const config = {};
    data?.forEach(row => config[row.key] = row.value);
    console.log('Config:', config);
    const apiUrl = config.connectyhub_api_url || process.env.CONNECTYHUB_API_URL;
    const apiKey = config.connectyhub_api_key || process.env.CONNECTYHUB_API_KEY;
    const instance = config.connectyhub_instance || process.env.CONNECTYHUB_INSTANCE;
    console.log('Using:', { apiUrl, apiKey, instance });
    try {
        const res = await fetch(`${apiUrl}/instance/connectionState/${instance}`, { headers: { apikey: apiKey } });
        console.log('Status ConnectyHub instance/connectionState:', res.status);
        console.log('Body:', await res.text());
    } catch (e) { console.error('Error fetching API API:', e); }
}
test();
