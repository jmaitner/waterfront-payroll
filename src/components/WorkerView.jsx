import { useEffect, useState } from 'react'
import { useStore } from '../data/useStore.js'
import { clockIn, clockOut, requestClockOut } from '../data/store.js'
import { captureLocation } from '../data/geo.js'
import { formatDuration, formatTime } from '../data/payroll.js'

export default function WorkerView({ acting }) {
  const state = useStore()
  const open = acting ? state.shifts.find((s) => s.workerId === acting.id && !s.clockOut) : null

  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(null) // 'locating' | null
  const [lastResult, setLastResult] = useState(null) // summary after clock-out

  const job = open ? state.jobs.find((j) => j.id === open.jobId) : null
  const activeJobs = state.jobs.filter((j) => j.active !== false)
  const pendingReq = open
    ? (state.requests || []).find((r) => r.shiftId === open.id && r.status === 'pending')
    : null

  async function doClockIn(jobId) {
    setPicking(false)
    setBusy('locating')
    const capture = await captureLocation()
    clockIn(acting.id, jobId, capture)
    setBusy(null)
    setLastResult(null)
  }

  async function doClockOut() {
    setBusy('locating')
    const capture = await captureLocation()
    const result = clockOut(acting.id, capture)
    setBusy(null)
    if (result) setLastResult(result)
  }

  if (!acting) {
    return <div className="p-6 text-center text-slate-500">Pick a crew member above to begin.</div>
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Greeting name={acting.name} />

      {open ? (
        <OnClockCard open={open} job={job} busy={busy} onClockOut={doClockOut} pendingReq={pendingReq} />
      ) : (
        <OffClockCard busy={busy} onClockIn={() => setPicking(true)} lastResult={lastResult} jobs={state.jobs} />
      )}

      {picking && (
        <JobSheet jobs={activeJobs} onPick={doClockIn} onCancel={() => setPicking(false)} />
      )}
    </div>
  )
}

function Greeting({ name }) {
  return (
    <div className="pt-1">
      <div className="text-sm text-slate-500">Welcome,</div>
      <div className="text-2xl font-extrabold text-navy">{name}</div>
    </div>
  )
}

// Live-updating running timer while on the clock.
function OnClockCard({ open, job, busy, onClockOut, pendingReq }) {
  const [, tick] = useState(0)
  const [requesting, setRequesting] = useState(false)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const elapsed = Date.now() - new Date(open.clockIn.ts).getTime()

  return (
    <div className="rounded-3xl bg-navy p-5 text-white shadow-lg">
      <div className="flex items-center gap-2 text-wave-300">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-green-400" />
        </span>
        <span className="text-sm font-bold uppercase tracking-wide">On the clock</span>
      </div>

      <div className="mt-4 text-center">
        <div className="font-mono text-5xl font-extrabold tracking-tight tabular-nums">
          {formatDuration(elapsed)}
        </div>
        <div className="mt-2 text-wave-300">
          {job?.name || 'Job'} · since {formatTime(open.clockIn.ts)}
        </div>
        <PunchGps label="Clock-in location" punch={open.clockIn} />
      </div>

      <button
        onClick={onClockOut}
        disabled={busy === 'locating'}
        className="mt-5 w-full rounded-2xl bg-red-500 py-5 text-2xl font-extrabold text-white shadow-md active:scale-[0.98] disabled:opacity-60"
      >
        {busy === 'locating' ? 'Saving…' : 'Clock Out'}
      </button>

      {pendingReq ? (
        <div className="mt-3 rounded-xl bg-amber-400/20 px-3 py-2 text-center text-sm font-semibold text-amber-200">
          ⏳ Sent to your foreman — requested end {formatTime(pendingReq.requestedTs)}. Waiting for approval.
        </div>
      ) : requesting ? (
        <ForgotClockOutForm open={open} onDone={() => setRequesting(false)} />
      ) : (
        <button
          onClick={() => setRequesting(true)}
          className="mt-3 w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold text-wave-300 active:bg-white/20"
        >
          Forgot to clock out earlier? →
        </button>
      )}
    </div>
  )
}

