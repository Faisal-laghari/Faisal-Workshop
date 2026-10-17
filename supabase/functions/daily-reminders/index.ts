import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    hour: Number(value.hour),
    clock: `${value.hour}:${value.minute}`,
  };
}

function localDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
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

  webpush.setVapidDetails("https://faisal-laghari.github.io/Faisal-Workshop/", vapidPublicKey, vapidPrivateKey);
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const since = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const { data: subscriptions, error: subError } = await db
    .from("push_subscriptions")
    .select("endpoint,user_id,subscription,timezone,reminder_hour,last_sent_date");

  if (subError) return Response.json({ error: "Could not load subscriptions" }, { status: 500, headers: corsHeaders });

  let sent = 0, taskSent = 0, skipped = 0, removed = 0;
  const failures: string[] = [];

  for (const item of subscriptions ?? []) {
    const timezone = item.timezone || "Asia/Karachi";
    let localNow: { date: string; hour: number; clock: string };
    try { localNow = localParts(now, timezone); }
    catch { skipped++; continue; }

    // Send any due, unfinished task once per device. Tasks are considered for their creation day.
    const { data: dueTasks, error: taskError } = await db
      .from("tasks")
      .select("id,title,time,done,created_at")
      .eq("user_id", item.user_id)
      .eq("done", false)
      .gte("created_at", since)
      .not("time", "is", null)
      .neq("time", "")
      .limit(500);

    if (taskError) {
      failures.push(`task-check:${item.user_id}`);
    } else {
      for (const task of dueTasks ?? []) {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(task.time || "")) continue;
        try {
          const taskDate = localDate(new Date(task.created_at), timezone);
          const yesterday = localDate(new Date(now.getTime() - 24 * 60 * 60 * 1000), timezone);
          // Include yesterday's tasks too, so a newly fixed reminder can recover a missed alert.
          if (taskDate !== localNow.date && taskDate !== yesterday) continue;
        } catch { continue; }
        if (task.time > localNow.clock) continue;

        const { data: existing } = await db.from("push_task_reminder_sends")
          .select("task_id").eq("endpoint", item.endpoint).eq("task_id", task.id).maybeSingle();
        if (existing) continue;

        const { error: markError } = await db.from("push_task_reminder_sends")
          .insert({ endpoint: item.endpoint, task_id: task.id, user_id: item.user_id });
        if (markError) {
          if (!String(markError.code || "").includes("23505")) failures.push(`task-mark:${task.id}`);
          continue;
        }

        const timeLabel = task.time;
        const payload = {
          title: "Task time: " + task.title,
          body: `It's ${timeLabel} — time to work on this task.`,
          url: "./",
          tag: `workshop-task-${task.id}`,
          vibrate: [250, 120, 250, 120, 400],
        };
        try {
          await webpush.sendNotification(item.subscription, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
          taskSent++;
        } catch (err) {
          await db.from("push_task_reminder_sends").delete().eq("endpoint", item.endpoint).eq("task_id", task.id);
          const statusCode = Number((err as { statusCode?: number })?.statusCode || 0);
          if (statusCode === 404 || statusCode === 410) {
            await db.from("push_subscriptions").delete().eq("endpoint", item.endpoint);
            removed++;
          } else failures.push(`task-push:${item.user_id}:${statusCode || "unknown"}`);
        }
      }
    }

    // Existing once-daily general reminder.
    if (localNow.hour < Number(item.reminder_hour ?? 19) || item.last_sent_date === localNow.date) {
      skipped++;
      continue;
    }

    const { data: todaysTasks, error: todayError } = await db
      .from("tasks").select("id,created_at")
      .eq("user_id", item.user_id).gte("created_at", since).limit(500);
    if (todayError) {
      failures.push(`daily-task-check:${item.user_id}`);
      continue;
    }
    const addedToday = (todaysTasks ?? []).some((task) => {
      try { return localDate(new Date(task.created_at), timezone) === localNow.date; }
      catch { return false; }
    });
    const payload = addedToday
      ? { title: "Your daily task reminder", body: "Take a moment to review your tasks and plan your next step.", url: "./", tag: `workshop-daily-${localNow.date}` }
      : { title: "A fresh start", body: "You haven't added any tasks today. Add one small task to get started.", url: "./", tag: `workshop-daily-${localNow.date}` };

    try {
      await webpush.sendNotification(item.subscription, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
      const { error: updateError } = await db.from("push_subscriptions")
        .update({ last_sent_date: localNow.date, updated_at: now.toISOString() })
        .eq("endpoint", item.endpoint);
      if (updateError) failures.push(`update-date:${item.user_id}`);
      else sent++;
    } catch (err) {
      const statusCode = Number((err as { statusCode?: number })?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", item.endpoint);
        removed++;
      } else failures.push(`daily-push:${item.user_id}:${statusCode || "unknown"}`);
    }
  }

  return Response.json({ ok: true, checked: subscriptions?.length ?? 0, sent, taskSent, skipped, removed, failures }, { headers: corsHeaders });
});
