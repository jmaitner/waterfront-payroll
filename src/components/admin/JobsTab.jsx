import { useState } from 'react'
import { updateJob, addJob } from '../../data/store.js'
import { captureLocation } from '../../data/geo.js'

// Manage job sites + their geofence location. Setting a site's coordinates is
// what makes the out-of-range flag fire during the pitch.
export default function JobsTab({ state }) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <div className="rounded-2xl bg-wave/10 p-3 text-xs text-navy">
        <span className="font-bold">Geofence radius:</span> {state.settings.geofenceRadiusMiles} mi (set in
        Settings). A punch outside a job's radius gets flagged. Tap{' '}
        <span className="font-bold">Use my location</span> on the job you're standing at for a clean
        punch, and leave another far away to watch a flag fire.
      </div>

      {state.jobs.map((j) => (
        <JobCard key={j.id} job={j} />
      ))}

      {adding ? (
        <AddJob onDone={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)} className="rounded-2xl border-2 border-dashed border-navy/30 py-3 font-bold text-navy active:bg-white">
          + Add job site
        </button>
      )}
    </div>
  )
}

function JobCard({ job }) {
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(job.name)
  const [address, setAddress] = useState(job.address || '')
  const [lat, setLat] = useState(job.lat != null ? String(job.lat) : '')
  const [lng, setLng] = useState(job.lng != null ? String(job.lng) : '')

  function startEdit() {
    setName(job.name)
    setAddress(job.address || '')
    setLat(job.lat != null ? String(job.lat) : '')
    setLng(job.lng != null ? String(job.lng) : '')
    setEdit(true)
  }

  async function useMyLocation() {
    setBusy(true)
    const cap = await captureLocation()
    setBusy(false)
    if (!cap.ok) {
      alert('Could not get location (' + cap.reason + '). Check location permission.')
      return
    }
    if (edit) {
      // populate the editable fields so they can be reviewed/tweaked before saving
      setLat(cap.coords.lat.toFixed(6))
      setLng(cap.coords.lng.toFixed(6))
    } else {
      updateJob(job.id, { lat: cap.coords.lat, lng: cap.coords.lng })
    }
  }

  function save() {
    const latStr = lat.trim()
    const lngStr = lng.trim()
    let nextLat = null
    let nextLng = null
    if (latStr !== '' || lngStr !== '') {
      nextLat = Number(latStr)
      nextLng = Number(lngStr)
      if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
        return alert('Latitude and longitude must both be numbers (or both blank to clear the geofence).')
      }
      if (nextLat < -90 || nextLat > 90 || nextLng < -180 || nextLng > 180) {
        return alert('Out of range. Latitude is −90 to 90, longitude is −180 to 180.')
      }
    }
    updateJob(job.id, { name: name.trim() || job.name, address, lat: nextLat, lng: nextLng })
    setEdit(false)
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {edit ? (
            <div className="flex flex-col gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Job name" className="rounded-lg border border-slate-300 px-2 py-2 text-sm font-bold" />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
              <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">Geofence coordinates</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-slate-500">
                  Latitude
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="43.0775"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Longitude
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="-86.1956"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="text-[11px] text-slate-400">
                Type coordinates by hand, or tap “Use my location” to fill them. Leave both blank to clear the geofence.
              </div>
            </div>
          ) : (
            <>
              <div className="text-lg font-extrabold text-navy">{job.name}</div>
              <div className="text-sm text-slate-500">{job.address || 'No address'}</div>
            </>
          )}
          {!edit && (
            <div className="mt-1 text-xs text-slate-400">
              {job.lat != null ? (
                <span className="text-wave">📍 {job.lat.toFixed(4)}, {job.lng.toFixed(4)}</span>
              ) : (
                <span className="text-amber-600">No geofence location set</span>
              )}
            </div>
          )}
        </div>
        <label className="ml-2 flex cursor-pointer items-center gap-1 text-xs font-bold text-slate-500">
          <input
            type="checkbox"
            checked={job.active !== false}
            onChange={(e) => updateJob(job.id, { active: e.target.checked })}
            className="h-4 w-4 accent-navy"
          />
          Active
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={useMyLocation} disabled={busy} className="flex-1 rounded-lg bg-wave py-2 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-60">
          {busy ? 'Locating…' : '📍 Use my location'}
        </button>
        {edit ? (
          <>
            <button onClick={save} className="rounded-lg bg-navy px-3 py-2 text-sm font-bold text-white">
              Save
            </button>
            <button onClick={() => setEdit(false)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
              Cancel
            </button>
          </>
        ) : (
          <button onClick={startEdit} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
            Edit
          </button>
        )}
      </div>
    </div>
  )
}

function AddJob({ onDone }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [busy, setBusy] = useState(false)

  async function useMyLocation() {
    setBusy(true)
    const cap = await captureLocation()
    setBusy(false)
    if (!cap.ok) return alert('Could not get location (' + cap.reason + ').')
    setLat(cap.coords.lat.toFixed(6))
    setLng(cap.coords.lng.toFixed(6))
  }

  function add() {
    if (!name.trim()) return onDone()
    const latStr = lat.trim()
    const lngStr = lng.trim()
    let nextLat = null
    let nextLng = null
    if (latStr !== '' || lngStr !== '') {
      nextLat = Number(latStr)
      nextLng = Number(lngStr)
      if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
        return alert('Latitude and longitude must both be numbers (or both blank).')
      }
      if (nextLat < -90 || nextLat > 90 || nextLng < -180 || nextLng > 180) {
        return alert('Out of range. Latitude is −90 to 90, longitude is −180 to 180.')
      }
    }
    addJob({ name: name.trim(), address, lat: nextLat, lng: nextLng })
    onDone()
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Job name (e.g. Smith Deck)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold" />
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input type="number" step="any" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input type="number" step="any" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={useMyLocation} disabled={busy} className="rounded-lg bg-wave px-3 py-2 text-sm font-bold text-white disabled:opacity-60">
          {busy ? 'Locating…' : '📍 Use my location'}
        </button>
        <button onClick={add} className="flex-1 rounded-lg bg-navy py-2 text-sm font-bold text-white">
          Add
        </button>
        <button onClick={onDone} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">
          Cancel
        </button>
      </div>
    </div>
  )
}
