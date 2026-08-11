-- ===========================================================

-- SAWAQLY MIGRATION FULL SCHEMA

-- Run this script in your new Supabase SQL Editor

-- ===========================================================



-- Create storage buckets if not exists

INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', true) ON CONFLICT (id) DO NOTHING;



CREATE TABLE IF NOT EXISTS public.profiles (id uuid PRIMARY KEY, created_at timestamptz DEFAULT now(), name text NOT NULL, email text NOT NULL, role text NOT NULL DEFAULT 'member'::text, avatar_url text, phone text);

CREATE TABLE IF NOT EXISTS public.attachments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now(), mimetype text, public_url text, storage_path text NOT NULL, filename text NOT NULL, task_id uuid, size int4);

CREATE TABLE IF NOT EXISTS public.campaigns (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), updated_at timestamptz DEFAULT now(), csv_file_url text, name text NOT NULL, status text NOT NULL DEFAULT 'pending'::text, recipient_count int4 NOT NULL DEFAULT 0, wapilot_campaign_id int4 NOT NULL, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.client_content_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), updated_at timestamptz DEFAULT now(), title text NOT NULL, description text, content_type text, notes text, drive_link text, status text DEFAULT 'draft'::text, client_id uuid, scheduled_date date, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.client_faq (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now(), sort_order int4 DEFAULT 0, client_id uuid, answer text NOT NULL, question text NOT NULL, updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.client_ideas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attachment_url text, attachment_name text, updated_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now(), client_id uuid, title text NOT NULL, description text, color text DEFAULT '#6366f1'::text, status text DEFAULT 'idea'::text, drive_link text);

CREATE TABLE IF NOT EXISTS public.client_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content text NOT NULL, created_at timestamptz DEFAULT now(), client_id uuid NOT NULL, sender_id uuid NOT NULL);

CREATE TABLE IF NOT EXISTS public.client_onboarding (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), current_step int4 DEFAULT 1, client_id uuid NOT NULL, completed_steps _int4 DEFAULT '{}'::integer[], client_overview jsonb DEFAULT '{}'::jsonb, brand_assets jsonb DEFAULT '{}'::jsonb, business_discovery jsonb DEFAULT '{}'::jsonb, target_audience jsonb DEFAULT '{}'::jsonb, competitor_analysis jsonb DEFAULT '{}'::jsonb, social_media_audit jsonb DEFAULT '{}'::jsonb, content_strategy jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.client_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), messages int4 DEFAULT 0, num_posts int4 DEFAULT 0, num_reels int4 DEFAULT 0, num_stories int4 DEFAULT 0, num_photos int4 DEFAULT 0, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), notes text, client_id uuid, report_month date NOT NULL, views int4 DEFAULT 0, interactions int4 DEFAULT 0);

CREATE TABLE IF NOT EXISTS public.client_social_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), avatar_url text, access_token text, account_name text, account_id text NOT NULL, platform text NOT NULL, updated_at timestamptz DEFAULT now(), connected_at timestamptz DEFAULT now(), expires_at timestamptz, client_id uuid NOT NULL, profile_url text, meta_page_id text);

CREATE TABLE IF NOT EXISTS public.client_social_analytics_daily (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reach int4 DEFAULT 0, client_id uuid NOT NULL, record_date date NOT NULL, impressions int4 DEFAULT 0, likes int4 DEFAULT 0, comments_count int4 DEFAULT 0, shares int4 DEFAULT 0, followers_count int4 DEFAULT 0, created_at timestamptz DEFAULT now(), platform text NOT NULL, account_id text NOT NULL);

CREATE TABLE IF NOT EXISTS public.client_social_posts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id text NOT NULL, platform text NOT NULL, views_count int4 DEFAULT 0, media_url text, posted_at timestamptz DEFAULT now(), permalink text, account_id text NOT NULL, created_at timestamptz DEFAULT now(), client_id uuid NOT NULL, like_count int4 DEFAULT 0, comments_count int4 DEFAULT 0, caption text);

CREATE TABLE IF NOT EXISTS public.clients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), other_deliverables text, meeting_notes text, name text NOT NULL, content_plan_link text, meeting_attendees _uuid DEFAULT '{}'::uuid[], user_id uuid, deliverables_schedule jsonb DEFAULT '{"posts": [], "reels": [], "photos": [], "stories": []}'::jsonb, done_other bool DEFAULT false, done_photos int4 DEFAULT 0, done_stories int4 DEFAULT 0, done_reels int4 DEFAULT 0, done_posts int4 DEFAULT 0, num_stories int4 DEFAULT 0, num_photos int4 DEFAULT 0, address text, num_reels int4 DEFAULT 0, num_posts int4 DEFAULT 0, start_date date, meeting_date timestamptz, sales_rep_id uuid, created_at timestamptz DEFAULT now(), pipeline_stage text NOT NULL DEFAULT 'new_lead'::text, status text NOT NULL DEFAULT 'active'::text, phone text, email text, company text);

CREATE TABLE IF NOT EXISTS public.comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid, user_id uuid, created_at timestamptz DEFAULT now(), content text NOT NULL);

CREATE TABLE IF NOT EXISTS public.content_ideas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_description text, drive_link text, rating text NOT NULL DEFAULT 'medium'::text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), title text NOT NULL, description text, content_type text, creator_id uuid NOT NULL);

