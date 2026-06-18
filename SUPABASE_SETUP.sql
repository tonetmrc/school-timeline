-- Run this in Supabase SQL Editor (https://app.supabase.com → your project → SQL Editor)

-- 1. Create the schools table
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  de_start_date date not null,
  needs_translation boolean default false,
  translation_days integer default 4,
  confirmed boolean default true,
  confirm_note text default '',
  region text default 'US',
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security (RLS)
alter table public.schools enable row level security;

-- 3. Allow all operations (adjust for your auth setup if needed)
create policy "Allow all" on public.schools for all using (true) with check (true);

-- 4. Done! The app will seed default schools on first load.
