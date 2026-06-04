const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  const targetId = '0f14f070-2dfd-41af-970d-fa28ba8aa49d';
  console.log('Querying profile by ID:', targetId);
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', targetId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
  } else {
    console.log('Profile found:', data);
  }
}

test();