CREATE TABLE IF NOT EXISTS public.contents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid, sound text, content_type text NOT NULL, caption text, title text, scheduled_date timestamptz, updated_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now(), media_urls jsonb DEFAULT '[]'::jsonb, platform text, drive_link text, description text);

CREATE TABLE IF NOT EXISTS public.contract_installments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id uuid NOT NULL, amount numeric NOT NULL, note text, due_date date NOT NULL, paid bool NOT NULL DEFAULT false, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.contracts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now(), sales_rep_id uuid, is_recurring bool NOT NULL DEFAULT true, renewal_date date, start_date date, amount numeric NOT NULL, client_id uuid, name text NOT NULL, billing_cycle text NOT NULL DEFAULT 'monthly'::text, status text NOT NULL DEFAULT 'active'::text);

CREATE TABLE IF NOT EXISTS public.expenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, created_at timestamptz DEFAULT now(), recurrence text, amount numeric NOT NULL, created_by uuid, note text, category text NOT NULL, date date NOT NULL, is_recurring bool NOT NULL DEFAULT false);

CREATE TABLE IF NOT EXISTS public.global_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content text NOT NULL, user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.personal_notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, content text DEFAULT ''::text, type text NOT NULL DEFAULT 'text'::text, user_id uuid NOT NULL, updated_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now(), todo_items jsonb DEFAULT '[]'::jsonb);

CREATE TABLE IF NOT EXISTS public.reminders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now(), content text NOT NULL, review_link text, receiver_id uuid NOT NULL, read_at timestamptz, sender_id uuid NOT NULL, completed_at timestamptz, attachments jsonb DEFAULT '[]'::jsonb);

CREATE TABLE IF NOT EXISTS public.role_descriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), updated_at timestamptz DEFAULT now(), updated_by uuid, non_negotiables text DEFAULT ''::text, role_key text NOT NULL, description text NOT NULL DEFAULT ''::text, job_roles text DEFAULT ''::text, general_roles text DEFAULT ''::text, job_description text DEFAULT ''::text);

CREATE TABLE IF NOT EXISTS public.salaries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now(), user_id uuid NOT NULL, paid_date date, created_by uuid, amount numeric NOT NULL, month date NOT NULL, paid bool NOT NULL DEFAULT false, note text, recurrence text DEFAULT 'monthly'::text, is_recurring bool NOT NULL DEFAULT true);

CREATE TABLE IF NOT EXISTS public.salary_advances (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), salary_id uuid NOT NULL, notes text, created_at timestamptz DEFAULT now(), date date DEFAULT CURRENT_DATE, amount numeric NOT NULL);

CREATE TABLE IF NOT EXISTS public.salary_bonuses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), amount numeric NOT NULL, salary_id uuid, notes text, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.salary_installments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), due_date date, created_at timestamptz DEFAULT now(), paid bool NOT NULL DEFAULT false, salary_id uuid NOT NULL, amount numeric NOT NULL, note text);

CREATE TABLE IF NOT EXISTS public.salary_penalties (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now(), notes text, amount numeric NOT NULL, salary_id uuid NOT NULL);

CREATE TABLE IF NOT EXISTS public.sales_call_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), notes text, outcome text NOT NULL DEFAULT 'contacted'::text, call_date timestamptz DEFAULT now(), sales_rep_id uuid NOT NULL, client_id uuid NOT NULL);

CREATE TABLE IF NOT EXISTS public.sales_targets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), target_amount numeric NOT NULL DEFAULT 0, user_id uuid NOT NULL, created_at timestamptz DEFAULT now(), month varchar(7) NOT NULL);

CREATE TABLE IF NOT EXISTS public.system_settings (key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.task_assignees (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submitted_at timestamptz, timer_started_at timestamptz, total_time_spent int4 NOT NULL DEFAULT 0, rating int4, updated_at timestamptz DEFAULT now(), assigned_at timestamptz DEFAULT now(), user_id uuid NOT NULL, task_id uuid NOT NULL, status text NOT NULL DEFAULT 'todo'::text, submission_link text, completion_note text, feedback text);

CREATE TABLE IF NOT EXISTS public.task_targets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), target_tasks int4 NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now(), month varchar(7) NOT NULL, user_id uuid NOT NULL);

CREATE TABLE IF NOT EXISTS public.tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assignee_id uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), title text NOT NULL, description text, priority text NOT NULL DEFAULT 'medium'::text, status text NOT NULL DEFAULT 'todo'::text, submission_link text, publish_date date, client_id uuid, is_archived bool NOT NULL DEFAULT false, feedback text, progress_note text, drive_link text, content_type text, content_description text, completion_note text, is_deliverable bool DEFAULT false, publish_notes text, estimated_time_minutes int4, deliverable_month date, deliverable_type text, due_date timestamptz, creator_id uuid);



-- Disable RLS for smooth data transfer

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.attachments DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.campaigns DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_content_plans DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_faq DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_ideas DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_messages DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_onboarding DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_reports DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_social_accounts DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_social_analytics_daily DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_social_posts DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.comments DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_ideas DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.contents DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.contract_installments DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.contracts DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.global_messages DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.personal_notes DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.reminders DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.role_descriptions DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.salaries DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.salary_advances DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.salary_bonuses DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.salary_installments DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.salary_penalties DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.sales_call_logs DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.sales_targets DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.task_assignees DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.task_targets DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;