# Faisal' Workshop

A mobile-first personal workspace for daily routine, notes, and files. Frontend is plain HTML/CSS/JavaScript and the cloud backend uses Supabase Auth, Postgres, Row Level Security, and private Storage.

## Run in VS Code

1. Open this folder in Visual Studio Code.
2. Install the **Live Server** extension (or use any static web server).
3. Right-click `index.html` and choose **Open with Live Server**.
4. Local mode works without a cloud account; browser-local data is not automatically shared with another device.

## Enable cloud sync (free Supabase tier)

1. Create a project at https://supabase.com.
2. Open **SQL Editor**, paste and run `supabase/schema.sql`.
3. Open **Project Settings → API** and copy the Project URL and anon/publishable key.
4. In `app.js`, fill in `CONFIG.supabaseUrl` and `CONFIG.supabaseAnonKey`.
   - The anon/publishable key is designed to be used in a browser. Never use the `service_role` secret in frontend code.
5. In Supabase **Authentication → URL Configuration**, add your deployed site URL to Site URL and Redirect URLs.
6. In Authentication settings, choose whether email confirmation is required.
7. Run locally over Live Server and create an account. Tasks, notes, and uploaded files are then associated with that signed-in account.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Import that repository in https://vercel.com/new.
3. Framework preset: **Other**; Build command: leave blank; Output directory: `.`.
4. Deploy, then add the deployed URL to Supabase Auth URL Configuration.
5. After changing files, push to GitHub to trigger a new deployment.

## Features

- Daily task list with times and completion progress
- Notes with create, edit, and delete
- File/image uploads and downloads (25 MB max per file)
- Installable PWA and basic offline app shell
- JSON backup export/import for local mode
- Supabase email/password authentication and per-user row-level security

## Privacy and limitations

- Without Supabase configuration, the app uses browser-local storage. Data will not sync to another device and clearing browser data may remove it.
- With cloud sync enabled, each signed-in user can only access their own records. Storage is private and downloads use short-lived signed URLs.
- Keep regular backups. Do not put a Supabase service-role key into frontend code.
