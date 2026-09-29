const fs = require('fs');
const path = require('path');

const brainDir = 'C:/Users/Khalifa/.gemini/antigravity-ide/brain/01cd260c-e93d-408a-90cf-4c3338058ef6/.system_generated/steps';

function parseStepOutput(stepNumber) {
  const filePath = path.join(brainDir, String(stepNumber), 'output.txt');
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(content);
  const match = (parsed.result || content).match(/<untrusted-data-[^>]+>\r?\n([\s\S]*?)\r?\n<\/untrusted-data-[^>]+>/);
  if (!match) {
    throw new Error(`No untrusted data found in step ${stepNumber}`);
  }
  return JSON.parse(match[1]);
}

// Helper to escape SQL values
function sqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    // Array in postgres
    const escapedElements = val.map(item => {
      if (item === null) return 'NULL';
      return '"' + String(item).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    });
    return `'{${escapedElements.join(',')}}'`;
  }
  if (typeof val === 'object') {
    // JSON object
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  // String
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generateInserts(tableName, rows, schema = 'public', conflictClause = 'ON CONFLICT DO NOTHING') {
  if (!rows || rows.length === 0) return `-- No rows for ${schema}.${tableName}\n`;
  
  const sample = rows[0];
  const columns = Object.keys(sample);
  
  let sql = `-- ===========================================================\n`;
  sql += `-- Table: ${schema}."${tableName}" (${rows.length} rows)\n`;
  sql += `-- ===========================================================\n`;

  // Disable triggers if needed
  for (const row of rows) {
    const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
    const vals = Object.values(row).map(sqlVal).join(', ');
    sql += `INSERT INTO ${schema}."${tableName}" (${cols}) VALUES (${vals}) ${conflictClause};\n`;
  }
  sql += '\n';
  return sql;
}

async function run() {
  console.log('Extracting data from step outputs...');

  const profilesData = parseStepOutput(76)[0].json_agg;
  console.log(`Profiles: ${profilesData.length} rows`);

  const authUsersData = parseStepOutput(84)[0].json_agg;
  console.log(`Auth Users: ${authUsersData.length} rows`);

  const authIdentitiesData = parseStepOutput(86)[0].json_agg;
  console.log(`Auth Identities: ${authIdentitiesData.length} rows`);

  const group1Data = parseStepOutput(88)[0].json_build_object;
  for (const [tbl, rows] of Object.entries(group1Data)) {
    console.log(`${tbl}: ${rows.length} rows`);
  }

  const clientsData = parseStepOutput(90)[0].json_agg;
  console.log(`Clients: ${clientsData.length} rows`);

  const attachmentsData = parseStepOutput(92)[0].json_agg;
  console.log(`Attachments: ${attachmentsData.length} rows`);

  const taskAssigneesData = parseStepOutput(94)[0].json_agg;
  console.log(`Task Assignees: ${taskAssigneesData.length} rows`);

  const tasksData = parseStepOutput(96)[0].json_agg;
  console.log(`Tasks: ${tasksData.length} rows`);

  // Assemble full JSON backup
  const fullJson = {
    metadata: {
      exported_at: new Date().toISOString(),
      source_project: 'pbijeyaujtguhltqdwbe',
      total_tables: 22
    },
    auth_users: authUsersData,
    auth_identities: authIdentitiesData,
    profiles: profilesData,
    clients: clientsData,
    tasks: tasksData,
    task_assignees: taskAssigneesData,
    attachments: attachmentsData,
    ...group1Data
  };

  fs.writeFileSync('FULL_DATABASE_BACKUP_2026_09_29.json', JSON.stringify(fullJson, null, 2), 'utf8');
  console.log('Saved FULL_DATABASE_BACKUP_2026_09_29.json');

  // Load existing schema DDL
  const schemaSql = fs.readFileSync('FULL_NEW_SCHEMA.sql', 'utf8');

  // Build master SQL
  let masterSql = `-- ========================================================================\n`;
  masterSql += `-- SAWAQLY CRM COMPLETE DATABASE BACKUP & RESTORE SCRIPT\n`;
  masterSql += `-- Generated: ${new Date().toISOString()}\n`;
  masterSql += `-- Source Project: pbijeyaujtguhltqdwbe\n`;
  masterSql += `-- Total Auth Users: ${authUsersData.length}\n`;
  masterSql += `-- Total Clients: ${clientsData.length} | Tasks: ${tasksData.length} | Assignees: ${taskAssigneesData.length}\n`;
  masterSql += `-- ========================================================================\n\n`;

  masterSql += `-- STEP 1: SCHEMA & EXTENSIONS & BUCKETS\n`;
  masterSql += schemaSql + '\n\n';

  masterSql += `-- STEP 2: AUTH USERS & IDENTITIES\n`;
  masterSql += `-- ===========================================================\n`;
  for (const u of authUsersData) {
    const rawAppMeta = sqlVal(u.raw_app_meta_data);
    const rawUserMeta = sqlVal(u.raw_user_meta_data);
    masterSql += `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, is_super_admin, phone, phone_confirmed_at, confirmed_at, aud) VALUES ('${u.id}', '${u.email}', '${u.encrypted_password}', ${sqlVal(u.email_confirmed_at)}, ${rawAppMeta}, ${rawUserMeta}, ${sqlVal(u.created_at)}, ${sqlVal(u.updated_at)}, '${u.role || 'authenticated'}', ${u.is_super_admin ? 'TRUE' : 'FALSE'}, ${sqlVal(u.phone)}, ${sqlVal(u.phone_confirmed_at)}, ${sqlVal(u.confirmed_at)}, 'authenticated') ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;\n`;
  }
  masterSql += '\n';

  for (const ident of authIdentitiesData) {
    masterSql += `INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id) VALUES ('${ident.id}', '${ident.user_id}', ${sqlVal(ident.identity_data)}, '${ident.provider}', ${sqlVal(ident.last_sign_in_at)}, ${sqlVal(ident.created_at)}, ${sqlVal(ident.updated_at)}, '${ident.provider_id}') ON CONFLICT (id) DO NOTHING;\n`;
  }
  masterSql += '\n';

  masterSql += `-- STEP 3: DATA INSERTION (IN PROPER DEPENDENCY ORDER)\n`;
  // 1. profiles (depends on auth.users)
  masterSql += generateInserts('profiles', profilesData);
  // 2. role_descriptions
  masterSql += generateInserts('role_descriptions', group1Data.role_descriptions);
  // 3. system_settings
  masterSql += generateInserts('system_settings', group1Data.system_settings);
  // 4. clients
  masterSql += generateInserts('clients', clientsData);
  // 5. client_onboarding
  masterSql += generateInserts('client_onboarding', group1Data.client_onboarding);
  // 6. client_content_plans
  masterSql += generateInserts('client_content_plans', group1Data.client_content_plans);
  // 7. contracts
  masterSql += generateInserts('contracts', group1Data.contracts);
  // 8. contract_installments
  masterSql += generateInserts('contract_installments', group1Data.contract_installments);
  // 9. tasks
  masterSql += generateInserts('tasks', tasksData);
  // 10. task_assignees
  masterSql += generateInserts('task_assignees', taskAssigneesData);
  // 11. task_targets
  masterSql += generateInserts('task_targets', group1Data.task_targets);
  // 12. attachments
  masterSql += generateInserts('attachments', attachmentsData);
  // 13. comments
  masterSql += generateInserts('comments', group1Data.comments);
  // 14. personal_notes
  masterSql += generateInserts('personal_notes', group1Data.personal_notes);
  // 15. reminders
  masterSql += generateInserts('reminders', group1Data.reminders);
  // 16. contents
  masterSql += generateInserts('contents', group1Data.contents);
  // 17. content_ideas
  masterSql += generateInserts('content_ideas', group1Data.content_ideas);
  // 18. sales_call_logs
  masterSql += generateInserts('sales_call_logs', group1Data.sales_call_logs);
  // 19. sales_targets
  masterSql += generateInserts('sales_targets', group1Data.sales_targets);
  // 20. salaries
  masterSql += generateInserts('salaries', group1Data.salaries);
  // 21. salary_advances
  masterSql += generateInserts('salary_advances', group1Data.salary_advances);
  // 22. salary_bonuses
  masterSql += generateInserts('salary_bonuses', group1Data.salary_bonuses);
  // 23. expenses
  masterSql += generateInserts('expenses', group1Data.expenses);

  // Remaining empty tables just in case
  masterSql += generateInserts('campaigns', group1Data.campaigns);
  masterSql += generateInserts('client_messages', group1Data.client_messages);
  masterSql += generateInserts('client_ideas', group1Data.client_ideas);
  masterSql += generateInserts('client_faq', group1Data.client_faq);
  masterSql += generateInserts('client_daily_logs', group1Data.client_daily_logs);
  masterSql += generateInserts('client_reports', group1Data.client_reports);
  masterSql += generateInserts('client_social_accounts', group1Data.client_social_accounts);
  masterSql += generateInserts('client_social_analytics_daily', group1Data.client_social_analytics_daily);
  masterSql += generateInserts('client_social_posts', group1Data.client_social_posts);
  masterSql += generateInserts('global_messages', group1Data.global_messages);

  // STEP 4: FOREIGN KEYS
  const fkSql = fs.readFileSync('ADD_FOREIGN_KEYS.sql', 'utf8');
  masterSql += `\n-- STEP 4: FOREIGN KEYS\n-- ===========================================================\n`;
  masterSql += fkSql + '\n';

  fs.writeFileSync('FULL_DATABASE_BACKUP_2026_09_29.sql', masterSql, 'utf8');
  console.log('Saved FULL_DATABASE_BACKUP_2026_09_29.sql successfully!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
