# Fade City — Barber app (standalone)

The installable barber dashboard — **"Fast mode"** for rush hours: the client in
the chair with one-tap **finish + cash**, the live queue (start any client in one
tap), walk-ins, and today's takings. Charcoal + brass theme, glassmorphism,
French + Arabic (RTL).

Self-contained — no build step, no CDN. React + Babel are vendored in `vendor/`,
the UI lives in `src/`. Just serve the folder over HTTP:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Installable as a **PWA** (iOS Safari → Share → *Add to Home Screen*; Android →
*Install app*). Works offline after the first load.

This folder is **independent of the booking site** — copy it into its own repo
and it runs as-is.

## Files
```
index.html            # entry — loads React/Babel + src, renders <BarberFast/>
src/data.jsx          # design tokens, bilingual strings, sample data
src/ui.jsx            # shared UI primitives
src/helpers.jsx       # serviceLabel + resolveBarber
src/barber-fast.jsx   # the barber command screen
vendor/               # React + Babel (no CDN at runtime)
manifest.webmanifest, sw.js, icon-192.png, icon-512.png   # PWA
```
