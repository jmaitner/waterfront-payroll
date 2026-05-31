import { useState } from 'react'
import { useStore } from '../data/useStore.js'
import { setActingUser } from '../data/store.js'
import Logo from './Logo.jsx'
import ViewToggle from './ViewToggle.jsx'
import RosterTab from './admin/RosterTab.jsx'
import TimesheetTab from './admin/TimesheetTab.jsx'
import JobsTab from './admin/JobsTab.jsx'
import CrewTab from './admin/CrewTab.jsx'
import LogTab from './admin/LogTab.jsx'
import SettingsTab from './admin/SettingsTab.jsx'

const TABS = [
  { id: 'roster', label: 'Roster', icon: '🟢' },
  { id: 'timesheet', label: 'Timesheet', icon: '🧾' },
  { id: 'jobs', label: 'Jobs', icon: '📍' },
  { id: 'crew', label: 'Crew', icon: '👷' },
  { id: 'log', label: 'Log', icon: '📜' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

// Full-width admin workspace. Desktop (lg+) = left sidebar; mobile = top tabs.
export default function AdminView({ view, setView }) {
  const [tab, setTab] = useState('roster')
  const state = useStore()
  const onClock = state.shifts.filter((s) => !s.clockOut).length

  return (
    <div className="min-h-screen bg-slate-100 text-navy">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 bg-navy px-4 py-3 text-white lg:px-6">
        <div className="flex items-center gap-3">
          <Logo className="h-8" />
          <span className="hidden text-sm font-semibold text-wave-300 sm:inline">Admin Console</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="hidden items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 sm:flex">
            <span className="text-[10px] font-bold uppercase tracking-wide text-wave-300">Acting as</span>
            <select
              value={state.actingUserId}
              onChange={(e) => setActingUser(e.target.value)}
              className="rounded-lg bg-white px-2 py-1 text-sm font-bold text-navy"
            >
              {state.workers
                .filter((w) => w.active !== false)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.role === 'admin' ? ' (owner)' : ''}
                  </option>
                ))}
            </select>
          </label>
          <ViewToggle view={view} setView={setView} />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white lg:block">
          <nav className="sticky top-0 flex flex-col gap-1 p-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${
                  tab === t.id ? 'bg-navy text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{t.icon}</span>
                  {t.label}
                </span>
                {t.id === 'roster' && onClock > 0 && (
                  <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-green-500 px-1 text-[11px] font-bold text-white">
                    {onClock}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          {/* Mobile tab bar */}
          <div className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-100 px-2 py-2 lg:hidden">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition ${
                  tab === t.id ? 'bg-navy text-white' : 'text-slate-500'
                }`}
              >
                {t.label}
                {t.id === 'roster' && onClock > 0 && (
                  <span className="absolute -top-1 right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-green-500 px-1 text-[11px] font-bold text-white">
                    {onClock}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-4 lg:p-6">
            {tab === 'roster' && <RosterTab state={state} />}
            {tab === 'timesheet' && <TimesheetTab state={state} />}
            {tab === 'jobs' && <JobsTab state={state} />}
            {tab === 'crew' && <CrewTab state={state} />}
            {tab === 'log' && <LogTab state={state} />}
            {tab === 'settings' && <SettingsTab state={state} />}
          </div>
        </main>
      </div>
    </div>
  )
}
