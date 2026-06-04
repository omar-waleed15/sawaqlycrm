-- =========================================================================
-- FIX: Infinite Recursion in RLS Policies
-- Run this entire script in the Supabase SQL Editor to fix the login issue.
-- =========================================================================

-- Step 1: Drop all existing broken policies
drop policy if exists "Owners can do everything on profiles" on public.profiles;
drop policy if exists "Users can read profiles" on public.profiles;
drop policy if exists "Users can update their own profile name" on public.profiles;

drop policy if exists "Owners can do everything on tasks" on public.tasks;
drop policy if exists "Members can read assigned tasks" on public.tasks;
drop policy if exists "Members can update status and submission_link of assigned tasks" on public.tasks;

drop policy if exists "Owners can do everything on comments" on public.comments;
drop policy if exists "Members can read comments on assigned tasks" on public.comments;
drop policy if exists "Members can insert comments on assigned tasks" on public.comments;

drop policy if exists "Owners can do everything on attachments" on public.attachments;
drop policy if exists "Members can read attachments on assigned tasks" on public.attachments;

-- Step 2: Create a security-definer function to check owner role
-- (This runs as the DB owner, bypassing RLS and preventing recursion)
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

-- Step 3: Recreate profiles policies (no more recursion — uses is_owner() instead)
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

-- Step 4: Recreate tasks policies
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

-- Step 5: Recreate comments policies
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

-- Step 6: Recreate attachments policies
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
