# Deploying to Railway

This project runs 24/7 on Railway using a **scheduler** process that triggers both check-in scripts at the right times (Eastern).

## What runs on Railway

- **`npm start`** → runs `scripts/scheduler.js`, which stays up and:
  - **Sunday 7:00 PM Eastern** → runs `sunday-checkin.js` (email + SMS)
  - **Mon–Fri 10:30 PM Eastern** → runs `evening-checkin.js` (SMS only)

No web server; this is a **worker** that only runs the scheduler.

## Deploy steps

### 1. Push your code

Push this repo to GitHub (or connect Railway to your existing repo). Do **not** commit `.env`; you’ll set secrets in Railway.

### 2. New project in Railway

1. [Railway Dashboard](https://railway.app/dashboard) → **New Project**
2. **Deploy from GitHub repo** → select this repo
3. Railway will detect Node and build with `npm install` and run `npm start` (the scheduler).

### 3. Set environment variables

In the Railway project: **Variables** (or **Settings** → **Variables**). Add every value you have in `.env` locally:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | From Anthropic console |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | Gmail app password |
| `TWILIO_ACCOUNT_SID` | Twilio console |
| `TWILIO_AUTH_TOKEN` | Twilio console |
| `TWILIO_FROM_NUMBER` | Your Twilio number (e.g. +1234567890) |
| `MY_PHONE_NUMBER` | Your phone for SMS (e.g. +1234567890) |

Copy from your local `.env` (or a backup); Railway does not read your `.env` file.

### 4. Worker (no web port)

Railway may prompt for a port. This app doesn’t serve HTTP.

- If asked for a **start command**: use `npm start` (or `node scripts/scheduler.js`).
- If asked for a **port**: you can leave it blank or set to something; the service is a worker. In **Settings** you can set the service type to **Worker** if that option exists, so Railway doesn’t expect a listening port.

### 5. Deploy and logs

- Trigger a **Deploy** (or push to the connected branch).
- Open **Deployments** → select the latest → **View Logs**. You should see:  
  `Scheduler running (Sunday 7 PM ET, Mon–Fri 10:30 PM ET). Press Ctrl+C to stop.`
- When a job runs you’ll see `[Scheduler] Running Sunday check-in` or `[Scheduler] Running evening check-in` plus the script output.

## Schedules (America/New_York)

| Script | When |
|--------|------|
| `sunday-checkin.js` | Every **Sunday** at **7:00 PM** Eastern |
| `evening-checkin.js` | **Monday–Friday** at **10:30 PM** Eastern |

The scheduler uses `node-cron` with timezone `America/New_York`, so daylight saving is handled automatically.

## Two-way SMS (webhook)

To reply to incoming texts, run the **webhook** server so Twilio can POST to it:

1. **Add a second service** in the same Railway project: **New** → **GitHub Repo** → same repo.
2. **Start command:** `npm run webhook` (or `node scripts/webhook.js`).
3. **Variables:** Use the same env vars as the scheduler (at least `ANTHROPIC_API_KEY`, `TWILIO_*`). The webhook reads `context/goals.md` and `context/accountability.md`.
4. **Public URL:** In the webhook service, open **Settings** → **Networking** → **Generate Domain**. You’ll get a URL like `https://your-app.up.railway.app`.
5. **Twilio:** In [Twilio Console](https://console.twilio.com) → **Phone Numbers** → your number → **Messaging**. Under "A MESSAGE COMES IN" set:
   - **Webhook:** `https://your-app.up.railway.app/sms`
   - **HTTP:** POST  
   Save. When someone texts your Twilio number, Twilio will POST to that URL; the app logs the message to `context/log.md`, gets a reply from Claude, and sends it back via SMS.

**Local test:** Run `npm run webhook`, then use a tunnel (e.g. ngrok) and point Twilio at the tunnel URL (e.g. `https://abc.ngrok.io/sms`) for testing.

## Local vs Railway

- **Locally:** Run `npm run sunday-checkin` or `npm run evening-checkin` when you want, `npm start` for the scheduler, or `npm run webhook` for two-way SMS.
- **Railway:** Run **two services**: one with `npm start` (scheduler), one with `npm run webhook` (public URL for Twilio).

## Troubleshooting

- **No email/SMS:** Check Railway **Variables**; missing or wrong env vars will cause the scripts to fail (check logs).
- **Wrong time:** Scheduler uses `America/New_York`. If your Railway region uses a different server time, the cron still runs in Eastern because of the timezone option.
- **Build fails:** Ensure `engines.node` in `package.json` is satisfied (Node 18+). Railway usually uses a recent Node by default.
