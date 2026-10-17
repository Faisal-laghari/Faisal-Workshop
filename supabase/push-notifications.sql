-- Faisal' Workshop: secure Web Push subscription storage
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  timezone text not null default 'Asia/Karachi',
  reminder_hour smallint not null default 19 check (reminder_hour between 0 and 23),
  last_sent_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;
create policy "Users manage their own push subscriptions"
  on public.push_subscriptions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Server-only scheduler uses the service-role key; never expose that key in app.js.
-- Enable pg_cron and pg_net before scheduling the job. See PUSH-SETUP.md.
