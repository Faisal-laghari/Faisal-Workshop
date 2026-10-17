# Background push reminders

The browser code and Edge Function implement Web Push. The app uses the public VAPID key in `app.js`; the VAPID private key stays in a local ignored env file and must only be configured as a Supabase Edge Function secret.

## 1. Apply the database schema

In Supabase Dashboard → SQL Editor, run `supabase/push-notifications.sql`. This creates the private per-user `push_subscriptions` table with RLS.

## 2. Deploy the Edge Function

The function source is `supabase/functions/daily-reminders/index.ts`. Supabase CLI must be authenticated to the project. From this folder, run:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref jpafppxtsljbibtvpqpm
npx.cmd supabase secrets set --env-file supabase/.env.push.local
npx.cmd supabase functions deploy daily-reminders --no-verify-jwt
```

Use the Supabase access token only in the CLI login prompt; do not paste it into source files, chat, or GitHub. Supabase provides the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables to Edge Functions. Never put the service-role key in frontend code.

If running `supabase login` on a different computer, install the Supabase CLI and authenticate there, then run the link/secrets/deploy commands from the project folder. The `.env.push.local` file is ignored by Git.

## 3. Enable the database scheduler

In Supabase Dashboard → Database → Extensions, enable `pg_cron` and `pg_net`. Then run the local-only SQL in `supabase/push-vault-secrets.local.sql` in SQL Editor. That SQL stores the scheduler credentials in Vault and schedules an hourly invocation. Keep that file out of GitHub; it contains the scheduler secret.

The function sends one reminder per local date at the device's configured local hour (currently 7 PM). If the user added a task that day, it sends a task-review reminder; otherwise it sends a gentle reminder to add one task. Invalid/expired push endpoints are removed automatically.

## 4. Test on the deployed PWA

1. Open the deployed HTTPS app in Chrome (Android works best when the PWA is installed).
2. Sign in to the same account used on other devices.
3. Add/run the database schema first; then click **Enable daily reminders** and allow notifications.
4. Confirm one row appears in `public.push_subscriptions` for the signed-in user.
5. Use Supabase → Edge Functions → `daily-reminders` → Logs to inspect execution. Use Database → Cron Jobs / `cron.job_run_details` to verify scheduler runs.
6. To test without waiting until 7 PM, temporarily change `reminder_hour` to the current hour for your own row and invoke the function using the configured cron secret; restore it after the test.

## Limits

Push delivery depends on browser/device support, permission, internet connectivity, and OS power-management settings. A scheduler and successful push request cannot guarantee delivery on every device. The app's local-only reminders remain a fallback when no account is signed in, but they require the page to be running.
