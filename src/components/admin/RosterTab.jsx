import { useEffect, useState } from 'react'
import { formatDuration, formatTime, formatDate } from '../../data/payroll.js'
import { isForgottenClockOut, editShiftTime, resolveRequest } from '../../data/store.js'

// Live "who's on the clock right now" board.
export default function RosterTab({ state }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const open = state.shifts.filter((s) => !s.clockOut)
  const worker = (id) => state.workers.find((w) => w.id === id)?.name || '—'
  const job = (id) => state.jobs.find((j) => j.id === id)?.name || '—'
  const forgot = open.filter((s) => isForgottenClockOut(s))
  const pending = (state.requests || []).filter((r) => r.status === 'pending')

  return (
    <div className="flex flex-col gap-4">
      {pending.length > 0 && (
        <ApprovalQueue requests={pending} state={state} worker={worker} job={job} />
      )}

      {open.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="text-3xl">🌙</div>
          <div className="mt-2 font-bold text-navy">Nobody on the clock</div>
          <div className="mt-1 text-sm text-slate-500">
            Switch to the Crew view (top right) and clock someone in.
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold uppercase tracking-wide text-slate-500">
              On the clock — {open.length}
            </div>
            {forgot.length > 0 && (
              <div className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                ⚠ {forgot.length} likely forgot to clock out
              </div>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {open.map((s) => (
              <RosterCard key={s.id} shift={s} workerName={worker(s.workerId)} jobName={job(s.jobId)} settings={state.settings} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Worker-submitted clock-out corrections awaiting the foreman's call.
function ApprovalQueue({ requests, state, worker, job }) {
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <div className="text-sm font-extrabold uppercase tracking-wide text-amber-800">
        ⏳ {requests.length} clock-out request{requests.length !== 1 ? 's' : ''} to review
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {requests.map((r) => {
          const shift = state.shifts.find((s) => s.id === r.shiftId)
          return (
            <RequestRow
              key={r.id}
              request={r}
              shift={shift}
              workerName={worker(r.workerId)}
              jobName={shift ? job(shift.jobId) : '—'}
              adminName={state.settings.adminName}
            />
          )
        })}
      </div>
    </div>
  )
}

function RequestRow({ request, shift, workerName, jobName, adminName }) {
  const [overriding, setOverriding] = useState(false)
  const [val, setVal] = useState(toLocalInput(request.requestedTs))
  if (!shift) return null
  const hours = shift.clockIn?.ts
    ? ((new Date(request.requestedTs) - new Date(shift.clockIn.ts)) / 3600000).toFixed(2)
    : '—'

  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-base font-extrabold text-navy">{workerName}</div>
          <div className="text-xs text-slate-500">{jobName}</div>
          <div className="mt-1 text-xs text-slate-600">
            In {formatTime(shift.clockIn.ts)} ({formatDate(shift.clockIn.ts)}) → requests out{' '}
            <span className="font-bold text-navy">{formatTime(request.requestedTs)}</span> · ~{hours} hrs
          </div>
        </div>
      </div>

      {overriding ? (
        <div className="mt-2 rounded-lg bg-slate-50 p-2">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Override clock-out time</div>
          <input type="datetime-local" value={val} min={toLocalInput(shift.clockIn.ts)} onChange={(e) => setVal(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => resolveRequest(request.id, 'approve', new Date(val).toISOString(), adminName)}
              className="flex-1 rounded-lg bg-navy py-2 text-sm font-bold text-white"
            >
              Approve at this time
            </button>
            <button onClick={() => setOverriding(false)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <button onClick={() => resolveRequest(request.id, 'approve', null, adminName)} className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-bold text-white active:scale-[0.98]">
            Approve
          </button>
          <button onClick={() => setOverriding(true)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
            Override
          </button>
          <button onClick={() => resolveRequest(request.id, 'decline', null, adminName)} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600">
            Decline
          </button>
        </div>
      )}
    </div>
  )
}

function RosterCard({ shift, workerName, jobName, settings }) {
  const elapsed = Date.now() - new Date(shift.clockIn.ts).getTime()
  const flagged = (shift.flags || []).length > 0
  const forgot = isForgottenClockOut(shift)
  const [resolving, setResolving] = useState(false)

  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ${forgot ? 'ring-2 ring-red-400' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-extrabold text-navy">{workerName}</div>
          <div className="text-sm text-slate-500">{jobName}</div>
          <div className="mt-1 text-xs text-slate-400">
            In at {formatTime(shift.clockIn.ts)} ·{' '}
            {shift.clockIn.gps ? (
              <span className="text-wave">📍 GPS stamped</span>
            ) : (
              <span className="text-amber-600">no GPS</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xl font-extrabold tabular-nums text-green-600">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
          {formatDuration(elapsed)}
        </div>
      </div>

      {flagged && (
        <div className="mt-2 rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
          ⚑ {shift.flags.map((f) => f.label).join(' · ')}
        </div>
      )}

      {forgot && !resolving && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-2 py-1.5">
          <span className="text-xs font-semibold text-red-700">
            ⚠ On the clock {Math.floor(elapsed / 3600000)}h — likely forgot to clock out
          </span>
          <button
            onClick={() => setResolving(true)}
            className="shrink-0 rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white"
          >
            Fix
          </button>
        </div>
      )}

      {resolving && <ResolveClockOut shift={shift} settings={settings} onDone={() => setResolving(false)} />}
    </div>
  )
}

function toLocalInput(iso) {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Inline fix for a forgotten clock-out: set the real end time; it's logged.
function ResolveClockOut({ shift, settings, onDone }) {
  const [val, setVal] = useState(toLocalInput(new Date().toISOString()))
  return (
    <div className="mt-2 rounded-lg bg-slate-50 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Set clock-out time (logged)</div>
      <input
        type="datetime-local"
        value={val}
        min={toLocalInput(shift.clockIn.ts)}
        onChange={(e) => setVal(e.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => {
            if (val) editShiftTime(shift.id, 'clockOut', new Date(val).toISOString(), settings.adminName)
            onDone()
          }}
          className="flex-1 rounded-lg bg-navy py-2 text-sm font-bold text-white"
        >
          Save clock-out
        </button>
        <button onClick={onDone} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
          Cancel
        </button>
      </div>
    </div>
  )
}
