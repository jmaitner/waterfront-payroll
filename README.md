# Crew Clock — Crew Time Clock + Payroll (MVP)

Tap-to-clock phone app that captures crew hours **automatically**, GPS-stamps
each punch, flags out-of-range clock-ins, and exports a **payroll-ready sheet** —
so the owner stops doing the math by hand and stops paying for time nobody worked.

This is a single-device demo: all data lives in the browser (`localStorage`) and
the crew is simulated with an "Acting as" switcher. No backend, nothing to break.

## Run it

```bash
npm install
npm run dev          # → http://localhost:5173
```

Build for Cloudflare Pages:

```bash
npm run build        # static output → dist/
npm run preview      # preview the production build locally
```

## Deploy to Cloudflare

Deploys as a **static-assets Worker**. The build command is `npm run build`
(output `dist/`), and [`wrangler.jsonc`](wrangler.jsonc) serves `dist/` with
`single-page-application` not-found handling, so client routes fall back to
`index.html` — no `_redirects` file needed.

`npx wrangler deploy` (the configured deploy command) picks this up automatically.

> Deploying to Cloudflare **Pages** instead? Use build command `npm run build`,
> output dir `dist`, and add a `public/_redirects` containing `/*  /index.html  200`.
> (Don't ship that file on the Workers path — its rule is rejected there.)

## The 90-second demo

1. Top-left toggle stays on **Crew**. Use **Acting as** to become *Bob Tisdale*.
2. Tap the big green **Clock In** → pick a job → it stamps the time + GPS.
3. Switch **Acting as** to two more crew, clock them in on different jobs.
   - Allow location when the browser asks, so the GPS stamp is real.
4. Flip to **Admin → Roster**: watch all three running live.
5. Clock someone out (Crew view). If they're outside the job's geofence you'll
   see a **⚑ "clocked out X mi from site"** flag appear.
6. **Admin → Timesheet**: per-worker / per-day / per-job totals, flagged entries,
   and the edit log. Tap **Export CSV** or **Print / PDF** for the accountant.

### Making the geofence flag fire on cue

In **Admin → Jobs**, tap **Use my location** on one job so punches there are
"on site" (clean). Leave another job at its seeded West-Michigan coordinates so a
punch from anywhere else trips the flag. The radius is set in **Settings**
(default 0.25 mi).

## Settings that persist

- **Pay period:** weekly / biweekly (default biweekly)
- **Rounding rule:** none / nearest 15 minutes (default none)
- **Geofence radius**, **admin name** (stamped on edits)

## Architecture / Phase 2

All reads and writes go through one module — [`src/data/store.js`](src/data/store.js).
Today it's backed by `localStorage`. The Phase-2 multi-device version keeps the
same function signatures and re-points them at a **Cloudflare Workers + D1** API
with per-worker PIN login — **without touching the UI**. That swap point is the
only file that knows where data lives.

Out of scope for this demo (scaffolded for, not built): real multi-device sync,
PIN auth, breaks/lunch, overtime rules, job costing.
