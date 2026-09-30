-- Run this in the Supabase SQL Editor for your project.
-- Tokens are encrypted by the server before they are stored.
create table if not exists public.google_sessions (
  session_id text primary key,
  encrypted_tokens text not null,
  updated_at timestamptz not null default now()
);

alter table public.google_sessions enable row level security;

-- Intentionally create no anon/authenticated policies.
-- Only the server-side service role key should access this table.
