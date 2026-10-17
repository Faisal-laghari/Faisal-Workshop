# Faisal' Workshop

A mobile-first personal productivity workspace for planning tasks, tracking daily progress, writing notes, and keeping important files together. It is a static web app and installable Progressive Web App (PWA), with optional cloud sync and background push reminders.

**Live app:** https://faisal-laghari.github.io/Faisal-Workshop/  
**Source code:** https://github.com/Faisal-laghari/Faisal-Workshop

## Features

### Daily routine and tasks
- Add tasks with a title and optional 24-hour time.
- Mark tasks complete and view daily completion progress.
- Delete tasks you no longer need.
- Signed-in cloud accounts can sync tasks across supported devices.

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
- With cloud sync enabled, files use private cloud storage and short-lived download links.

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
- GitHub Pages hosting

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

## Data and privacy

- **Local mode:** data is saved in the current browser/device. It does not automatically sync, and clearing browser/site data may remove it.
- **Cloud mode:** sign in to sync supported records. Database row-level security limits account access to that user's records.
- **Files:** cloud uploads are stored in a private bucket; signed download URLs expire.
- **Push subscriptions:** the backend stores subscription details to send notifications to opted-in devices.
- Keep regular JSON backups. Do not share account passwords or private server keys.

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
