const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  console.log('Querying all profiles from Supabase...');
  const { data, error } = await supabaseAdmin.from('profiles').select('*');
  if (error) {
    console.error('Error querying profiles:', error);
  } else {
    console.log('Profiles in DB:', data);
  }

  console.log('Querying all users from Supabase Auth...');
  const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
  if (authError) {
    console.error('Error querying auth users:', authError);
  } else {
    console.log('Auth Users:', authUsers.users.map(u => ({ id: u.id, email: u.email })));
  }
}

test();
