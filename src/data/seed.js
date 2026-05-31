// Seed data so the app looks real the moment it opens.
// West Michigan deck / seawall / dock crew + active jobs.

export const SEED_WORKERS = [
  { id: 'w_mike', name: 'Mike V.', role: 'admin', active: true }, // owner / foreman
  { id: 'w_bob', name: 'Bob Tisdale', role: 'crew', active: true },
  { id: 'w_carlos', name: 'Carlos Mendez', role: 'crew', active: true },
  { id: 'w_tyler', name: 'Tyler Brinks', role: 'crew', active: true },
  { id: 'w_jake', name: 'Jake Roelofs', role: 'crew', active: true },
]

// Real West Michigan coordinates so the geofence is meaningful.
// During the pitch, use "Set to my location" on one job for a clean punch,
// and leave another far away so the out-of-range flag fires.
export const SEED_JOBS = [
  {
    id: 'j_springlake',
    name: 'Lakeshore Dr. Deck',
    address: 'Spring Lake, MI',
    lat: 43.0775,
    lng: -86.1956,
    active: true,
  },
  {
    id: 'j_grandhaven',
    name: 'Seawall Repair',
    address: 'Grand Haven, MI',
    lat: 43.0631,
    lng: -86.2284,
    active: true,
  },
  {
    id: 'j_channel',
    name: 'Dock Build — Channel',
    address: 'Spring Lake Channel, MI',
    lat: 43.082,
    lng: -86.205,
    active: true,
  },
]

export const SEED_SETTINGS = {
  payPeriod: 'biweekly', // 'weekly' | 'biweekly'
  // Anchor for pay-period math. A recent Monday at local midnight.
  payPeriodStart: anchorMonday(),
  rounding: 'none', // 'none' | '15' (nearest 15 minutes)
  geofenceRadiusMiles: 0.25,
  forgotClockOutHours: 12, // open shift past this long = "likely forgot to clock out"
  adminName: 'Mike V.',
}

// Most recent Monday on/before today, as a local-midnight ISO date string.
function anchorMonday() {
  const now = new Date()
  const day = now.getDay() // 0 Sun ... 1 Mon
  const diff = (day + 6) % 7 // days since Monday
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
  return monday.toISOString()
}
