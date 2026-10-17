import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { date: `${value.year}-${value.month}-${value.day}`, hour: Number(value.hour) };
}

function localDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  const cronSecret = Deno.env.get("REMINDER_CRON_SECRET");
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!supabaseUrl || !serviceKey || !vapidPublicKey || !vapidPrivateKey) {
    return Response.json({ error: "Missing server configuration" }, { status: 500, headers: corsHeaders });
  }

  webpush.setVapidDetails("mailto:workshop-reminders@example.com", vapidPublicKey, vapidPrivateKey);
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const since = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
  const { data: subscriptions, error: subError } = await db
    .from("push_subscriptions")
    .select("endpoint,user_id,subscription,timezone,reminder_hour,last_sent_date");

  if (subError) return Response.json({ error: "Could not load subscriptions" }, { status: 500, headers: corsHeaders });

  let sent = 0;
  let skipped = 0;
  let removed = 0;
  const failures: string[] = [];

  for (const item of subscriptions ?? []) {
    const timezone = item.timezone || "Asia/Karachi";
    let localNow: { date: string; hour: number };
    try {
      localNow = localParts(now, timezone);
    } catch {
      skipped++;
      continue;
    }
    if (localNow.hour !== Number(item.reminder_hour ?? 19) || item.last_sent_date === localNow.date) {
      skipped++;
      continue;
    }

    const { data: tasks, error: taskError } = await db
      .from("tasks")
      .select("id,created_at")
      .eq("user_id", item.user_id)
      .gte("created_at", since)
      .limit(500);

    if (taskError) {
      failures.push(`task-check:${item.user_id}`);
      continue;
    }

    const addedToday = (tasks ?? []).some((task) => {
      try { return localDate(new Date(task.created_at), timezone) === localNow.date; }
      catch { return false; }
    });

    const payload = addedToday
      ? {
          title: "Your daily task reminder",
          body: "Take a moment to review your tasks and plan your next step.",
          url: "./",
          tag: `workshop-daily-${localNow.date}`,
        }
      : {
          title: "A fresh start",
          body: "You haven't added any tasks today. Add one small task to get started.",
          url: "./",
          tag: `workshop-daily-${localNow.date}`,
        };

    try {
      await webpush.sendNotification(item.subscription, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
      const { error: updateError } = await db
        .from("push_subscriptions")
        .update({ last_sent_date: localNow.date, updated_at: now.toISOString() })
        .eq("endpoint", item.endpoint);
      if (updateError) {
        failures.push(`update-date:${item.user_id}`);
      } else {
        sent++;
      }
    } catch (err) {
      const statusCode = Number((err as { statusCode?: number })?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", item.endpoint);
        removed++;
      } else {
        failures.push(`push:${item.user_id}:${statusCode || "unknown"}`);
      }
    }
  }

  return Response.json({ ok: true, checked: subscriptions?.length ?? 0, sent, skipped, removed, failures }, { headers: corsHeaders });
});
