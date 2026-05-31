import { useState } from 'react'
import {
  buildTimesheet,
  periodRange,
  formatPeriod,
  formatTime,
  formatDate,
  formatHours,
  buildPayrollCSV,
  downloadCSV,
} from '../../data/payroll.js'
import { editShiftTime, editShiftJob, deleteShift, addManualShift, getJobs } from '../../data/store.js'
import PrintableSheet from './PrintableSheet.jsx'

export default function TimesheetTab({ state }) {
  const [offset, setOffset] = useState(0) // 0 = current period, -1 prev, +1 next
  const [adding, setAdding] = useState(false)
  const range = periodRange(state.settings, new Date(), offset)
  const timesheet = buildTimesheet({
    shifts: state.shifts,
    workers: state.workers,
    jobs: state.jobs,
    settings: state.settings,
    range,
  })

  function exportCSV() {
    const csv = buildPayrollCSV({ timesheet, settings: state.settings, range, jobs: state.jobs })
    const stamp = range.start.toISOString().slice(0, 10)
    downloadCSV(`waterfront-payroll-${stamp}.csv`, csv)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className="flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm lg:flex-1">
          <button onClick={() => setOffset((o) => o - 1)} className="rounded-lg px-3 py-2 text-xl font-bold text-navy active:bg-slate-100">
            ‹
          </button>
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {state.settings.payPeriod} pay period{offset === 0 ? ' · current' : ''}
            </div>
            <div className="font-extrabold text-navy">{formatPeriod(range)}</div>
          </div>
          <button onClick={() => setOffset((o) => o + 1)} className="rounded-lg px-3 py-2 text-xl font-bold text-navy active:bg-slate-100">
            ›
          </button>
        </div>

        <div className="rounded-2xl bg-navy p-4 text-white shadow lg:flex lg:items-center lg:gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-wave-300">Crew total</div>
            <div className="text-4xl font-extrabold tabular-nums">
              {formatHours(timesheet.grandTotal)}
              <span className="ml-1 text-lg font-bold text-wave-300">hrs</span>
            </div>
            <div className="text-xs text-wave-300">
              Rounding: {state.settings.rounding === '15' ? 'nearest 15 min' : 'none'}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 lg:mt-0">
            <button onClick={() => setAdding(true)} className="rounded-xl bg-white/15 px-3 py-3 text-sm font-extrabold text-white active:scale-[0.98]">
              + Add entry
            </button>
            <button
              onClick={exportCSV}
              disabled={timesheet.rows.length === 0}
              className="flex-1 rounded-xl bg-green-500 px-4 py-3 text-sm font-extrabold text-white active:scale-[0.98] disabled:opacity-50 lg:flex-none"
            >
              ⬇ Export CSV
            </button>
            <button
              onClick={() => window.print()}
              disabled={timesheet.rows.length === 0}
              className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-navy active:scale-[0.98] disabled:opacity-50 lg:flex-none"
            >
              🖨 Print / PDF
            </button>
          </div>
        </div>
      </div>

      {timesheet.rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No hours recorded in this pay period.
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-4 lg:hidden">
            {timesheet.rows.map((row) => (
              <WorkerCard key={row.worker.id} row={row} settings={state.settings} />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Worker</th>
                  <th className="px-5 py-3">Days worked</th>
                  <th className="px-5 py-3">Flags</th>
                  <th className="px-5 py-3 text-right">Hours</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {timesheet.rows.map((row) => (
                  <WorkerTableRow key={row.worker.id} row={row} settings={state.settings} />
                ))}
                <tr className="border-t-2 border-navy bg-slate-50">
                  <td className="px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-navy">Crew grand total</td>
                  <td colSpan={2} />
                  <td className="px-5 py-3 text-right text-2xl font-extrabold tabular-nums text-navy">
                    {formatHours(timesheet.grandTotal)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {adding && <AddEntryModal state={state} onClose={() => setAdding(false)} />}

      {/* Off-screen printable payroll sheet (revealed only by print CSS). */}
      <PrintableSheet timesheet={timesheet} settings={state.settings} range={range} />
    </div>
  )
}

// --- shared detail (days → jobs → shifts) ---------------------------------

function dayCounts(row) {
  const days = Object.keys(row.byDay).sort()
  const flagCount = days.reduce(
    (n, d) => n + row.byDay[d].shifts.reduce((m, s) => m + (s.flags?.length ? 1 : 0), 0),
    0,
  )
  return { days, flagCount }
}

function WorkerDetail({ row, settings }) {
  const { days } = dayCounts(row)
  return (
    <div className="bg-slate-50 px-3 py-2 lg:px-5">
      {days.map((d) => (
        <div key={d} className="py-2">
          <div className="flex items-center justify-between px-1">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {formatDate(row.byDay[d].shifts[0].clockIn.ts)}
            </div>
            <div className="text-sm font-bold text-navy">{formatHours(row.byDay[d].total)} hrs</div>
          </div>
          <div className="mt-1 grid gap-2 lg:grid-cols-2">
            {row.byDay[d].shifts.map((s) => (
              <ShiftRow key={s.id} shift={s} settings={settings} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function WorkerCard({ row, settings }) {
  const [open, setOpen] = useState(false)
  const { days, flagCount } = dayCounts(row)
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-4 text-left">
        <div>
          <div className="text-lg font-extrabold text-navy">{row.worker.name}</div>
          <div className="text-xs text-slate-500">
            {days.length} day{days.length !== 1 ? 's' : ''}
            {flagCount > 0 && <span className="ml-2 font-bold text-amber-600">⚑ {flagCount} flagged</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-extrabold tabular-nums text-navy">{formatHours(row.total)}</div>
          <span className={`text-slate-400 transition ${open ? 'rotate-90' : ''}`}>›</span>
        </div>
      </button>
      {open && <div className="border-t border-slate-100"><WorkerDetail row={row} settings={settings} /></div>}
    </div>
  )
}

function WorkerTableRow({ row, settings }) {
  const [open, setOpen] = useState(false)
  const { days, flagCount } = dayCounts(row)
  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50">
        <td className="px-5 py-4 text-base font-extrabold text-navy">{row.worker.name}</td>
        <td className="px-5 py-4 text-sm text-slate-500">{days.length}</td>
        <td className="px-5 py-4 text-sm">
          {flagCount > 0 ? <span className="font-bold text-amber-600">⚑ {flagCount}</span> : <span className="text-slate-300">—</span>}
        </td>
        <td className="px-5 py-4 text-right text-xl font-extrabold tabular-nums text-navy">{formatHours(row.total)}</td>
        <td className="px-5 py-4 text-right">
          <button onClick={() => setOpen((o) => !o)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">
            {open ? 'Hide' : 'Details'}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="p-0">
            <WorkerDetail row={row} settings={settings} />
          </td>
        </tr>
      )}
    </>
  )
}

function ShiftRow({ shift, settings }) {
  const [editing, setEditing] = useState(false)
  const flagged = (shift.flags || []).length > 0
  const edited = (shift.edits || []).length > 0
  return (
    <div className={`rounded-xl border bg-white p-3 ${flagged ? 'border-amber-300' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-navy">{shift.jobName}</div>
          <div className="text-xs text-slate-500">
            {formatTime(shift.clockIn.ts)} → {shift.open ? <span className="font-bold text-green-600">on clock</span> : formatTime(shift.clockOut.ts)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-base font-extrabold tabular-nums text-navy">{formatHours(shift.hours)}</div>
          <button onClick={() => setEditing((e) => !e)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 active:bg-slate-200">
            {editing ? 'Close' : 'Edit'}
          </button>
        </div>
      </div>

      {flagged && (
        <div className="mt-2 rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
          ⚑ {shift.flags.map((f) => f.label).join(' · ')}
        </div>
      )}

      {edited && (
        <div className="mt-2 rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
          <span className="font-bold">Edit log:</span>
          {shift.edits.map((e) => (
            <div key={e.id}>{describeEdit(e)}</div>
          ))}
        </div>
      )}

      {editing && <EditPanel shift={shift} settings={settings} onDone={() => setEditing(false)} />}
    </div>
  )
}

function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// One-line description of an edit-log entry.
function describeEdit(e) {
  const when = `(${formatDate(e.at)})`
  if (e.field === 'created') return `${e.by} added this entry manually ${when}`
  if (e.field === 'job') return `${e.by} changed job from ${e.oldLabel} → ${e.newLabel} ${when}`
  const which = e.field === 'clockIn' ? 'clock-in' : 'clock-out'
  const base = `${e.by} changed ${which} from ${e.oldTs ? formatTime(e.oldTs) : '—'} → ${formatTime(e.newTs)}`
  return `${base}${e.note ? ` — ${e.note}` : ''} ${when}`
}

function EditPanel({ shift, settings, onDone }) {
  const jobs = getJobs()
  const [inVal, setInVal] = useState(toLocalInput(shift.clockIn.ts))
  const [outVal, setOutVal] = useState(toLocalInput(shift.clockOut?.ts))
  const [jobId, setJobId] = useState(shift.jobId)
  function save() {
    if (jobId !== shift.jobId) editShiftJob(shift.id, jobId, settings.adminName)
    const newIn = inVal ? new Date(inVal).toISOString() : null
    if (newIn && newIn !== shift.clockIn.ts) editShiftTime(shift.id, 'clockIn', newIn, settings.adminName)
    if (shift.clockOut) {
      const newOut = outVal ? new Date(outVal).toISOString() : null
      if (newOut && newOut !== shift.clockOut.ts) editShiftTime(shift.id, 'clockOut', newOut, settings.adminName)
    }
    onDone()
  }
  return (
    <div className="mt-3 rounded-xl bg-slate-50 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Manual edit (logged)</div>
      <label className="mt-2 block text-xs font-semibold text-slate-600">
        Job / site
        <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm font-bold text-navy">
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.name}</option>
          ))}
        </select>
      </label>
      <label className="mt-2 block text-xs font-semibold text-slate-600">
        Clock in
        <input type="datetime-local" value={inVal} onChange={(e) => setInVal(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
      </label>
      {shift.clockOut ? (
        <label className="mt-2 block text-xs font-semibold text-slate-600">
          Clock out
          <input type="datetime-local" value={outVal} onChange={(e) => setOutVal(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
        </label>
      ) : (
        <div className="mt-2 text-xs italic text-slate-400">Worker is still on the clock — clock-out time not set.</div>
      )}
      <div className="mt-3 flex gap-2">
        <button onClick={save} className="flex-1 rounded-lg bg-navy py-2 text-sm font-bold text-white active:scale-[0.98]">
          Save edit
        </button>
        <button
          onClick={() => {
            if (confirm('Delete this time entry? This cannot be undone.')) deleteShift(shift.id)
          }}
          className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600 active:bg-red-100"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// Add a shift from scratch — for a worker who forgot to clock in entirely.
function AddEntryModal({ state, onClose }) {
  const crew = state.workers
  const jobs = state.jobs.filter((j) => j.active !== false)
  const [workerId, setWorkerId] = useState(crew[0]?.id || '')
  const [jobId, setJobId] = useState(jobs[0]?.id || '')
  const today = toLocalInput(new Date().toISOString()).slice(0, 10)
  const [inVal, setInVal] = useState(`${today}T07:00`)
  const [outVal, setOutVal] = useState(`${today}T15:30`)
  const [error, setError] = useState('')

  function save() {
    if (!workerId || !jobId || !inVal) return setError('Worker, job, and clock-in are required.')
    if (outVal && new Date(outVal) <= new Date(inVal)) return setError('Clock-out must be after clock-in.')
    addManualShift({
      workerId,
      jobId,
      clockInTs: new Date(inVal).toISOString(),
      clockOutTs: outVal ? new Date(outVal).toISOString() : null,
      by: state.settings.adminName,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-extrabold text-navy">Add a time entry</div>
        <div className="mt-1 text-sm text-slate-500">For a crew member who forgot to clock in. Logged as a manual entry.</div>

        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Worker
          <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-navy">
            {crew.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-slate-500">
          Job
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-navy">
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            Clock in
            <input type="datetime-local" value={inVal} onChange={(e) => setInVal(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            Clock out
            <input type="datetime-local" value={outVal} onChange={(e) => setOutVal(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          </label>
        </div>

        {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</div>}

        <div className="mt-4 flex gap-2">
          <button onClick={save} className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-bold text-white active:scale-[0.98]">
            Add entry
          </button>
          <button onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
