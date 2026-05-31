import { useState } from 'react'
import { useStore } from './data/useStore.js'
import { setActingUser } from './data/store.js'
import Logo from './components/Logo.jsx'
import ViewToggle from './components/ViewToggle.jsx'
import WorkerView from './components/WorkerView.jsx'
import AdminView from './components/AdminView.jsx'

export default function App() {
  const state = useStore()
  const [view, setView] = useState('worker') // 'worker' | 'admin'
  const acting = state.workers.find((w) => w.id === state.actingUserId)

  // Admin gets a full-width desktop workspace; the crew app stays phone-framed.
  if (view === 'admin') {
    return <AdminView view={view} setView={setView} />
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-slate-100 text-navy shadow-xl sm:my-4 sm:min-h-[calc(100vh-2rem)] sm:rounded-3xl sm:overflow-hidden">
      {/* Header */}
      <header className="bg-navy px-4 pt-4 pb-3 text-white" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between">
          <Logo className="h-9" />
          <ViewToggle view={view} setView={setView} />
        </div>

        {/* Demo-only crew simulator */}
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-wave-300">Acting as</span>
          <select
            value={state.actingUserId}
            onChange={(e) => setActingUser(e.target.value)}
            className="flex-1 rounded-lg bg-white px-2 py-1.5 text-sm font-bold text-navy"
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
          <span className="text-[10px] text-white/50">demo</span>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto">
        <WorkerView acting={acting} />
      </main>
    </div>
  )
}
