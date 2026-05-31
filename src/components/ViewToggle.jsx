// Crew ⇄ Admin switch. Shared by the worker phone shell and the admin console.
export default function ViewToggle({ view, setView }) {
  return (
    <div className="flex rounded-full bg-white/10 p-0.5 text-xs font-bold">
      <button
        onClick={() => setView('worker')}
        className={`rounded-full px-3 py-1.5 transition ${view === 'worker' ? 'bg-white text-navy' : 'text-white/80'}`}
      >
        Crew
      </button>
      <button
        onClick={() => setView('admin')}
        className={`rounded-full px-3 py-1.5 transition ${view === 'admin' ? 'bg-white text-navy' : 'text-white/80'}`}
      >
        Admin
      </button>
    </div>
  )
}
