# Durain SMS

A mobile-friendly web app for **DurianRCS** — search 2,600+ services by name, pick a country, get a number, and receive SMS verification codes. Balance, countries, and stock sync live from Durian.

---

## What you need

| Requirement | Notes |
|-------------|--------|
| **Node.js 20+** | [nodejs.org](https://nodejs.org) |
| **DurianRCS account** | API key + web panel login |
| **Git** | For deploy (optional locally) |

---

## A–Z setup (first time)

### 1. Get your DurianRCS credentials

Log in to your DurianRCS account and collect:

| Item | Where to find it |
|------|------------------|
| **Username** | Your DurianRCS login name |
| **API key** | Durian dashboard → API / developer section |
| **Web password** | Same password you use on `mm.durianrcs.com` |

You will use these in `.env.local` below.

---

### 2. Install the project

```bash
cd Durain
npm install
```

---

### 3. Create `.env.local`

Copy the example file:

```bash
copy .env.example .env.local
```

(On Mac/Linux: `cp .env.example .env.local`)

Open `.env.local` and fill in **your** values:

```env
# --- Your site login (who can open this app) ---
SITE_AUTH_USERNAME=choose_a_username
SITE_AUTH_PASSWORD=choose_a_strong_password
SITE_AUTH_SECRET=any_long_random_string_at_least_32_chars

# --- DurianRCS API (your Durian account) ---
DURIAN_USERNAME=your_durian_username
DURIAN_API_KEY=your_durian_api_key
DURIAN_WEB_PASSWORD=your_durian_web_panel_password
```

**Important:** Never commit `.env.local` to Git. It is already in `.gitignore`.

---

### 4. Link the Durian web panel (service names)

The app loads **real service names** (Microsoft, Amazon, Rips, etc.) from the Durian **web panel**, not only the API.

**Option A — recommended (captcha login):**

```bash
npm run panel-login
```

1. A captcha image is saved to `.cache/captcha.gif` — open it.
2. Enter the code when prompted.
3. On success, the panel session is stored in `.cache/panel-cookies.json`.

**Option B — manual cookie:**

1. Log in at [mm.durianrcs.com](https://mm.durianrcs.com) in your browser.
2. DevTools → Application → Cookies → copy session cookies.
3. Add one line to `.env.local`:

```env
DURIAN_SESSION_COOKIE=PHPSESSID=xxx; other_cookie=yyy
```

---

### 5. Sync the full service catalog

```bash
npm run durian-sync:force
```

This downloads ~2,600+ projects into `.cache/services.json`. First run can take **30–60 seconds**.

---

### 6. Start the app

**Windows (one click):**

```bat
FIX-AND-START.bat
```

**Or manually:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → sign in with `SITE_AUTH_USERNAME` / `SITE_AUTH_PASSWORD`.

---

## Using a different Durian account

To switch from one DurianRCS account to another (new API key, balance, services):

### Step 1 — Update `.env.local`

Replace these with the **new** account’s values:

```env
DURIAN_USERNAME=new_durian_username
DURIAN_API_KEY=new_durian_api_key
DURIAN_WEB_PASSWORD=new_web_panel_password
```

Remove or comment out the old panel cookie (it belongs to the old account):

```env
# DURIAN_SESSION_COOKIE=...
```

### Step 2 — Clear old cached data

Delete the cache folder so the old account’s services are not reused:

```bash
npm run clean
```

Then delete the Durian cache (Windows PowerShell):

```powershell
Remove-Item -Recurse -Force .cache -ErrorAction SilentlyContinue
```

(On Mac/Linux: `rm -rf .cache`)

### Step 3 — Log in to the new panel & sync

```bash
npm run panel-login
npm run durian-sync:force
```

### Step 4 — Restart the app

```bash
FIX-AND-START.bat
```

or `npm run dev`.

You should see the **new account’s balance** and full service list.

### Deploying with another account (Render / cloud)

1. Update **all** Durian env vars on your host (`DURIAN_USERNAME`, `DURIAN_API_KEY`, `DURIAN_WEB_PASSWORD`).
2. On your PC, run `npm run panel-login` + `npm run export-panel-cookie` while logged into the **new** panel.
3. Paste the new line into `DURIAN_SESSION_COOKIE` on Render.
4. Redeploy and tap **Sync services from Durian** once (wait 1–2 minutes).

---

## Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SITE_AUTH_USERNAME` | Yes | Login username for **this** website |
| `SITE_AUTH_PASSWORD` | Yes | Login password for **this** website |
| `SITE_AUTH_SECRET` | Yes | Random secret for session cookies (32+ chars) |
| `DURIAN_USERNAME` | Yes | DurianRCS account username |
| `DURIAN_API_KEY` | Yes | DurianRCS API key |
| `DURIAN_WEB_PASSWORD` | Yes* | Web panel password (`panel-login`) |
| `DURIAN_SESSION_COOKIE` | Yes** | Panel cookie string (cloud / or skip if using local cache) |
| `DURIAN_AUTO_SYNC_MINUTES` | No | Background sync interval (default `30`) |
| `DURIAN_PANEL_FETCH_MODE` | No | `sequential` on production (avoids 503); `parallel` for fast local |
| `CRON_SECRET` | No | For `/api/cron/sync` on hosted deploy |
| `DURIAN_AUTO_SYNC_DISABLED` | No | Set `1` to turn off background sync |

\* Required for `npm run panel-login`  
\** Required on Render; optional locally if `.cache/panel-cookies.json` exists

---

## NPM scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Start development server |
| `npm run dev:fresh` | Clear `.next` cache and start dev |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run panel-login` | Log into Durian web panel (captcha) |
| `npm run export-panel-cookie` | Print `DURIAN_SESSION_COOKIE` for cloud hosting |
| `npm run durian-sync` | Smart sync services from panel |
| `npm run durian-sync:force` | Force full service catalog sync |
| `npm run fix-and-start` | Sync + start (used by `FIX-AND-START.bat`) |

---

## Using the app

1. **Sign in** with your site credentials (`SITE_AUTH_*`).
2. **Search** a service by name (e.g. Microsoft, Rips).
3. Pick **country** (US is listed first when stock exists).
4. Optional: **Secret key**, **Single / Multiple** message mode.
5. Tap **Get Number** → copy phone / wait for SMS code.
6. **Balance** updates automatically from Durian.

**Dark / light mode:** Use the moon/sun button (top-left on home, top-right on login).

**Favorites:** Star icon on services and countries (saved in your browser).

---

## Deploy online (free — Render)

Full cloud guide: **[DEPLOY.md](./DEPLOY.md)**

Short version:

1. Push project to GitHub (private repo).
2. [Render](https://render.com) → New Web Service → connect repo.
3. Build: `npm install && npm run build` · Start: `npm start`
4. Add all env vars from `.env.local` plus:

   ```bash
   npm run export-panel-cookie
   ```

   → paste as `DURIAN_SESSION_COOKIE` on Render.

5. Open your Render URL → login → **Sync services from Durian** (first time, wait 1–2 min).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login page spins forever | Pull latest code (login `Suspense` fix); hard refresh |
| No services / search empty | Run `panel-login` + `durian-sync:force`; on Render set `DURIAN_SESSION_COOKIE` |
| `Panel project list failed (503)` | Wait 1 min, tap **Sync** again; production uses slow sequential fetch |
| Generic “Project N” names | Panel not linked — run `panel-login` or set `DURIAN_SESSION_COOKIE` |
| `ENOENT` / Next.js errors | `npm run dev:fresh` or delete `.next` folder |
| Wrong balance / services | You may still be on old account — see **Using a different Durian account** |
| Get Number disabled | Wait for countries to load; pick service + country |
| Panel session expired, “HTML instead of JSON”, or sync errors | `DURIAN_SESSION_COOKIE` expired — run `npm run panel-login` → `export-panel-cookie`, paste into Render env, **Manual Deploy**. The server reuses the last saved catalog (`.cache/panel-projects.json`) when the live panel fails. |

---

## Security

- Keep `.env.local` private.
- Use a **strong** `SITE_AUTH_PASSWORD` and unique `SITE_AUTH_SECRET`.
- Use a **private** GitHub repo if you deploy.
- Rotate API keys if they were ever shared.
- `SITE_AUTH_*` controls who can open **your** site; `DURIAN_*` is which Durian account the server uses.

---

## Project structure (brief)

| Path | Purpose |
|------|---------|
| `app/` | Next.js pages & API routes |
| `lib/` | Durian API, panel sync, auth |
| `components/` | UI components |
| `.cache/` | Local service catalog & panel cookies (gitignored) |
| `scripts/` | Panel login, auto-sync CLI |

---

## License

Private project — for use with your own DurianRCS account.
