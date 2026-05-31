// Location helpers — a single GPS capture per punch (NOT continuous tracking).

const EARTH_RADIUS_MI = 3958.8

// Link that drops a pin on a punch's coordinates.
export function mapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

// "43.0775, -86.1956" — fixed precision for display.
export function formatCoords(lat, lng) {
  if (lat == null || lng == null) return null
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

// Distance between two lat/lng points in miles (haversine).
export function distanceMiles(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h))
}

// Capture device location ONCE. Resolves with {lat,lng,accuracy} or null on
// failure/denial — the clock action must NEVER be blocked by GPS.
export function captureLocation() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ ok: false, reason: 'unsupported', coords: null })
      return
    }
    let settled = false
    const done = (v) => {
      if (!settled) {
        settled = true
        resolve(v)
      }
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        done({
          ok: true,
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        }),
      (err) => done({ ok: false, reason: err.code === 1 ? 'denied' : 'error', coords: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    )
    // Hard safety net so a hung GPS request can't freeze the punch.
    setTimeout(() => done({ ok: false, reason: 'timeout', coords: null }), 9000)
  })
}
