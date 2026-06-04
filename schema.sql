-- =========================================================================
-- SAWAQLY CRM DATABASE SCHEMA
-- Copy and paste this into the Supabase SQL Editor (https://supabase.com)
-- =========================================================================

-- Drop tables if they exist (for a fresh start if needed)
-- drop table if exists public.attachments cascade;
-- drop table if exists public.comments cascade;
-- drop table if exists public.tasks cascade;
-- drop table if exists public.profiles cascade;

-- 1. PROFILES (Extends Supabase Auth users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'member', -- 'owner' | 'member'
  avatar_url text,
  created_at timestamptz default now()
);

-- 2. TASKS
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  priority text not null default 'medium', -- 'low' | 'medium' | 'high' | 'urgent'
  status text not null default 'todo',     -- 'todo' | 'in_progress' | 'submitted' | 'revision' | 'completed'
  due_date date,
  submission_link text,                    -- submission URL by team member
  feedback text,                           -- admin feedback notes for revision
  progress_note text,                      -- status/progress updates from member

  creator_id uuid references public.profiles(id),
  assignee_id uuid references public.profiles(id),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. COMMENTS
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- 4. ATTACHMENTS
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  filename text not null,
  storage_path text not null,              -- Supabase Storage bucket path
  public_url text,                         -- Public URL to download
  mimetype text,
  size int,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Helper function: checks if the current user is an owner
-- Uses SECURITY DEFINER so it runs as DB owner, breaking the recursion loop.
create or replace function public.is_owner()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- Profiles Policies (uses is_owner() to avoid infinite recursion)
create policy "Anyone authenticated can read profiles"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "Owners can insert profiles"
  on public.profiles for insert
  with check (public.is_owner());

create policy "Owners can update any profile"
  on public.profiles for update
  using (public.is_owner());

create policy "Owners can delete profiles"
  on public.profiles for delete
  using (public.is_owner());

-- Tasks Policies
create policy "Owners can do everything on tasks"
  on public.tasks for all
  using (public.is_owner());

create policy "Members can read assigned tasks"
  on public.tasks for select
  using (assignee_id = auth.uid());

create policy "Members can update their assigned tasks"
  on public.tasks for update
  using (assignee_id = auth.uid())
  with check (assignee_id = auth.uid());

-- Comments Policies
create policy "Owners can do everything on comments"
  on public.comments for all
  using (public.is_owner());

create policy "Members can read comments on assigned tasks"
  on public.comments for select
  using (
    exists (
      select 1 from public.tasks
      where id = comments.task_id and assignee_id = auth.uid()
    )
  );

create policy "Members can insert comments on assigned tasks"
  on public.comments for insert
  with check (
    auth.uid() = user_id and
    exists (
      select 1 from public.tasks
      where id = task_id and assignee_id = auth.uid()
    )
  );

-- Attachments Policies
create policy "Owners can do everything on attachments"
  on public.attachments for all
  using (public.is_owner());

create policy "Members can read attachments on assigned tasks"
  on public.attachments for select
  using (
    exists (
      select 1 from public.tasks
      where id = attachments.task_id and assignee_id = auth.uid()
    )
  );

-- =========================================================================
-- SUPABASE STORAGE BUCKET SETUP
-- Run this block to create the bucket programmatically (optional, or create manually in storage UI)
-- =========================================================================
-- insert into storage.buckets (id, name, public) values ('attachments', 'attachments', true);
