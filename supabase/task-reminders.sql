-- Per-device deduplication for scheduled task alerts.
create table if not exists public.push_task_reminder_sends (
  endpoint text not null references public.push_subscriptions(endpoint) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (endpoint, task_id)
);
alter table public.push_task_reminder_sends enable row level security;

-- Replace hourly scheduler with a one-minute check so task alerts are near their chosen time.
do $$
declare old_job record;
begin
  for old_job in select jobid from cron.job where jobname in ('workshop-daily-push-hourly', 'workshop-daily-push-minute')
  loop
    perform cron.unschedule(old_job.jobid);
  end loop;
end $$;
select cron.schedule(
  'workshop-daily-push-minute',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'fw_push_project_url_v1') || '/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'fw_push_publishable_key_v1'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fw_push_cron_secret_v1')
    ),
    body := '{}'::jsonb
  );
  $job$
);
