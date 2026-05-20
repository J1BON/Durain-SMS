# Deploy Durain SMS (free hosting)

Your app already talks to Durian in real time for **countries**, **number stock**, and **balance**.  
On the server it also **auto-syncs the full service catalog** (~2,600+ names) from the Durian panel when it runs.

This guide uses **[Render](https://render.com)** (free web service) — best fit because `npm start` keeps running and background auto-sync works like on your PC.

---

## What stays in sync automatically

| Data | How |
|------|-----|
| **Balance** | Live from Durian API every 30s in the UI |
| **Countries & stock** | Live per service when you pick a country |
| **Service names (2,600+)** | Panel sync on server boot + every 30 min (`DURIAN_AUTO_SYNC_MINUTES`) |
| **Optional extra sync** | Cron hits `/api/cron/sync` (see below) |

---

## Before you deploy (one time on your PC)

1. Make sure the site works locally (`FIX-AND-START.bat` or `npm run dev`).

2. **Panel session for the cloud** (required for full service list):

   ```bash
   npm run panel-login
   npm run export-panel-cookie
   ```

   Copy the printed line — you will paste it as `DURIAN_SESSION_COOKIE` on Render.

   When that session expires (weeks/months), repeat and update the env var on Render.

3. Push the project to **GitHub** (private repo recommended):

   ```bash
   git init
   git add .
   git commit -m "Durain SMS"
   git branch -M main
   git remote add origin https://github.com/YOUR_USER/durain-sms.git
   git push -u origin main
   ```

   Do **not** commit `.env.local` (it is gitignored).

---

## Deploy on Render (free)

1. Sign up at [render.com](https://render.com) → **New +** → **Web Service**.

2. Connect your GitHub repo.

3. Settings:

   | Field | Value |
   |--------|--------|
   | **Runtime** | Node |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |
   | **Plan** | Free |

4. **Environment variables** (copy values from your local `.env.local`):

   | Key | Required | Notes |
   |-----|----------|--------|
   | `DURIAN_USERNAME` | Yes | DurianRCS username |
   | `DURIAN_API_KEY` | Yes | API key from Durian |
   | `DURIAN_WEB_PASSWORD` | Yes | Web panel password |
   | `DURIAN_SESSION_COOKIE` | Yes | From `npm run export-panel-cookie` |
   | `SITE_AUTH_USERNAME` | Yes | Login for *your* site |
   | `SITE_AUTH_PASSWORD` | Yes | Login for *your* site |
   | `SITE_AUTH_SECRET` | Yes | Long random string (32+ chars) |
   | `DURIAN_AUTO_SYNC_MINUTES` | No | Default `30` |
   | `CRON_SECRET` | No | Random string if you use external cron |

5. Click **Create Web Service**. First deploy takes a few minutes.

6. Open your URL (e.g. `https://durain-sms.onrender.com`) → log in with `SITE_AUTH_*`.

**Free tier note:** Render sleeps after ~15 minutes with no traffic. The first visit may take 30–60 seconds to wake up; auto-sync runs again after wake.

---

## Optional: cron ping (wake + sync)

If the app sleeps often, use a free cron service to call your sync URL every 6 hours:

- URL: `https://YOUR-APP.onrender.com/api/cron/sync`
- Header: `Authorization: Bearer YOUR_CRON_SECRET`
- Set `CRON_SECRET` on Render to the same value.

Services: [cron-job.org](https://cron-job.org) (free) or [UptimeRobot](https://uptimerobot.com) (monitor + optional).

---

## Alternative: Vercel (free, with limits)

Vercel is serverless — **no persistent `.cache` disk**, and sync can hit **10s timeouts** on the free plan. Use Render if you want the same behavior as local.

If you still use Vercel:

1. Import repo at [vercel.com](https://vercel.com).
2. Add the same env vars as above.
3. Set `CRON_SECRET` — Vercel cron (in `vercel.json`) sends `Authorization: Bearer <CRON_SECRET>` automatically.
4. Expect first load after cold start to refresh services via API/cron.

---

## Security checklist

- Use a **private** GitHub repo.
- Use a **strong** `SITE_AUTH_PASSWORD` and unique `SITE_AUTH_SECRET`.
- Never commit `.env.local` or paste API keys in chat/screenshots.
- Rotate Durian password / API key if they were ever exposed.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **No services / search empty** | Set `DURIAN_SESSION_COOKIE` on Render, redeploy, tap **Sync services from Durian** |
| Only ~1,700 generic “Project N” names | Set `DURIAN_SESSION_COOKIE`; run `npm run export-panel-cookie` again |
| “Panel session expired” in logs | `npm run panel-login` locally → update `DURIAN_SESSION_COOKIE` on host |
| Countries empty for a service | Check `DURIAN_API_KEY` and balance on Durian |
| Site slow first time | Free Render cold start — visit again or use cron ping |
| Sync manually | `GET /api/cron/sync` with `Authorization: Bearer CRON_SECRET` |

---

## Quick reference (local)

```bash
npm run panel-login          # refresh panel session
npm run export-panel-cookie  # print DURIAN_SESSION_COOKIE for cloud
npm run durian-sync          # manual catalog sync
```
