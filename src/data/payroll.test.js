import { describe, it, expect } from 'vitest'
import {
  rawDurationMs,
  applyRounding,
  shiftHours,
  periodRange,
  buildTimesheet,
} from './payroll.js'

const iso = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi, 0).toISOString()

// Build a closed shift with local clock-in/out times.
const shift = (workerId, jobId, ci, co, flags = []) => ({
  id: `${workerId}-${ci}`,
  workerId,
  jobId,
  clockIn: { ts: ci },
  clockOut: co ? { ts: co } : null,
  flags,
  edits: [],
})

describe('duration + rounding', () => {
  it('computes exact shift duration', () => {
    expect(rawDurationMs(shift('w', 'j', iso(2026, 5, 26, 7, 0), iso(2026, 5, 26, 15, 30)))).toBe(8.5 * 3600000)
  })

  it('open shift has zero duration', () => {
    expect(rawDurationMs(shift('w', 'j', iso(2026, 5, 26, 7, 0), null))).toBe(0)
  })

  it('never returns negative for reversed punches', () => {
    expect(rawDurationMs(shift('w', 'j', iso(2026, 5, 26, 15, 0), iso(2026, 5, 26, 7, 0)))).toBe(0)
  })

  it('rounding=none leaves the duration untouched', () => {
    const ms = 8 * 3600000 + 7 * 60000 // 8h07m
    expect(applyRounding(ms, 'none')).toBe(ms)
  })

  it('rounding=15 snaps to the nearest quarter hour', () => {
    expect(applyRounding(7 * 60000, '15')).toBe(0) // 7m → 0m (down)
    expect(applyRounding(8 * 60000, '15')).toBe(15 * 60000) // 8m → 15m (up)
    expect(applyRounding(8 * 3600000 + 23 * 60000, '15')).toBe(8 * 3600000 + 30 * 60000) // 8h23m → 8h30m
  })

  it('shiftHours applies the rounding rule', () => {
    const s = shift('w', 'j', iso(2026, 5, 26, 7, 7), iso(2026, 5, 26, 15, 0)) // 7h53m
    expect(shiftHours(s, 'none')).toBeCloseTo(7.8833, 3)
    expect(shiftHours(s, '15')).toBe(8) // 7h53m → 8h00m
  })
})

describe('pay-period ranges', () => {
  const biweekly = { payPeriod: 'biweekly', payPeriodStart: iso(2026, 5, 25, 0, 0) } // Mon May 25
  const weekly = { payPeriod: 'weekly', payPeriodStart: iso(2026, 5, 25, 0, 0) }

  it('biweekly period contains the reference date', () => {
    const r = periodRange(biweekly, new Date(2026, 4, 31, 12, 0)) // May 31
    expect(r.start.getTime()).toBe(new Date(2026, 4, 25).getTime())
    expect(r.end.getTime()).toBe(new Date(2026, 5, 8).getTime()) // +14 days
  })

  it('weekly period is 7 days', () => {
    const r = periodRange(weekly, new Date(2026, 4, 31, 12, 0))
    expect((r.end - r.start) / 86400000).toBe(7)
  })

  it('offset walks whole periods', () => {
    const cur = periodRange(biweekly, new Date(2026, 4, 31), 0)
    const prev = periodRange(biweekly, new Date(2026, 4, 31), -1)
    expect(cur.start - prev.start).toBe(14 * 86400000)
  })

  it('a date in the next period rolls forward', () => {
    const r = periodRange(biweekly, new Date(2026, 5, 10)) // Jun 10 → second period
    expect(r.start.getTime()).toBe(new Date(2026, 5, 8).getTime())
  })
})

describe('timesheet aggregation', () => {
  const workers = [
    { id: 'w_bob', name: 'Bob' },
    { id: 'w_carlos', name: 'Carlos' },
    { id: 'w_idle', name: 'Idle' },
  ]
  const jobs = [
    { id: 'j1', name: 'Deck' },
    { id: 'j2', name: 'Seawall' },
  ]
  const settings = { payPeriod: 'biweekly', payPeriodStart: iso(2026, 5, 25, 0, 0), rounding: 'none' }
  const range = periodRange(settings, new Date(2026, 4, 31))

  const shifts = [
    shift('w_bob', 'j1', iso(2026, 5, 26, 7, 0), iso(2026, 5, 26, 15, 30)), // 8.5
    shift('w_bob', 'j1', iso(2026, 5, 27, 7, 15), iso(2026, 5, 27, 16, 0)), // 8.75
    shift('w_carlos', 'j2', iso(2026, 5, 26, 8, 0), iso(2026, 5, 26, 12, 0), [{ label: 'geofence' }]), // 4, flagged
    shift('w_bob', 'j1', iso(2026, 4, 1, 7, 0), iso(2026, 4, 1, 15, 0)), // OUT OF RANGE (April)
  ]

  const ts = buildTimesheet({ shifts, workers, jobs, settings, range })

  it('totals each worker correctly', () => {
    const bob = ts.rows.find((r) => r.worker.id === 'w_bob')
    const carlos = ts.rows.find((r) => r.worker.id === 'w_carlos')
    expect(bob.total).toBe(17.25)
    expect(carlos.total).toBe(4)
  })

  it('excludes shifts outside the pay period', () => {
    const bob = ts.rows.find((r) => r.worker.id === 'w_bob')
    expect(Object.keys(bob.byDay).length).toBe(2) // April shift dropped
  })

  it('omits workers with no hours in the period', () => {
    expect(ts.rows.find((r) => r.worker.id === 'w_idle')).toBeUndefined()
  })

  it('breaks hours out per day and per job', () => {
    const bob = ts.rows.find((r) => r.worker.id === 'w_bob')
    const may26 = bob.byDay['2026-05-26']
    expect(may26.total).toBe(8.5)
    expect(may26.jobs.j1).toBe(8.5)
  })

  it('preserves flags on shifts', () => {
    const carlos = ts.rows.find((r) => r.worker.id === 'w_carlos')
    const s = carlos.byDay['2026-05-26'].shifts[0]
    expect(s.flags).toHaveLength(1)
  })

  it('grand total sums every worker', () => {
    expect(ts.grandTotal).toBe(21.25) // 17.25 + 4
  })
})
