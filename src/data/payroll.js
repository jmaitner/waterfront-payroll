// Payroll math: durations, rounding, pay-period ranges, totals, CSV + print.

const MS_PER_HOUR = 3600000
const MS_PER_MIN = 60000

// Raw shift duration in ms (0 if still open / malformed).
export function rawDurationMs(shift) {
  if (!shift?.clockIn?.ts || !shift?.clockOut?.ts) return 0
  const d = new Date(shift.clockOut.ts) - new Date(shift.clockIn.ts)
  return d > 0 ? d : 0
}

// Apply the admin rounding rule to a duration in ms.
export function applyRounding(ms, rule) {
  if (rule === '15') {
    const step = 15 * MS_PER_MIN
    return Math.round(ms / step) * step
  }
  return ms // 'none'
}

// Hours (decimal) for a shift after rounding.
export function shiftHours(shift, rule) {
  return applyRounding(rawDurationMs(shift), rule) / MS_PER_HOUR
}

// "8h 32m" formatting from ms.
export function formatDuration(ms) {
  const totalMin = Math.floor(ms / MS_PER_MIN)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

// "7.25" decimal-hours string.
export function formatHours(hours) {
  return hours.toFixed(2)
}

export function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export function dayKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// --- Pay periods -----------------------------------------------------------

function periodLengthDays(settings) {
  return settings.payPeriod === 'weekly' ? 7 : 14
}

// The pay period (start/end Date) that contains `ref`, anchored on
// settings.payPeriodStart. `offset` shifts whole periods (-1 prev, +1 next).
export function periodRange(settings, ref = new Date(), offset = 0) {
  const lenDays = periodLengthDays(settings)
  const lenMs = lenDays * 24 * MS_PER_HOUR
  const anchor = new Date(settings.payPeriodStart)
  const idx = Math.floor((ref - anchor) / lenMs) + offset
  const start = new Date(anchor.getTime() + idx * lenMs)
  const end = new Date(start.getTime() + lenMs)
  return { start, end }
}

export function formatPeriod({ start, end }) {
  const opts = { month: 'short', day: 'numeric' }
  const last = new Date(end.getTime() - 1)
  return `${start.toLocaleDateString([], opts)} – ${last.toLocaleDateString([], { ...opts, year: 'numeric' })}`
}

// --- Aggregation -----------------------------------------------------------

// Build a per-worker timesheet for the given period.
// Returns { rows: [{worker, total, byDay:{day:{total, jobs:{jobId:hours}, shifts:[]}}}], grandTotal }
export function buildTimesheet({ shifts, workers, jobs, settings, range }) {
  const inRange = shifts.filter((s) => {
    if (!s.clockIn?.ts) return false
    const t = new Date(s.clockIn.ts)
    return t >= range.start && t < range.end
  })

  const jobName = (id) => jobs.find((j) => j.id === id)?.name || 'Unassigned'

  const rows = workers
    .map((worker) => {
      const mine = inRange
        .filter((s) => s.workerId === worker.id)
        .sort((a, b) => new Date(a.clockIn.ts) - new Date(b.clockIn.ts))
      if (mine.length === 0) return null

      const byDay = {}
      let total = 0
      for (const s of mine) {
        const hrs = shiftHours(s, settings.rounding)
        const open = !s.clockOut?.ts
        const k = dayKey(s.clockIn.ts)
        byDay[k] = byDay[k] || { total: 0, jobs: {}, shifts: [] }
        byDay[k].total += hrs
        byDay[k].jobs[s.jobId] = (byDay[k].jobs[s.jobId] || 0) + hrs
        byDay[k].shifts.push({ ...s, hours: hrs, open, jobName: jobName(s.jobId) })
        total += hrs
      }
      return { worker, total, byDay }
    })
    .filter(Boolean)

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0)
  return { rows, grandTotal, inRange }
}

// --- Export ----------------------------------------------------------------

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildPayrollCSV({ timesheet, settings, range, jobs }) {
  const lines = []
  lines.push(['Waterfront Solutions — Payroll'])
  lines.push(['Pay Period', formatPeriod(range)])
  lines.push(['Schedule', settings.payPeriod, 'Rounding', settings.rounding === '15' ? 'Nearest 15 min' : 'None'])
  lines.push([])
  lines.push(['Worker', 'Date', 'Job', 'Clock In', 'Clock Out', 'Hours', 'Flags'])

  for (const row of timesheet.rows) {
    const days = Object.keys(row.byDay).sort()
    for (const d of days) {
      for (const s of row.byDay[d].shifts) {
        lines.push([
          row.worker.name,
          formatDate(s.clockIn.ts),
          s.jobName,
          formatTime(s.clockIn.ts),
          s.open ? 'STILL ON CLOCK' : formatTime(s.clockOut.ts),
          formatHours(s.hours),
          (s.flags || []).map((f) => f.label).join('; '),
        ])
      }
    }
    lines.push([`${row.worker.name} — TOTAL`, '', '', '', '', formatHours(row.total), ''])
    lines.push([])
  }
  lines.push(['CREW GRAND TOTAL', '', '', '', '', formatHours(timesheet.grandTotal), ''])

  return lines.map((cols) => cols.map(csvCell).join(',')).join('\n')
}

export function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
