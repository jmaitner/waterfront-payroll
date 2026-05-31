import { useState } from 'react'
import { useStore } from '../data/useStore.js'
import RosterTab from './admin/RosterTab.jsx'
import TimesheetTab from './admin/TimesheetTab.jsx'
import JobsTab from './admin/JobsTab.jsx'
import SettingsTab from './admin/SettingsTab.jsx'

const TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'timesheet', label: 'Timesheet' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'settings', label: 'Settings' },
]

export default function AdminView() {
  const [tab, setTab] = useState('roster')
  const state = useStore()
  const onClock = state.shifts.filter((s) => !s.clockOut).length

  return (
    <div className="flex flex-col">
      {/* Sub-tab bar */}
      <div className="sticky top-0 z-10 flex gap-1 border-b border-slate-200 bg-slate-100 px-2 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex-1 rounded-lg py-2 text-sm font-bold transition ${
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

      <div className="p-4">
        {tab === 'roster' && <RosterTab state={state} />}
        {tab === 'timesheet' && <TimesheetTab state={state} />}
        {tab === 'jobs' && <JobsTab state={state} />}
        {tab === 'settings' && <SettingsTab state={state} />}
      </div>
    </div>
  )
}
