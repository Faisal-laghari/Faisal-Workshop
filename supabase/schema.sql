-- Faisal' Workshop backend schema (run in Supabase SQL Editor)
create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  time text not null default '',
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  path text not null unique,
  type text not null default '',
  size bigint not null default 0 check (size >= 0),
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.files enable row level security;

drop policy if exists "Users manage their own tasks" on public.tasks;
create policy "Users manage their own tasks" on public.tasks for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage their own notes" on public.notes;
create policy "Users manage their own notes" on public.notes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage their own file records" on public.files;
create policy "Users manage their own file records" on public.files for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private bucket for uploaded files; each account can access only its own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workshop-files', 'workshop-files', false, 26214400, null)
on conflict (id) do update set public=false, file_size_limit=26214400;

drop policy if exists "Users upload to own workshop folder" on storage.objects;
create policy "Users upload to own workshop folder" on storage.objects for insert to authenticated with check (bucket_id='workshop-files' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users read own workshop files" on storage.objects;
create policy "Users read own workshop files" on storage.objects for select to authenticated using (bucket_id='workshop-files' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users delete own workshop files" on storage.objects;
create policy "Users delete own workshop files" on storage.objects for delete to authenticated using (bucket_id='workshop-files' and (storage.foldername(name))[1]=auth.uid()::text);