// Worker submits the time they actually left; it goes to the admin to approve.
function ForgotClockOutForm({ open, onDone }) {
  const pad = (n) => String(n).padStart(2, '0')
  const now = new Date()
  const min = (() => {
    const d = new Date(open.clockIn.ts)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })()
  const [val, setVal] = useState(
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
  )
  return (
    <div className="mt-3 rounded-xl bg-white/10 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-wave-300">When did you actually leave?</div>
      <input
        type="datetime-local"
        value={val}
        min={min}
        onChange={(e) => setVal(e.target.value)}
        className="mt-2 w-full rounded-lg bg-white px-2 py-2 text-sm font-bold text-navy"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => {
            if (val) requestClockOut(open.id, new Date(val).toISOString(), 'Forgot to clock out')
            onDone()
          }}
          className="flex-1 rounded-lg bg-wave py-2 text-sm font-bold text-white active:scale-[0.98]"
        >
          Send to foreman
        </button>
        <button onClick={onDone} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-wave-300">
          Cancel
        </button>
      </div>
    </div>
  )
}

function OffClockCard({ busy, onClockIn, lastResult, jobs }) {
  return (
    <div className="flex flex-col gap-4">
      {lastResult && <ClockOutSummary result={lastResult} jobs={jobs} />}

      <div className="rounded-3xl bg-white p-5 shadow-lg">
        <div className="text-center text-sm font-bold uppercase tracking-wide text-slate-400">
          Off the clock
        </div>
        <button
          onClick={onClockIn}
          disabled={busy === 'locating'}
          className="mt-4 flex w-full flex-col items-center justify-center rounded-2xl bg-green-600 py-10 text-3xl font-extrabold text-white shadow-md active:scale-[0.98] disabled:opacity-60"
        >
          {busy === 'locating' ? (
            <span className="text-xl">Getting location…</span>
          ) : (
            <>
              <span>Clock In</span>
              <span className="mt-1 text-sm font-semibold text-green-100">Tap to start your shift</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function ClockOutSummary({ result, jobs }) {
  const job = jobs.find((j) => j.id === result.jobId)
  const ms = new Date(result.clockOut.ts) - new Date(result.clockIn.ts)
  const flagged = (result.flags || []).length > 0
  return (
    <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-4">
      <div className="text-sm font-bold text-green-800">✓ Clocked out — {job?.name}</div>
      <div className="mt-1 text-2xl font-extrabold text-navy">{formatDuration(ms)}</div>
      <div className="text-xs text-slate-500">
        {formatTime(result.clockIn.ts)} → {formatTime(result.clockOut.ts)}
      </div>
      {flagged && (
        <div className="mt-2 rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
          ⚑ {result.flags.map((f) => f.label).join(' · ')}
        </div>
      )}
    </div>
  )
}

function PunchGps({ label, punch }) {
  if (!punch?.gps) {
    return <div className="mt-2 text-xs text-amber-300">⚑ No GPS captured</div>
  }
  return (
    <div className="mt-2 text-xs text-wave-300">
      📍 {label}: {punch.lat.toFixed(4)}, {punch.lng.toFixed(4)}
    </div>
  )
}

// Bottom sheet for picking the active job after tapping Clock In.
function JobSheet({ jobs, onPick, onCancel }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-4 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
        <div className="mb-1 text-center text-lg font-extrabold text-navy">Which job?</div>
        <div className="mb-4 text-center text-sm text-slate-500">Pick the site you're working today</div>
        <div className="flex flex-col gap-3">
          {jobs.map((j) => (
            <button
              key={j.id}
              onClick={() => onPick(j.id)}
              className="flex items-center justify-between rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-4 text-left active:scale-[0.98]"
            >
              <div>
                <div className="text-lg font-bold text-navy">{j.name}</div>
                <div className="text-sm text-slate-500">{j.address || 'No address set'}</div>
              </div>
              <span className="text-2xl text-wave">→</span>
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="mt-4 w-full rounded-xl py-3 font-bold text-slate-500">
          Cancel
        </button>
      </div>
    </div>
  )
}
