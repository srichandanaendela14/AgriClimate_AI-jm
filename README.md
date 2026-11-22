# AgriClimate AI

AgriClimate AI is a simple, mobile-friendly web app that helps farmers make weather-smart decisions.

| Feature | What it does |
| --- | --- |
| **Rainfall Prediction** | 7-day localized rainfall forecast with rain probability and expected millimetres (Open-Meteo). |
| **Smart Irrigation** | Recommends *Irrigate now*, *Light irrigation*, *Wait for rain* or *No irrigation needed* from the forecast, crop type, soil type and soil moisture. |
| **Drought Warning** | Low / Moderate / High / Severe drought level from 30-day rainfall vs. evaporation, dry spells, 7-day outlook and soil moisture. |
| **Weather Alerts** | Watches the hourly forecast and sends phone push notifications ~2–3 hours before heavy rain, thunderstorms, strong winds or extreme temperatures. |

**Pages:** Home · Dashboard · Rainfall Prediction · Irrigation Advisor · Drought Monitor · Weather Alerts · Farmer Profile

**Tech stack:** React 19 + Vite + Tailwind CSS v4 (frontend) · Python Flask (API) · SQLite (database) · PWA + Web Push API (VAPID) for notifications · Open-Meteo for weather.

---

## Project structure

```
.
├── index.html               # PWA meta tags + manifest link
├── vite.config.js           # Dev server (port 5173) proxies /api -> Flask (port 5000)
├── public/
│   ├── manifest.webmanifest # PWA manifest (installable app)
│   ├── sw.js                # Service worker: offline cache + push notifications
│   ├── icons/               # App icons
│   └── images/
├── src/
│   ├── App.jsx              # Routes
│   ├── components/          # Layout, shared UI, charts
│   ├── lib/                 # API client (SWR), push helpers, formatting
│   └── pages/               # Home, Dashboard, Rainfall, Irrigation, Drought, Alerts, Profile
└── backend/
    ├── app.py               # Flask REST API
    ├── database.py          # SQLite schema + helpers
    ├── weather.py           # Open-Meteo client, cache, demo fallback
    ├── logic.py             # Irrigation, drought and hazard detection logic
    ├── push.py              # VAPID keys + Web Push delivery
    ├── scheduler.py         # Background alert checker
    └── requirements.txt
```

---

## Requirements

- **Python 3.10+**
- **Node.js 20+** and npm (or pnpm)
- Internet access (for live Open-Meteo weather data)

---

## Installation

### 1. Backend (Flask + SQLite)

```bash
cd backend
python3 -m venv .venv

# macOS / Linux
source .venv/bin/activate
# Windows (PowerShell)
.venv\Scripts\Activate.ps1

pip install -r requirements.txt
python app.py
```

The API starts on **http://localhost:5000**. On first run it automatically:

- creates the SQLite database at `backend/instance/agriclimate.db`
- adds a demo farmer profile (Pune, India – change it on the Farmer Profile page)
- generates VAPID push keys at `backend/instance/vapid_private.pem`
- starts the background alert checker (every 15 minutes)

### 2. Frontend (React + Tailwind)

Open a second terminal in the project root:

```bash
npm install        # or: pnpm install
npm run dev        # or: pnpm dev
```

Open **http://localhost:5173**. The Vite dev server forwards all `/api` requests to Flask.

### 3. First steps

1. Go to **Farmer Profile**, search your village/town (or use GPS), choose your crop and soil, then **Save profile**.
2. Open the **Dashboard** for today's summary.
3. Go to **Weather Alerts** → **Enable notifications** → **Send test** to confirm push works.

---

## Mobile notifications (PWA + Web Push)

- Push notifications require a **secure context**: `http://localhost` works for testing; any other address must use **HTTPS**.
- **Android (Chrome, Edge, Samsung Internet)** and **desktop browsers**: open the site, tap *Enable notifications* and allow the permission.
- **iPhone / iPad (iOS 16.4+)**: open the site in Safari → Share → **Add to Home Screen**, then open the app from the Home Screen and tap *Enable notifications*.
- Notifications are not available when the app runs inside an iframe (for example an embedded preview). Open it in its own browser tab.

### How alerts are timed

The scheduler (`backend/scheduler.py`) loads the hourly forecast for each farmer every `ALERT_CHECK_MINUTES` (default 15). When a hazard is forecast to start between **0.5 and 3 hours** from now, it sends one notification per event (duplicates are prevented by a unique key in the `alerts` table). With a 15-minute check interval, most alerts arrive roughly 2.5–3 hours ahead.

