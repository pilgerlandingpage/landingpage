const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Ensure .env.local is loaded.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const newRadars = [
  { keyword: 'tendência mercado imobiliário', location: 'BR' },
  { keyword: 'taxa selic financiamento imobiliário', location: 'BR' },
  { keyword: 'investir em imóveis ou renda fixa', location: 'BR' },
  { keyword: 'INCC valorização imobiliária', location: 'BR' },
  { keyword: 'bolha imobiliária brasil', location: 'BR' },
  { keyword: 'imóveis de luxo como investimento', location: 'BR' },
  { keyword: 'comprar imóvel na planta vale a pena', location: 'BR' },
  { keyword: 'melhores cidades para investir em imóveis', location: 'BR' },
  { keyword: 'metro quadrado mais caro do brasil', location: 'BR' },
  { keyword: 'rentabilidade imóveis de alto padrão', location: 'BR' },
  { keyword: 'fundo imobiliário ou imóvel físico', location: 'BR' },
  { keyword: 'valorização imobiliária balneário camboriú', location: 'BR-SC' },
  { keyword: 'mercado imobiliário santa catarina', location: 'BR-SC' },
  { keyword: 'investir em itapema ou balneário camboriú', location: 'BR-SC' },
  { keyword: 'crescimento imobiliário litoral SC', location: 'BR-SC' }
];

async function insertRadars() {
  let successCount = 0;
  for (const radar of newRadars) {
    const { data, error } = await supabase
      .from('market_radars')
      .insert({
        keyword: radar.keyword,
        location: radar.location,
        is_active: true
      })
      .select();

    if (error) {
      console.error(`Error inserting ${radar.keyword}:`, error.message);
    } else {
      console.log(`Inserted: ${radar.keyword}`);
      successCount++;
    }
  }
  console.log(`\nFinished! Successfully inserted ${successCount} out of ${newRadars.length} radars.`);
}

insertRadars();
