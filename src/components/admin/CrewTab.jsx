import { useState } from 'react'
import { addWorker, setWorkerActive, deleteWorker, workerHasShifts } from '../../data/store.js'

// Add / deactivate / remove crew. Workers with recorded hours are deactivated
// (hidden from the clock-in pickers) rather than deleted, so old timesheets and
// pay history stay intact.
export default function CrewTab({ state }) {
  const [adding, setAdding] = useState(false)
  const active = state.workers.filter((w) => w.active !== false)
  const inactive = state.workers.filter((w) => w.active === false)

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Crew — {active.length} active
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="rounded-lg bg-navy px-3 py-2 text-sm font-bold text-white active:scale-[0.98]">
            + Add worker
          </button>
        )}
      </div>

      {adding && <AddWorker onDone={() => setAdding(false)} />}

      {active.map((w) => (
        <WorkerRow key={w.id} worker={w} />
      ))}

      {inactive.length > 0 && (
        <>
          <div className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Inactive</div>
          {inactive.map((w) => (
            <WorkerRow key={w.id} worker={w} />
          ))}
        </>
      )}
    </div>
  )
}

function WorkerRow({ worker }) {
  const isActive = worker.active !== false
  const hasHistory = workerHasShifts(worker.id)
  return (
    <div className={`flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ${isActive ? '' : 'opacity-60'}`}>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-navy">{worker.name}</span>
          {worker.role === 'admin' && (
            <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Owner</span>
          )}
          {!isActive && <span className="text-xs font-bold text-slate-400">inactive</span>}
        </div>
        <div className="text-xs text-slate-400">{hasHistory ? 'Has recorded hours' : 'No hours yet'}</div>
      </div>
      <div className="flex items-center gap-2">
        {isActive ? (
          <button
            onClick={() => setWorkerActive(worker.id, false)}
            className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700 active:bg-amber-100"
          >
            Deactivate
          </button>
        ) : (
          <button
            onClick={() => setWorkerActive(worker.id, true)}
            className="rounded-lg bg-green-50 px-3 py-2 text-sm font-bold text-green-700 active:bg-green-100"
          >
            Reactivate
          </button>
        )}
        {!hasHistory && (
          <button
            onClick={() => {
              if (confirm(`Remove ${worker.name}? They have no recorded hours.`)) deleteWorker(worker.id)
            }}
            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600 active:bg-red-100"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

function AddWorker({ onDone }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('crew')
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Worker name"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
      />
      <div className="mt-3 flex gap-2">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-navy">
          <option value="crew">Crew</option>
          <option value="admin">Owner / admin</option>
        </select>
        <button
          onClick={() => {
            if (name.trim()) addWorker({ name, role })
            onDone()
          }}
          className="flex-1 rounded-lg bg-navy py-2 text-sm font-bold text-white"
        >
          Add
        </button>
        <button onClick={onDone} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
          Cancel
        </button>
      </div>
    </div>
  )
}
