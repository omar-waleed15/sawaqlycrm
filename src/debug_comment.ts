import { supabaseAdmin } from './lib/supabase';

async function test() {
  console.log('Testing inserting a comment using supabaseAdmin...');
  console.log('URL:', process.env.SUPABASE_URL);
  console.log('Service Key Length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
  
  // Use a real taskId from the DB or a dummy one
  // Let's get a task first
  const { data: tasks, error: tasksError } = await supabaseAdmin.from('tasks').select('id').limit(1);
  if (tasksError || !tasks || tasks.length === 0) {
    console.error('Failed to get tasks or no tasks found:', tasksError);
    return;
  }
  
  const taskId = tasks[0].id;
  const adminId = '0f14f070-2dfd-41af-970d-fa28ba8aa49d'; // Sawaqly Admin ID
  
  console.log(`Inserting comment for task ${taskId} as admin ${adminId}...`);
  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      task_id: taskId,
      user_id: adminId,
      content: 'This is a debug comment from admin.'
    })
    .select('*');
    
  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Insert success:', data);
  }
}

test();
