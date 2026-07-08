const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  console.log('Querying clients with sales_rep profiles join...');
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('*, sales_rep:profiles!clients_sales_rep_id_fkey(id, name)');

  if (error) {
    console.error('Error fetching clients:', error);
  } else {
    console.log('Clients count:', data.length);
    console.log('Clients sample:', data.slice(0, 2));
  }
}

test();
