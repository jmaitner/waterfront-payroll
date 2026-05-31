import { useState } from 'react'
import { formatDate, formatTime } from '../../data/payroll.js'
import PunchLocation from '../PunchLocation.jsx'

// A single chronological audit trail of everything that happened: every
// clock-in / clock-out (with its GPS location), manual additions, admin time/
// job edits, and worker correction requests + their approvals. This is the
// defensible "where was everyone, and who changed what" record.
export default function LogTab({ state }) {
  const [workerFilter, setWorkerFilter] = useState('all')
  const events = buildActivity(state).filter(
    (e) => workerFilter === 'all' || e.workerId === workerFilter,
  )

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Activity log — {events.length} event{events.length !== 1 ? 's' : ''}
        </div>
        <select
          value={workerFilter}
          onChange={(e) => setWorkerFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-navy"
        >
          <option value="all">All crew</option>
          {state.workers.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No activity yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {events.map((e, i) => (
            <LogRow key={e.id} event={e} first={i === 0} />
          ))}
        </div>
      )}
    </div>
  )
}

const KIND = {
  in: { label: 'Clock in', cls: 'bg-green-100 text-green-700' },
  out: { label: 'Clock out', cls: 'bg-red-100 text-red-700' },
  edit: { label: 'Edit', cls: 'bg-slate-200 text-slate-700' },
  created: { label: 'Manual add', cls: 'bg-wave/20 text-wave-500' },
  request: { label: 'Request', cls: 'bg-amber-100 text-amber-700' },
  resolution: { label: 'Resolved', cls: 'bg-navy text-white' },
}

function LogRow({ event, first }) {
  const k = KIND[event.kind] || KIND.edit
  return (
    <div className={`flex gap-3 px-4 py-3 ${first ? '' : 'border-t border-slate-100'}`}>
      <div className="w-24 shrink-0 text-xs text-slate-400">
        <div className="font-bold text-slate-600">{formatTime(event.at)}</div>
        <div>{formatDate(event.at)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${k.cls}`}>
            {k.label}
          </span>
          <span className="font-bold text-navy">{event.worker}</span>
          {event.job && <span className="text-sm text-slate-500">· {event.job}</span>}
        </div>
        {event.detail && <div className="mt-0.5 text-xs text-slate-500">{event.detail}</div>}
        {event.punch && (
          <div className="mt-1">
            <PunchLocation label="Location" punch={event.punch} />
          </div>
        )}
      </div>
    </div>
  )
}

// --- event derivation ------------------------------------------------------

function buildActivity(state) {
  const workerName = (id) => state.workers.find((w) => w.id === id)?.name || '—'
  const jobName = (id) => state.jobs.find((j) => j.id === id)?.name || '—'
  const events = []

  for (const s of state.shifts) {
    const worker = workerName(s.workerId)
    const job = jobName(s.jobId)
    if (s.clockIn?.ts) {
      events.push({
        id: `${s.id}-in`,
        at: s.clockIn.ts,
        kind: 'in',
        workerId: s.workerId,
        worker,
        job,
        punch: s.clockIn,
        detail: (s.flags || []).map((f) => f.label).join(' · ') || null,
      })
    }
    if (s.clockOut?.ts) {
      events.push({
        id: `${s.id}-out`,
        at: s.clockOut.ts,
        kind: 'out',
        workerId: s.workerId,
        worker,
        job,
        punch: s.clockOut,
      })
    }
    for (const e of s.edits || []) {
      events.push({
        id: e.id,
        at: e.at,
        kind: e.field === 'created' ? 'created' : 'edit',
        workerId: s.workerId,
        worker,
        job,
        detail: describeEdit(e),
      })
    }
  }

  for (const r of state.requests || []) {
    events.push({
      id: `${r.id}-req`,
      at: r.createdAt,
      kind: 'request',
      workerId: r.workerId,
      worker: workerName(r.workerId),
      detail: `Requested clock-out at ${formatTime(r.requestedTs)}${r.note ? ` — ${r.note}` : ''}`,
    })
    if (r.resolvedAt) {
      const verb = r.status === 'approved' ? (r.overridden ? 'Approved (time overridden)' : 'Approved') : 'Declined'
      events.push({
        id: `${r.id}-res`,
        at: r.resolvedAt,
        kind: 'resolution',
        workerId: r.workerId,
        worker: workerName(r.workerId),
        detail: `${verb} by ${r.resolvedBy}`,
      })
    }
  }

  return events.sort((a, b) => new Date(b.at) - new Date(a.at))
}

function describeEdit(e) {
  if (e.field === 'created') return `Entry added manually by ${e.by}`
  if (e.field === 'job') return `${e.by} changed job from ${e.oldLabel} → ${e.newLabel}`
  const which = e.field === 'clockIn' ? 'clock-in' : 'clock-out'
  const base = `${e.by} changed ${which} from ${e.oldTs ? formatTime(e.oldTs) : '—'} → ${formatTime(e.newTs)}`
  return `${base}${e.note ? ` — ${e.note}` : ''}`
}
