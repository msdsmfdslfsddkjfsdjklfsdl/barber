# Barber 16 — Booking site (standalone)

The customer-facing **booking site**: choose a barber, pick services (with
add-ons), pick a time, confirm — then watch your place in the **live queue**.
Charcoal + brass theme, French + Arabic (RTL) with a language toggle.

Self-contained — no build step, no CDN. React + Babel are vendored in `vendor/`,
the UI lives in `src/`. Just serve the folder over HTTP:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

This folder is **independent of the barber app** — copy it into its own repo and
it runs as-is.

## Files
```
index.html             # entry — renders the booking flow (with a FR/AR toggle)
src/data.jsx           # design tokens, bilingual strings, sample data
src/ui.jsx             # shared UI primitives
src/customer-flow.jsx  # the 5-step booking flow
src/queue-tracker.jsx  # the live queue page
vendor/                # React + Babel (no CDN at runtime)
manifest.webmanifest, sw.js, icon-192.png, icon-512.png   # PWA
```

> **Note on the live link:** "a booking appears instantly in the barber app" only
> works while both surfaces run together (shared state). As separate apps they
> don't share data unless you add a backend (or, on the *same device/browser*, a
> `localStorage` + `BroadcastChannel` bridge).
