const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Connecting to:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const backup = JSON.parse(fs.readFileSync('FULL_DATABASE_BACKUP_2026_09_29.json', 'utf8'));

async function insertTable(tableName, rows) {
  if (!rows || rows.length === 0) {
    console.log(`Skipping ${tableName}: 0 rows`);
    return;
  }
  console.log(`Inserting ${rows.length} rows into ${tableName}...`);
  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(tableName).upsert(chunk, { ignoreDuplicates: true });
    if (error) {
      console.error(`Error in ${tableName} (batch ${i}-${i + chunk.length}):`, error.message);
      // Try row by row for maximum resilience
      for (const row of chunk) {
        const { error: rowErr } = await supabase.from(tableName).upsert(row, { ignoreDuplicates: true });
        if (rowErr) {
          console.error(`  Failed row in ${tableName}:`, rowErr.message);
        }
      }
    }
  }
  const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
  console.log(`  -> ${tableName} current count: ${count}`);
}

async function main() {
  console.log('Starting full data insertion into new database...');

  // 1. Roles & Settings
  await insertTable('role_descriptions', backup.role_descriptions);
  await insertTable('system_settings', backup.system_settings);

  // 2. Clients
  await insertTable('clients', backup.clients);
  await insertTable('client_onboarding', backup.client_onboarding);
  await insertTable('client_content_plans', backup.client_content_plans);
  await insertTable('contracts', backup.contracts);
  await insertTable('contract_installments', backup.contract_installments);

  // 3. Tasks & Targets
  await insertTable('tasks', backup.tasks);
  await insertTable('task_assignees', backup.task_assignees);
  await insertTable('task_targets', backup.task_targets);
  await insertTable('attachments', backup.attachments);
  await insertTable('comments', backup.comments);

  // 4. Notes, Reminders & Content
  await insertTable('personal_notes', backup.personal_notes);
  await insertTable('reminders', backup.reminders);
  await insertTable('contents', backup.contents);
  await insertTable('content_ideas', backup.content_ideas);

  // 5. Sales & Finance
  await insertTable('sales_call_logs', backup.sales_call_logs);
  await insertTable('sales_targets', backup.sales_targets);
  await insertTable('salaries', backup.salaries);
  await insertTable('salary_advances', backup.salary_advances);
  await insertTable('salary_bonuses', backup.salary_bonuses);
  await insertTable('expenses', backup.expenses);

  console.log('\nAll tables populated successfully!');
}

main().catch(err => {
  console.error('Fatal error during population:', err);
  process.exit(1);
});
