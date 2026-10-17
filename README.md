# Faisal' Workshop

A mobile-first personal productivity workspace for planning tasks, tracking daily progress, writing notes, and keeping important files together. It is a static web app and installable Progressive Web App (PWA), with optional Supabase cloud sync and background push reminders.

**Live app:** https://faisal-laghari.github.io/Faisal-Workshop/  
**Source code:** https://github.com/Faisal-laghari/Faisal-Workshop

## Features

### Daily routine and tasks
- Add tasks with a title and optional 24-hour time.
- Mark tasks complete and view daily completion progress.
- Delete tasks you no longer need.
- Tasks saved to a signed-in Supabase account can sync across supported devices.

### Task-time push reminders
- Optional browser push notifications for timed, unfinished tasks.
- A scheduled backend checks every minute and sends a reminder when a task's saved time has arrived.
- A task reminder is recorded to prevent repeatedly sending the same alert to the same subscription.
- General daily reminder is also supported.
- Notification vibration is requested as three pulses where the device/browser supports it.

**Important sound limitation:** a website/PWA cannot reliably force a custom ringtone or exactly three audible beeps while running in the background. The operating system and browser control notification sound, and some devices ignore web vibration patterns. Enable notification sound and vibration for Chrome/the installed app in device settings, turn off silent/Do Not Disturb as needed, and test on the target phone. Delivery also depends on push support, network access, permission, battery/background restrictions, and the scheduled backend.

### Notes
- Create, edit, and delete titled notes.
- Keep note text organized in one place.

### Files and images
- Upload, preview, download, and delete documents or images.
- Maximum upload size: 25 MB per file.
- With cloud sync enabled, files use a private Supabase Storage bucket and short-lived download links.

### Backups and installability
- Export tasks, notes, and supported local files to a JSON backup.
- Restore a compatible JSON backup in local mode.
- Install on supported phones/desktops using the browser's **Install app** or **Add to Home screen** option.
- Service worker provides a basic cached app shell for offline opening; cloud sync and push delivery still require connectivity.

## Technology

- HTML5
- CSS3, responsive layout
- Vanilla JavaScript (ES modules)
- Progressive Web App: Web App Manifest, Service Worker, Web Push API
- Supabase Auth for email/password sign-in
- Supabase Postgres with Row Level Security (RLS)
- Supabase Storage for private file uploads
- Supabase Edge Function + Web Push (VAPID) for background reminders
- Supabase Cron/pg_net for scheduled backend checks
- GitHub Pages for hosting

## Use the live app

1. Open https://faisal-laghari.github.io/Faisal-Workshop/ in a supported browser.
2. Create an account or sign in to sync data across devices.
3. Add tasks, optionally set their times, and mark them complete as you go.
4. Use **Notes** to save ideas and **Files & images** to keep documents.
5. Tap **Enable task alerts** and allow notifications. Keep notification sound/vibration enabled in the phone's system settings.
6. On Android, install the app from the browser menu if the option is available. Reopen it and confirm notification permission if required.

## Run locally

1. Clone or download this repository.
2. Open the folder in VS Code.
3. Serve it using the VS Code **Live Server** extension or another local HTTP server.
4. Open the local URL in a modern browser.

Service workers require HTTPS or localhost. Some browser features, especially push notifications, may not work from a plain `file://` URL.

## Supabase setup

The hosted project is already configured for this repository. For a separate fork or fresh deployment:

1. Create a project at https://supabase.com.
2. In **SQL Editor**, run `supabase/schema.sql` to create tasks, notes, file records, RLS policies, and the private storage bucket.
3. Run `supabase/push-notifications.sql` to create the push-subscription table and its account policy.
4. Configure the project's URL and public anon/publishable key in `CONFIG` at the top of `app.js`.
   - A browser publishable/anon key is expected here.
   - **Never** place the Supabase `service_role` key, VAPID private key, or cron secret in frontend code or commit them to Git.
5. In Supabase Authentication URL Configuration, set the site's URL and add the relevant local/deployed URLs to the redirect allow-list.
6. Configure email confirmation according to your account requirements.
7. Deploy the `daily-reminders` Edge Function with the required server-side secrets: Supabase URL, service-role key, VAPID public/private keys, and `REMINDER_CRON_SECRET`.
8. Configure the private Vault values used by the scheduler and enable the required `pg_cron` and `pg_net` extensions.
9. Run `supabase/task-reminders.sql` after the Vault values and extensions are configured. It creates the per-task send ledger and schedules a minute-by-minute call to the Edge Function.
10. Open the app, sign in, enable task alerts, and test on the target device.

The scheduler SQL expects these Vault secret names:
- `fw_push_project_url_v1`
- `fw_push_publishable_key_v1`
- `fw_push_cron_secret_v1`

The Edge Function needs its own server-side secrets configured in Supabase. Keep all private values out of Git history, screenshots, and frontend code.

## Deploy to GitHub Pages

The live project is hosted at:

https://faisal-laghari.github.io/Faisal-Workshop/

For updates to this repository:

1. Commit your changes.
2. Push to the repository's `main` branch.
3. Wait for GitHub Pages to publish the latest files.
4. Refresh the app on your phone. If old assets persist, close and reopen the installed PWA or refresh the site so the updated service worker can activate.

This is a static site; there is no frontend build step.

## Data and privacy

- **Local mode:** data is saved in the current browser/device. It does not automatically sync, and clearing browser/site data may remove it.
- **Cloud mode:** sign in to sync supported records. Database row-level security limits account access to that user's records.
- **Files:** cloud uploads are stored in a private bucket; signed download URLs expire.
- **Push subscriptions:** the backend stores subscription details to send notifications to opted-in devices.
- Keep regular JSON backups. Do not share account passwords, service-role keys, VAPID private keys, or scheduler secrets.

## Troubleshooting

- **Tasks do not sync:** confirm you are signed into the same account on both devices and that cloud sync is connected.
- **No task alert:** confirm the task is unfinished, has a valid time, and is stored in the signed-in cloud account; then check that notifications are allowed and the device is online.
- **No sound/vibration:** check device notification settings, Chrome/site permission, silent mode, Do Not Disturb, and battery/background restrictions. Browser/OS settings determine the actual sound; a web app cannot guarantee a custom three-beep ringtone.
- **Push permission was denied:** open the browser's site settings, allow notifications, then return to the app and enable task alerts again.
- **App shows old UI:** refresh the site or close/reopen the installed PWA to allow the service worker to update.
- **Backup restore fails:** use a valid JSON file exported by Faisal' Workshop. In this version, backup import is intended for local mode.

## Project files

```text
.
├── index.html
├── styles.css
├── app.js
├── sw.js
├── manifest.json
├── icon.svg
├── icon-192.png
├── icon-512.png
└── supabase/
    ├── schema.sql
    ├── push-notifications.sql
    ├── task-reminders.sql
    └── functions/
        └── daily-reminders/
            └── index.ts
```

## License

No license file is currently included. Contact the project owner before redistributing the project.
