import { mapsUrl, formatCoords } from '../data/geo.js'

// Shows where a single punch happened: GPS coordinates (with accuracy) and a
// map link, or a clear "no GPS / manual" note. Used on the timesheet and the
// activity log so the owner can verify after the fact where everyone was.
export default function PunchLocation({ label, punch }) {
  if (!punch) return null

  if (punch.manual) {
    return (
      <div className="text-[11px] text-slate-400">
        <span className="font-semibold text-slate-500">{label}:</span> manual entry — no GPS
      </div>
    )
  }

  if (!punch.gps || punch.lat == null) {
    return (
      <div className="text-[11px] text-amber-600">
        <span className="font-semibold">{label}:</span> ⚑ no GPS captured
      </div>
    )
  }

  const acc = punch.accuracy != null ? ` (±${Math.round(punch.accuracy)} m)` : ''
  return (
    <div className="text-[11px] text-slate-500">
      <span className="font-semibold">{label}:</span>{' '}
      <a
        href={mapsUrl(punch.lat, punch.lng)}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-wave underline decoration-dotted underline-offset-2"
      >
        📍 {formatCoords(punch.lat, punch.lng)}
      </a>
      <span className="text-slate-400">{acc} · map ↗</span>
    </div>
  )
}
