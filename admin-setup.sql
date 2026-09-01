-- =============================================
-- MY COACHING SITE - ADMIN PANEL SETUP
-- Run this in Supabase SQL Editor
-- =============================================

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.admin_users enable row level security;

-- Helper function used by RLS policies
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;

-- Admin can read the admin_users table
 drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users for select to authenticated
using (public.is_admin());

-- Allow admin to read/edit/delete every coaching
 drop policy if exists "Admin can manage all coachings" on public.coachings;
create policy "Admin can manage all coachings"
on public.coachings for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Allow admin to manage every batch
 drop policy if exists "Admin can manage all batches" on public.batches;
create policy "Admin can manage all batches"
on public.batches for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =============================================
-- MAKE YOUR ACCOUNT ADMIN
-- IMPORTANT: Replace YOUR_ADMIN_EMAIL below
-- with the email you use to Login/Register on the website.
-- =============================================

-- Example:
-- insert into public.admin_users(user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
-- on conflict (user_id) do nothing;
