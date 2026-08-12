const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function resetShark3Time() {
  const assigneeId = '7e28fbc4-391c-4de3-bf0f-ae530cc36612';
  
  console.log(`Fetching task assignee record (${assigneeId})...`);
  const { data: before, error: fetchErr } = await supabaseAdmin
    .from('task_assignees')
    .select('id, user_id, task_id, total_time_spent, timer_started_at, tasks(title), profiles:user_id(name)')
    .eq('id', assigneeId)
    .single();

  if (fetchErr || !before) {
    console.error('Failed to fetch assignee record:', fetchErr);
    process.exit(1);
  }

  console.log('Record Before Update:');
  console.log(`- Task: "${before.tasks?.title}" (ID: ${before.task_id})`);
  console.log(`- User: "${before.profiles?.name}" (ID: ${before.user_id})`);
  console.log(`- total_time_spent: ${before.total_time_spent} seconds (~${(before.total_time_spent / 3600).toFixed(2)} hours)`);
  console.log(`- timer_started_at: ${before.timer_started_at}`);

  console.log('\nResetting total_time_spent to 0 and timer_started_at to null...');
  const { error: updateErr } = await supabaseAdmin
    .from('task_assignees')
    .update({
      total_time_spent: 0,
      timer_started_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', assigneeId);

  if (updateErr) {
    console.error('Error updating task assignee record:', updateErr);
    process.exit(1);
  }

  const { data: after, error: verifyErr } = await supabaseAdmin
    .from('task_assignees')
    .select('id, total_time_spent, timer_started_at, updated_at')
    .eq('id', assigneeId)
    .single();

  if (verifyErr || !after) {
    console.error('Failed to verify updated record:', verifyErr);
    process.exit(1);
  }

  console.log('\nRecord After Update:');
  console.log(`- total_time_spent: ${after.total_time_spent} seconds`);
  console.log(`- timer_started_at: ${after.timer_started_at}`);
  console.log(`- updated_at: ${after.updated_at}`);
  console.log('\nSuccessfully reset wasted time on task "Shark 3" for Manar Ramadan.');
}

resetShark3Time();
