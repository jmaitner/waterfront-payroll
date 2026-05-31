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
import { editShiftTime, deleteShift } from '../../data/store.js'
import PrintableSheet from './PrintableSheet.jsx'

export default function TimesheetTab({ state }) {
  const [offset, setOffset] = useState(0) // 0 = current period, -1 prev, +1 next
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
      {/* Period navigator */}
      <div className="flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm">
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

      {/* Grand total + export */}
      <div className="rounded-2xl bg-navy p-4 text-white shadow">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-wave-300">Crew total</div>
            <div className="text-4xl font-extrabold tabular-nums">{formatHours(timesheet.grandTotal)}<span className="ml-1 text-lg font-bold text-wave-300">hrs</span></div>
          </div>
          <div className="text-right text-xs text-wave-300">
            Rounding: {state.settings.rounding === '15' ? 'nearest 15 min' : 'none'}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={exportCSV}
            disabled={timesheet.rows.length === 0}
            className="flex-1 rounded-xl bg-green-500 py-3 text-base font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
          >
            ⬇ Export CSV
          </button>
          <button
            onClick={() => window.print()}
            disabled={timesheet.rows.length === 0}
            className="flex-1 rounded-xl bg-white py-3 text-base font-extrabold text-navy active:scale-[0.98] disabled:opacity-50"
          >
            🖨 Print / PDF
          </button>
        </div>
      </div>

      {/* Per-worker rows */}
      {timesheet.rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No hours recorded in this pay period.
        </div>
      ) : (
        timesheet.rows.map((row) => (
          <WorkerCard key={row.worker.id} row={row} jobs={state.jobs} settings={state.settings} />
        ))
      )}

      {/* Off-screen printable payroll sheet (revealed only by print CSS). */}
      <PrintableSheet timesheet={timesheet} settings={state.settings} range={range} />
    </div>
  )
}

function WorkerCard({ row, jobs, settings }) {
  const [open, setOpen] = useState(false)
  const days = Object.keys(row.byDay).sort()
  const flagCount = days.reduce(
    (n, d) => n + row.byDay[d].shifts.reduce((m, s) => m + (s.flags?.length ? 1 : 0), 0),
    0,
  )

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

      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
          {days.map((d) => (
            <div key={d} className="py-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {formatDate(row.byDay[d].shifts[0].clockIn.ts)}
                </div>
                <div className="text-sm font-bold text-navy">{formatHours(row.byDay[d].total)} hrs</div>
              </div>
              <div className="mt-1 flex flex-col gap-2">
                {row.byDay[d].shifts.map((s) => (
                  <ShiftRow key={s.id} shift={s} settings={settings} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
          <button
            onClick={() => setEditing((e) => !e)}
            className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 active:bg-slate-200"
          >
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
            <div key={e.id}>
              {e.by} changed {e.field === 'clockIn' ? 'clock-in' : 'clock-out'} from{' '}
              {e.oldTs ? formatTime(e.oldTs) : '—'} → {formatTime(e.newTs)} ({formatDate(e.at)})
            </div>
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

function EditPanel({ shift, settings, onDone }) {
  const [inVal, setInVal] = useState(toLocalInput(shift.clockIn.ts))
  const [outVal, setOutVal] = useState(toLocalInput(shift.clockOut?.ts))

  function save() {
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
            if (confirm('Delete this time entry? This cannot be undone.')) {
              deleteShift(shift.id)
            }
          }}
          className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600 active:bg-red-100"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
