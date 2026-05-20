const { createClient } = require('@supabase/supabase-js');

const url = 'https://oiudfbrsvcsocndevztd.supabase.co';
const key = 'sb_publishable_vyPxqmEUhwV4WsTs7i2e4w_RC7xMLH2';

const supabase = createClient(url, key);

async function run() {
  console.log('Testing insert without cargo_id...');
  const { data, error } = await supabase.from('candidatos').insert({
    eleccion_id: '00000000-0000-0000-0000-000000000000',
    nombre_completo: 'Test Candidate Name',
    identidad: '0000-0000-00000',
    biografia: 'Test bio',
    estado: 'activo'
  }).select();
  
  if (error) {
    console.error('Error inserting candidate:', error);
  } else {
    console.log('Success inserting candidate! Data:', data);
  }
}

run();
