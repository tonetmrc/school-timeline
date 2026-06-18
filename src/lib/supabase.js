import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

// SQL to run in Supabase SQL editor:
/*
create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  de_start_date date not null,
  needs_translation boolean default false,
  translation_days integer default 4,
  confirmed boolean default true,
  confirm_note text,
  region text,
  created_at timestamptz default now()
);
*/
