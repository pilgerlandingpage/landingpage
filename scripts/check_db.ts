import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function check() {
  console.log('--- Checking Recent Properties ---');
  const { data: props, error: propErr } = await supabase
    .from('properties')
    .select('id, title, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (propErr) console.error('Error fetching props:', propErr);
  else console.table(props);

  console.log('\n--- Checking Broker Prompts ---');
  const { data: brokers, error: brokerErr } = await supabase
    .from('virtual_brokers')
    .select('id, name, system_prompt')
    .eq('is_active', true);

  if (brokerErr) console.error('Error fetching brokers:', brokerErr);
  else {
    brokers.forEach(b => {
      console.log(`\nBroker: ${b.name}`);
      console.log(`Has Custom Prompt: ${!!b.system_prompt}`);
      if (b.system_prompt) {
        console.log(`Has {imoveis} tag: ${b.system_prompt.includes('{imoveis}')}`);
      }
    });
  }
}

check();
