# ✂️ Fade City — Booking & Queue

A mobile-first **barbershop booking and live-queue** prototype, built for an
Algerian barbershop ("salon de coiffure"). It covers the whole loop in one
interactive design: a customer books from their phone, the booking lands
instantly in the barber's app, and the customer can watch their place in the
queue in real time.

Fully **bilingual** — French 🇫🇷 and Arabic 🇩🇿 (with proper right-to-left
layout) — and prices are in Algerian dinar (DA / دج).

> **Status:** UI/UX prototype. State is shared between the three surfaces via
> lifted React state (no backend, no SMS) and persisted to `localStorage`, so a
> confirmed booking lands in the barber's queue and survives a page refresh.

---

## 🔗 Live demo

Once GitHub Pages is enabled for this repo (see [Deployment](#-deployment)),
the prototype is published automatically at:

**https://msdsmfdslfsddkjfsdjklfsdl.github.io/barber/**

---

## 📸 Screenshots

Every shot below is captured from the running project — the customer **site**
(web booking + live queue) and the barber **app**.

### Customer site — booking

| 1 · Salon landing | 2 · Choose your barber | 3 · Services + add-ons |
| :---: | :---: | :---: |
| <img src="screenshots/site-1-landing.png" width="240" alt="Salon landing" /> | <img src="screenshots/site-2-choose-barber.png" width="240" alt="Choose your barber" /> | <img src="screenshots/site-3-services.png" width="240" alt="Pick services with add-ons" /> |

| 4 · Your details | 5 · Confirmed |
| :---: | :---: |
| <img src="screenshots/site-4-details.png" width="240" alt="Enter your details" /> | <img src="screenshots/site-5-confirmed.png" width="240" alt="Booking confirmed" /> |

Services stack into one booking — *Coupe adulte + Barbe* totals **450 DA** and
carries through the summary, the confirmation, and the barber's queue.

### Customer site — live queue tracker

| Waiting in line | You're next (live) | Session complete |
| :---: | :---: | :---: |
| <img src="screenshots/site-queue-waiting.png" width="240" alt="Waiting in the queue" /> | <img src="screenshots/site-queue-your-turn.png" width="240" alt="You're next — live notification" /> | <img src="screenshots/site-queue-done.png" width="240" alt="Session complete" /> |

The position moves up on its own and fires a **"C'est bientôt votre tour"**
notification the moment you reach the front.

### Barber app

| French | Arabic (RTL) |
| :---: | :---: |
| <img src="screenshots/app-barber-fr.png" width="260" alt="Barber app — French" /> | <img src="screenshots/app-barber-ar.png" width="260" alt="Barber app — Arabic, RTL" /> |

The barber sees the current client with a live timer, the next-up card, the
waiting queue, and the big workflow actions — fully mirrored in Arabic.

---

## 🧭 The three surfaces

The app is presented as three phone artboards on a design canvas:

1. **Customer · Web booking flow** — a mobile webview at `barberdz.com/fade-city`.
   Five steps from open to confirmation:
   `Salon landing → Pick barber → Pick time + services → Your details → Confirmed`.

2. **Customer · Live queue tracker** — a single page showing the customer's
   position, which **advances on its own** and notifies them when they're next.
   Three states: **people ahead of you**, **you're up next**, and **session complete**.

3. **Barber · Mobile app** — a glanceable dashboard: the current client, today's
   stats, the live queue, completed history, plus the big workflow actions
   (Start / Finish / Skip / Pause) and a walk-in compose sheet.

---

## ✨ Features

- **Lift-state booking** — a confirmed customer booking appears instantly in the
  barber's queue (idempotent by booking code), no backend round-trip.
- **Service add-ons** — stack multiple prestations (e.g. *Coupe + Barbe + Brushing*)
  with a live total in DA and summed duration, carried through to the barber's queue.
- **Living queue tracker** — the customer's position moves up over time, the ETA
  recomputes, and a *"C'est votre tour · حان دورك"* notification fires when they're
  next (plus the three controllable states: waiting / next / done).
- **Offline-ready PWA** — installable (add-to-home-screen, app icon) with a service
  worker that caches the app shell for offline use.
- **Persists across refresh** — bookings and barber profile edits are saved to
  `localStorage`, so the prototype keeps its state between visits.
- **Walk-in compose** — the barber can add a no-booking customer on the fly.
- **Per-row call action** and a collapsible **"Terminés / Completed"** history.
- **Editable barber profiles** — changing a barber's name/specialty/photo in
  Settings reflects on the customer's booking page too.
- **Bilingual FR / AR** with full RTL layout and Arabic typography tuning.
- **Tweaks panel** to flip language, queue position, and booking density
  (sparse vs. busy) live.

### 💈 Service menu

Salon-wide pricing, shown across the booking flow, the confirmation, and the
barber's queue:

| Prestation | الخدمة | Prix | Durée |
| --- | --- | ---: | ---: |
| Coupe adulte | قصة للرجال | 350 DA | 30 min |
| Coupe enfant | قصة طفل | 200 DA | 20 min |
| Barbe | لحية | 100 DA | 10 min |
| Brushing | بروشينغ | 350 DA | 25 min |
| Coupe + barbe | قصة + لحية | 450 DA | 40 min |
| Protéine + coupe + brushing | بروتين + قصة + بروشينغ | 1 500 DA | 75 min |

### 💇 Barbers

| Barber | Specialty |
| --- | --- |
| Karim Belkacem | Fade & dégradé |
| Sofiane Hamidi | Barbe & rasage |
| Yacine Touati | Coupe moderne |
| Mehdi Ouazani | Coupe classique |

---

## 🛠 Tech stack

- **React 18** — vendored locally in `vendor/` (no bundler, no CDN dependency).
- **Babel Standalone** — transpiles the JSX in the browser, so there is **no
  build step**.
- Plain CSS + design tokens (dark "Fade City" theme: slate background, green
  primary).
- Google Fonts: Inter, Cairo, Geist Mono, IBM Plex Sans Arabic.
- **PWA** — a web manifest + service worker make it installable and offline-capable.
- **localStorage** — persists bookings and barber profile edits (no backend).

This keeps the prototype trivially portable — it's just static files.

---

## ▶️ Running locally

Because the JSX files are loaded via `<script src>` and the app uses `fetch()`,
you need to serve the folder over HTTP (opening `index.html` directly with
`file://` will be blocked by the browser).

Any static server works — for example:

```bash
# Python 3 (built-in)
python3 -m http.server 8000

# …or Node
npx serve .
```

Then open <http://localhost:8000>.

---

## 🚀 Deployment

This repo ships a GitHub Actions workflow
([`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml))
that publishes the site to **GitHub Pages** on every push to `main` (and to the
current working branch). Because the project is already static, the workflow
just packages the files and deploys them — no build.

**One-time setup:** the workflow uses `actions/configure-pages` with
`enablement: true`, which tries to turn Pages on automatically on the first run.
If your org/repo blocks programmatic enablement, enable it manually once:

> **Settings → Pages → Build and deployment → Source: _GitHub Actions_**

After the workflow's first successful run, the live URL appears in the Actions
run summary (and under the repo's **Environments → github-pages**).

---

## 📁 Project structure

```
.
├── index.html              # Entry point — loads React, Babel, then the JSX files
├── manifest.webmanifest    # PWA manifest (installable, standalone)
├── sw.js                   # Service worker (offline app shell)
├── icon-192.png            # PWA app icons
├── icon-512.png
├── vendor/                 # React + Babel (vendored — no CDN at runtime)
├── src/
│   ├── data.jsx            # Design tokens, bilingual strings (FR/AR), sample data
│   ├── ui.jsx              # Shared UI primitives (icons, buttons, etc.)
│   ├── customer-flow.jsx   # Customer booking flow (5 steps)
│   ├── queue-tracker.jsx   # Live queue position page (3 states)
│   ├── barber-app.jsx      # Barber's mobile dashboard
│   └── app.jsx             # Composition: 3 artboards + Tweaks panel
├── design-canvas.jsx       # Design-canvas scaffold (sections / artboards)
├── ios-frame.jsx           # iOS device frame wrapper
├── tweaks-panel.jsx        # Live "Tweaks" control panel
├── screenshots/            # App & site screenshots (used in this README)
└── .github/workflows/      # GitHub Pages deploy workflow
```

> **Note:** `design-canvas.jsx`, `ios-frame.jsx`, and `tweaks-panel.jsx` are the
> presentation scaffold that arranges the three phone artboards side by side and
> exposes the live Tweaks. The actual product UI lives in `src/`.
