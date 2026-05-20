# Deploy Durain SMS (free hosting)

Your app talks to Durian in real time for **balance**, **countries**, **number stock**, **get number**, and **SMS**.  
The **full service name catalog** (~2,600+ projects) comes from the Durian **web panel**; the server keeps it in `.cache/` and refreshes it on a schedule.

This guide targets **[Render](https://render.com)** (free web service): `npm start` stays up so background refresh behaves like on your PC. For a fuller local setup, see **[README.md](./README.md)**.

---

## What stays in sync automatically

| Data | How |
|------|-----|
| **Balance** | Live from Durian API (~every 30s in the UI) |
| **Countries & stock** | Live when you pick a service / country |
| **Service names (2,600+)** | Panel-backed catalog in `.cache/`; UI also calls **`/api/services`** with cache-first + background refresh |
| **Optional wake + sync** | External cron → **`/api/cron/sync`** with `CRON_SECRET` (see below) |

---

## Before you deploy

1. Run the app locally once (**[README.md](./README.md)** — `.env.local`, `panel-login` or **`/panel-refresh`**, `durian-sync:force`) so you know credentials work.

2. **Panel session for the cloud** (you need one working panel login for the full catalog):

   | Approach | When to use |
   |----------|-------------|
   | **`/panel-refresh`** on the **live** site | Phone or any browser: sign in → open **`/panel-refresh`** (or footer **Renew Durian panel session**) → captcha → **Link Durian panel**. Set **`DURIAN_USE_DISK_PANEL_COOKIE=1`** on Render so this session is preferred over a stale **`DURIAN_SESSION_COOKIE`**. You can clear the env cookie when using disk-first mode. |
   | **`npm run panel-login`** → **`npm run export-panel-cookie`** on a PC | Paste the printed line as **`DURIAN_SESSION_COOKIE`** on Render. |

   Sessions **expire**; renew with **`/panel-refresh`** or repeat the PC export. After a **new deploy**, Render’s disk may be empty — run **`/panel-refresh` again** or update **`DURIAN_SESSION_COOKIE`**.

3. Push the project to **GitHub** (private repo recommended). Do **not** commit `.env.local`.

---

## Deploy on Render (free)

1. [render.com](https://render.com) → **New +** → **Web Service** → connect the repo.

2. **Build & start**

   | Field | Value |
   |--------|--------|
   | **Runtime** | Node |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |
   | **Plan** | Free |

3. **Environment variables** (mirror your local `.env.local`):

   | Key | Required | Notes |
   |-----|----------|--------|
   | `SITE_AUTH_USERNAME` | Yes | Who can open **your** site |
   | `SITE_AUTH_PASSWORD` | Yes | |
   | `SITE_AUTH_SECRET` | Yes | Long random string (32+ chars); also used to seal **`/panel-refresh`** challenge cookies |
   | `DURIAN_USERNAME` | Yes | DurianRCS username |
   | `DURIAN_API_KEY` | Yes | Durian API key |
   | `DURIAN_WEB_PASSWORD` | Yes | Web panel password (used by **`/panel-refresh`** and `panel-login`) |
   | `DURIAN_SESSION_COOKIE` | Recommended* | From `export-panel-cookie`, unless you rely only on **`/panel-refresh`** + disk |
   | `DURIAN_USE_DISK_PANEL_COOKIE` | No | Set **`1`** so `.cache/panel-cookies.json` (from **`/panel-refresh`**) wins over env when both exist |
   | `DURIAN_AUTO_SYNC_MINUTES` | No | Default **`30`** (in-app background catalog refresh) |
   | `CRON_SECRET` | No | For **`/api/cron/sync`** (`Authorization: Bearer …` or `?secret=`) |

   \* On first boot you can leave `DURIAN_SESSION_COOKIE` empty, open the site, complete **`/panel-refresh`**, then set **`DURIAN_USE_DISK_PANEL_COOKIE=1`** and redeploy if you want that mode permanently.

4. **Create Web Service**. First build/deploy takes a few minutes.

5. Open your URL → sign in with `SITE_AUTH_*` → if the service list is empty, tap **Sync services from Durian** (can take **1–2 min** on first sync).

**Free tier:** The service **sleeps** after ~15 minutes idle. The first request after sleep can take **30–60 seconds**. A cron ping (below) reduces cold starts.

---

## Optional: cron (wake + catalog sync)

Ping **`https://YOUR-APP.onrender.com/api/cron/sync`** on a schedule (e.g. every 6 hours):

- Header: `Authorization: Bearer YOUR_CRON_SECRET`  
  (or query: `?secret=YOUR_CRON_SECRET` — same value as env **`CRON_SECRET`** on Render)

Free schedulers: [cron-job.org](https://cron-job.org), [UptimeRobot](https://uptimerobot.com).

---

## Alternative: Vercel (free, with limits)

Serverless = **no persistent `.cache`** like a long-running Node box. Catalog sync can hit **timeouts** on the free plan. **Prefer Render** if you want parity with local.

If you use Vercel: add the same env vars; optional **`vercel.json`** cron still needs a valid panel session path for a large catalog.

---

## Security checklist

- Private GitHub repo when possible.
- Strong **`SITE_AUTH_PASSWORD`** and unique **`SITE_AUTH_SECRET`**.
- Never commit **`.env.local`** or paste secrets in screenshots/chat.
- Rotate Durian credentials if exposed.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **No services / empty search** | Sign in → **`/panel-refresh`** → **Link**; or set **`DURIAN_SESSION_COOKIE`** from `export-panel-cookie`. Then **Sync services from Durian**. |
| **“HTML instead of JSON” / panel session** | Cookie expired — **`/panel-refresh`** or refresh **`DURIAN_SESSION_COOKIE`**. With **`DURIAN_USE_DISK_PANEL_COOKIE=1`**, avoid an old env cookie shadowing a fresh disk session. |
| **~1,700 generic “Project N” names** | Panel catalog not loaded — same as “no services”. |
| **Countries empty / Get Number errors** | Check **`DURIAN_API_KEY`**, balance, and Durian API status (not the panel catalog). |
| **First load very slow** | Render cold start — wait and retry, or use cron ping. |
| **503 on panel sync** | Wait 1 min, **Sync** again; production defaults to **sequential** panel fetch (`DURIAN_PANEL_FETCH_MODE`). |

The server **falls back to stale** `.cache/panel-projects.json` / **`services.json`** when the live panel fails, so a brief outage should not wipe the UI with a raw JSON error.

---

## Quick reference (local machine)

```bash
npm run panel-login          # CLI captcha → .cache/panel-cookies.json
npm run export-panel-cookie  # print DURIAN_SESSION_COOKIE for Render
npm run durian-sync          # smart catalog sync
npm run durian-sync:force    # force full panel pull
```

On the **deployed** app, prefer **`/panel-refresh`** when you do not have a PC.
