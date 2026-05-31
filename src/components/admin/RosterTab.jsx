import { useEffect, useState } from 'react'
import { formatDuration, formatTime } from '../../data/payroll.js'

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

  if (open.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
        <div className="text-3xl">🌙</div>
        <div className="mt-2 font-bold text-navy">Nobody on the clock</div>
        <div className="mt-1 text-sm text-slate-500">
          Switch to the Crew view (top right) and clock someone in.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-bold uppercase tracking-wide text-slate-500">
        On the clock — {open.length}
      </div>
      {open.map((s) => {
        const elapsed = Date.now() - new Date(s.clockIn.ts).getTime()
        const flagged = (s.flags || []).length > 0
        return (
          <div key={s.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-extrabold text-navy">{worker(s.workerId)}</div>
                <div className="text-sm text-slate-500">{job(s.jobId)}</div>
                <div className="mt-1 text-xs text-slate-400">
                  In at {formatTime(s.clockIn.ts)} ·{' '}
                  {s.clockIn.gps ? (
                    <span className="text-wave">📍 GPS stamped</span>
                  ) : (
                    <span className="text-amber-600">no GPS</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5 font-mono text-xl font-extrabold tabular-nums text-green-600">
                  <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  {formatDuration(elapsed)}
                </div>
              </div>
            </div>
            {flagged && (
              <div className="mt-2 rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                ⚑ {s.flags.map((f) => f.label).join(' · ')}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
