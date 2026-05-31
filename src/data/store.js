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
    requests: [], // worker-submitted corrections awaiting admin approval
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
export function getActiveWorkers() {
  return state.workers.filter((w) => w.active !== false)
}
export function getRequests() {
  return state.requests || []
}
export function getPendingRequests() {
  return (state.requests || []).filter((r) => r.status === 'pending')
}
export function getPendingRequestForShift(shiftId) {
  return (state.requests || []).find((r) => r.shiftId === shiftId && r.status === 'pending') || null
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

// Admin adds an entry from scratch — for a worker who forgot to clock in at all.
// Marked as manual + seeded with a "created" edit-log entry so it's never
// mistaken for an auto-captured punch. clockOutTs may be null (still open).
export function addManualShift({ workerId, jobId, clockInTs, clockOutTs, by }) {
  if (!workerId || !jobId || !clockInTs) return null
  const stamp = (ts) =>
    ts ? { ts, lat: null, lng: null, accuracy: null, gps: false, manual: true } : null
  const author = by || state.settings.adminName
  const shift = {
    id: uid('s'),
    workerId,
    jobId,
    source: 'manual',
    clockIn: stamp(clockInTs),
    clockOut: stamp(clockOutTs),
    flags: [{ type: 'manual', at: 'in', label: 'Added manually by admin' }],
    edits: [
      {
        id: uid('e'),
        field: 'created',
        oldTs: null,
        newTs: clockInTs,
        by: author,
        at: new Date().toISOString(),
      },
    ],
  }
  commit({ ...state, shifts: [...state.shifts, shift] })
  return shift
}

// True when an open shift has run long enough that the worker likely just
// forgot to clock out. Threshold is an admin setting (hours).
export function isForgottenClockOut(shift, now = Date.now()) {
  if (!shift || shift.clockOut || !shift.clockIn?.ts) return false
  const hours = (now - new Date(shift.clockIn.ts)) / 3600000
  return hours >= (state.settings.forgotClockOutHours || 12)
}

// Admin fixes a wrong job/site pick on an entry. Logged like a time edit, and
// because the timesheet groups live by jobId, per-job totals + the CSV update
// automatically the moment this commits.
export function editShiftJob(shiftId, newJobId, by) {
  const shift = state.shifts.find((s) => s.id === shiftId)
  if (!shift || shift.jobId === newJobId) return
  const name = (id) => state.jobs.find((j) => j.id === id)?.name || '—'
  const edit = {
    id: uid('e'),
    field: 'job',
    oldLabel: name(shift.jobId),
    newLabel: name(newJobId),
    by: by || state.settings.adminName,
    at: new Date().toISOString(),
  }
  const updated = { ...shift, jobId: newJobId, edits: [...shift.edits, edit] }
  commit({ ...state, shifts: state.shifts.map((s) => (s.id === shiftId ? updated : s)) })
}

// --- worker-submitted corrections (approval queue) -------------------------

// Worker who forgot to clock out submits the end time they actually left. This
// does NOT change the timesheet — it queues a request for the admin to approve.
export function requestClockOut(shiftId, requestedTs, note) {
  const shift = state.shifts.find((s) => s.id === shiftId)
  if (!shift || shift.clockOut) return null
  // replace any existing pending request for this shift
  const others = (state.requests || []).filter((r) => !(r.shiftId === shiftId && r.status === 'pending'))
  const request = {
    id: uid('r'),
    type: 'clockout',
    shiftId,
    workerId: shift.workerId,
    requestedTs,
    note: note || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  commit({ ...state, requests: [...others, request] })
  return request
}

// Admin approves (optionally overriding the time), or declines. Approving
// applies the clock-out through the normal edit log so it stays defensible.
export function resolveRequest(requestId, action /* 'approve'|'decline' */, overrideTs, by) {
  const request = (state.requests || []).find((r) => r.id === requestId)
  if (!request || request.status !== 'pending') return
  const author = by || state.settings.adminName
  const resolvedAt = new Date().toISOString()

  if (action === 'decline') {
    const requests = state.requests.map((r) =>
      r.id === requestId ? { ...r, status: 'declined', resolvedBy: author, resolvedAt } : r,
    )
    commit({ ...state, requests })
    return
  }

  // approve (with optional admin override of the time)
  const finalTs = overrideTs || request.requestedTs
  const overridden = !!overrideTs && overrideTs !== request.requestedTs
  let shifts = state.shifts
  const shift = state.shifts.find((s) => s.id === request.shiftId)
  if (shift && !shift.clockOut) {
    const edit = {
      id: uid('e'),
      field: 'clockOut',
      oldTs: null,
      newTs: finalTs,
      by: author,
      at: resolvedAt,
      note: overridden ? 'approved worker request (time overridden)' : 'approved worker clock-out request',
    }
    const updated = {
      ...shift,
      clockOut: { ts: finalTs, lat: null, lng: null, accuracy: null, gps: false, manual: true },
      edits: [...shift.edits, edit],
    }
    shifts = state.shifts.map((s) => (s.id === shift.id ? updated : s))
  }
  const requests = state.requests.map((r) =>
    r.id === requestId ? { ...r, status: 'approved', resolvedBy: author, resolvedAt, finalTs, overridden } : r,
  )
  commit({ ...state, shifts, requests })
}

// --- crew management -------------------------------------------------------

export function addWorker({ name, role }) {
  const worker = { id: uid('w'), name: name.trim(), role: role === 'admin' ? 'admin' : 'crew', active: true }
  commit({ ...state, workers: [...state.workers, worker] })
  return worker
}

export function setWorkerActive(workerId, active) {
  commit({
    ...state,
    workers: state.workers.map((w) => (w.id === workerId ? { ...w, active } : w)),
  })
}

// Hard-delete only when the worker has no recorded shifts; otherwise callers
// should deactivate to preserve historical timesheets.
export function deleteWorker(workerId) {
  if (state.shifts.some((s) => s.workerId === workerId)) return false
  const workers = state.workers.filter((w) => w.id !== workerId)
  const actingUserId =
    state.actingUserId === workerId ? workers.find((w) => w.active !== false)?.id || workers[0]?.id : state.actingUserId
  commit({ ...state, workers, actingUserId })
  return true
}

export function workerHasShifts(workerId) {
  return state.shifts.some((s) => s.workerId === workerId)
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