| Hazard | Rule |
| --- | --- |
| Heavy rainfall | ≥ 7.5 mm in one hour (and ≥ 50% probability) |
| Thunderstorm | Weather code 95 / 96 / 99 |
| Strong wind | Wind ≥ 40 km/h or gusts ≥ 60 km/h |
| Extreme heat | ≥ 40 °C |
| Frost / extreme cold | ≤ 2 °C |

Alerts are **never** sent from demo data.

---

## Live data and demo data

All weather comes from the free [Open-Meteo](https://open-meteo.com) API (no API key needed). Responses are cached in SQLite for 30 minutes.

If Open-Meteo cannot be reached, the API uses the last cached forecast (up to 24 hours old). If none exists, it generates **demo data**. Every page then shows a yellow banner labelled **“DEMO DATA – live weather is unavailable”**, and every API response includes `"is_demo": true`.

---

## How the recommendations work

**Irrigation** (`logic.irrigation_advice`)
- Each crop has a stress threshold (e.g. maize 40%, rice 60%) and a crop coefficient (Kc).
- Crop water use over 3 days = forecast reference evapotranspiration (ET0) × Kc.
- Effective rain = rain in next 48 h × soil efficiency × probability.
- Decision: above target → *No irrigation*; heavy rain likely → *Wait for rain*; below threshold → *Irrigate now*; otherwise → *Light irrigation*.
- Water amount (mm = litres per m²) = moisture deficit + crop water use − effective rain.

**Drought** (`logic.drought_assessment`) – a points score (0–10):
- 30-day rain ÷ evapotranspiration (0–3 points)
- consecutive dry days (0–3 points)
- next 7 days rainfall (0–2 points)
- soil moisture (0–2 points)

0–2 = **Low**, 3–4 = **Moderate**, 5–7 = **High**, 8+ = **Severe**.

---

## API reference

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET / PUT | `/api/profile` | Read / update the farmer profile |
| GET | `/api/options` | Crop and soil lists |
| GET | `/api/geocode?q=` | Location search |
| GET | `/api/dashboard` | Combined summary |
| GET | `/api/rainfall` | 7-day rainfall forecast |
| GET | `/api/irrigation?crop=&soil=&moisture=&save=1` | Irrigation recommendation (`save=1` stores it) |
| GET | `/api/irrigation/history` | Last 10 irrigation checks |
| GET | `/api/drought` | Drought level and factors |
| GET | `/api/alerts` | Upcoming hazards and sent alerts |
| POST | `/api/alerts/check` | Run the alert check now |
| GET | `/api/push/public-key` | VAPID public key |
| POST | `/api/push/subscribe` / `/api/push/unsubscribe` | Manage push subscriptions |
| POST | `/api/push/test` | Send a test notification |

---

## Configuration (optional environment variables)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | Flask port |
| `DATABASE_PATH` | `backend/instance/agriclimate.db` | SQLite file |
| `ALERT_CHECK_MINUTES` | `15` | How often the alert checker runs |
| `VAPID_SUBJECT` | `mailto:admin@agriclimate.local` | Contact for push services – set your own email |
| `VAPID_PRIVATE_KEY_FILE` | `backend/instance/vapid_private.pem` | Use an existing VAPID key |
| `DISABLE_SCHEDULER` | – | Set to `1` to turn off background checks |
| `CORS_ORIGINS` | `*` | Allowed origins for the API |
| `API_URL` (frontend) | `http://127.0.0.1:5000` | Where Vite proxies `/api` |

Keep `backend/instance/` private and backed up: if the VAPID key changes, existing devices must re-enable notifications.

---

## Production

```bash
npm run build                 # builds the React app into dist/
cd backend && python app.py   # Flask serves dist/ and the API on port 5000
```

Put Flask behind an HTTPS reverse proxy (e.g. Nginx or Caddy) so push notifications work on phones. For heavier traffic, run with a WSGI server using a single worker so only one alert scheduler runs, for example `gunicorn -w 1 --threads 8 -b 0.0.0.0:5000 app:app` (from the `backend/` folder).

---

Weather data © [Open-Meteo](https://open-meteo.com) (CC BY 4.0). Recommendations are guidance only. Always combine them with local knowledge and advice from your agriculture extension office.
