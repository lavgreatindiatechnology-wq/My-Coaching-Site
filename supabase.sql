-- RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR

create extension if not exists "uuid-ossp";

create table if not exists public.coachings (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  coaching_name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  founder_name text,
  founder_designation text,
  founder_photo_url text,
  phone text,
  email text,
  address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.batches (
  id uuid primary key default uuid_generate_v4(),
  coaching_id uuid not null references public.coachings(id) on delete cascade,
  batch_name text not null,
  description text,
  created_at timestamptz default now()
);

alter table public.coachings enable row level security;
alter table public.batches enable row level security;

drop policy if exists "Public can read coachings" on public.coachings;
create policy "Public can read coachings"
on public.coachings for select using (true);

drop policy if exists "Owner can insert coaching" on public.coachings;
create policy "Owner can insert coaching"
on public.coachings for insert to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "Owner can update coaching" on public.coachings;
create policy "Owner can update coaching"
on public.coachings for update to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Owner can delete coaching" on public.coachings;
create policy "Owner can delete coaching"
on public.coachings for delete to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Public can read batches" on public.batches;
create policy "Public can read batches"
on public.batches for select using (true);

drop policy if exists "Owner manages batches" on public.batches;
create policy "Owner manages batches"
on public.batches for all to authenticated
using (
  exists (
    select 1 from public.coachings c
    where c.id = coaching_id and c.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.coachings c
    where c.id = coaching_id and c.owner_id = auth.uid()
  )
);

insert into storage.buckets (id,name,public)
values ('coaching-images','coaching-images',true)
on conflict (id) do update set public=true;

drop policy if exists "Authenticated users upload coaching images" on storage.objects;
create policy "Authenticated users upload coaching images"
on storage.objects for insert to authenticated
with check (bucket_id = 'coaching-images');

drop policy if exists "Public can view coaching images" on storage.objects;
create policy "Public can view coaching images"
on storage.objects for select using (bucket_id = 'coaching-images');
