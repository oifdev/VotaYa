const { createClient } = require('@supabase/supabase-js');

const url = 'https://oiudfbrsvcsocndevztd.supabase.co';
const key = 'sb_publishable_vyPxqmEUhwV4WsTs7i2e4w_RC7xMLH2';

const supabase = createClient(url, key);

async function run() {
  console.log('Querying candidatos table structure...');
  const { data, error } = await supabase.from('candidatos').select('*').limit(1);
  if (error) {
    console.error('Error fetching candidatos:', error);
  } else {
    console.log('Success! Sample row keys:', data.length > 0 ? Object.keys(data[0]) : 'No rows present in candidates table');
  }
}

run();
