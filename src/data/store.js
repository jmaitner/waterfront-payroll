// ---------------------------------------------------------------------------
// DATA LAYER — single source of truth for the app.
//
// Everything that reads or writes shifts/workers/jobs/settings goes through
// this module. Today it is backed by localStorage. In Phase 2 the same function
// signatures get re-pointed at the Cloudflare Workers + D1 API and the UI does
// not change. THIS is the swap point — keep it the only file that knows where
// data lives.
// ---------------------------------------------------------------------------

import { SEED_WORKERS, SEED_JOBS, SEED_SETTINGS } from './seed.js'
import { distanceMiles } from './geo.js'

const STORAGE_KEY = 'waterfront.timeclock.v1'

// --- persistence -----------------------------------------------------------

function freshState() {
  return {
    workers: SEED_WORKERS,
    jobs: SEED_JOBS,
    shifts: [],
    settings: { ...SEED_SETTINGS },
    actingUserId: SEED_WORKERS.find((w) => w.role === 'crew')?.id || SEED_WORKERS[0].id,
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshState()
    const parsed = JSON.parse(raw)
    // Merge in case the seed shape grew since the data was saved.
    return { ...freshState(), ...parsed, settings: { ...SEED_SETTINGS, ...parsed.settings } }
  } catch {
    return freshState()
  }
}

let state = load()
const listeners = new Set()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* demo: ignore quota / private-mode errors */
  }
}

function commit(next) {
  state = next
  persist()
  listeners.forEach((l) => l())
}

// --- React glue (useSyncExternalStore) -------------------------------------

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function getSnapshot() {
  return state
}

let _seq = 0
function uid(prefix) {
  _seq += 1
  return `${prefix}_${Date.now().toString(36)}_${_seq}`
}

// --- reads -----------------------------------------------------------------

export function getWorkers() {
  return state.workers
}
export function getJobs() {
  return state.jobs
}
export function getActiveJobs() {
  return state.jobs.filter((j) => j.active !== false)
}
export function getShifts() {
  return state.shifts
}
export function getSettings() {
  return state.settings
}
export function getActingUserId() {
  return state.actingUserId
}
export function getActingUser() {
  return state.workers.find((w) => w.id === state.actingUserId) || null
}
export function getOpenShift(workerId) {
  return state.shifts.find((s) => s.workerId === workerId && !s.clockOut)
}
export function getOpenShifts() {
  return state.shifts.filter((s) => !s.clockOut)
}

// --- flag computation ------------------------------------------------------

// Build the flag (if any) for a single punch given captured location + job.
function punchFlag({ capture, job, radiusMiles, at }) {
  if (!capture?.ok || !capture.coords) {
    return { type: 'nogps', at, label: `No GPS on clock ${at}` }
  }
  if (job?.lat == null) return null
  const dist = distanceMiles(capture.coords, { lat: job.lat, lng: job.lng })
  if (dist != null && dist > radiusMiles) {
    return {
      type: 'geofence',
      at,
      distance: dist,
      label: `Clocked ${at} ${dist.toFixed(dist >= 10 ? 0 : 1)} mi from site`,
    }
  }
  return null
}

// --- writes (worker flow) --------------------------------------------------

export function setActingUser(workerId) {
  commit({ ...state, actingUserId: workerId })
}

// Clock in. `capture` is the result of geo.captureLocation(). Never rejects.
export function clockIn(workerId, jobId, capture) {
  if (getOpenShift(workerId)) return getOpenShift(workerId) // already on the clock
  const job = state.jobs.find((j) => j.id === jobId)
  const radius = state.settings.geofenceRadiusMiles
  const flag = punchFlag({ capture, job, radiusMiles: radius, at: 'in' })
  const shift = {
    id: uid('s'),
    workerId,
    jobId,
    clockIn: {
      ts: new Date().toISOString(),
      lat: capture?.coords?.lat ?? null,
      lng: capture?.coords?.lng ?? null,
      accuracy: capture?.coords?.accuracy ?? null,
      gps: !!capture?.ok,
    },
    clockOut: null,
    flags: flag ? [flag] : [],
    edits: [],
  }
  commit({ ...state, shifts: [...state.shifts, shift] })
  return shift
}

export function clockOut(workerId, capture) {
  const open = getOpenShift(workerId)
  if (!open) return null
  const job = state.jobs.find((j) => j.id === open.jobId)
  const radius = state.settings.geofenceRadiusMiles
  const flag = punchFlag({ capture, job, radiusMiles: radius, at: 'out' })
  const updated = {
    ...open,
    clockOut: {
      ts: new Date().toISOString(),
      lat: capture?.coords?.lat ?? null,
      lng: capture?.coords?.lng ?? null,
      accuracy: capture?.coords?.accuracy ?? null,
      gps: !!capture?.ok,
    },
    flags: flag ? [...open.flags, flag] : open.flags,
  }
  commit({ ...state, shifts: state.shifts.map((s) => (s.id === open.id ? updated : s)) })
  return updated
}

// --- writes (admin) --------------------------------------------------------

// Admin edits a punch time. Records an entry in the edit log for defensibility.
export function editShiftTime(shiftId, field /* 'clockIn'|'clockOut' */, newTs, by) {
  const shift = state.shifts.find((s) => s.id === shiftId)
  if (!shift) return
  const oldTs = shift[field]?.ts || null
  if (oldTs === newTs) return
  const edit = {
    id: uid('e'),
    field,
    oldTs,
    newTs,
    by: by || state.settings.adminName,
    at: new Date().toISOString(),
  }
  const base = shift[field] || { gps: false, lat: null, lng: null, accuracy: null }
  const updated = {
    ...shift,
    [field]: { ...base, ts: newTs, editedBy: edit.by },
    edits: [...shift.edits, edit],
  }
  commit({ ...state, shifts: state.shifts.map((s) => (s.id === shiftId ? updated : s)) })
}

export function deleteShift(shiftId) {
  commit({ ...state, shifts: state.shifts.filter((s) => s.id !== shiftId) })
}

export function updateSettings(patch) {
  commit({ ...state, settings: { ...state.settings, ...patch } })
}

export function updateJob(jobId, patch) {
  commit({ ...state, jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, ...patch } : j)) })
}

export function addJob({ name, address }) {
  const job = { id: uid('j'), name, address: address || '', lat: null, lng: null, active: true }
  commit({ ...state, jobs: [...state.jobs, job] })
  return job
}

// Demo convenience: wipe everything back to seed.
export function resetDemo() {
  commit(freshState())
}
