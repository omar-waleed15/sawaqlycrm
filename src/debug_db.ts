import { supabaseAdmin } from './lib/supabase';

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
    console.log('Auth Users:', authUsers.users.map((u: any) => ({ id: u.id, email: u.email })));
  }
}

test();
