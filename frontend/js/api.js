const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://routeforge-backend.onrender.com';

async function geocode(addresses) {
  const r = await fetch(`${API_BASE}/geocode`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ addresses })
  });
  if (!r.ok) throw new Error('Geocoding request failed');
  return r.json();
}

async function fetchRoute(coordinates, profile='foot') {
  const r = await fetch(`${API_BASE}/route`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ coordinates, profile })
  });
  if (!r.ok) throw new Error('Routing request failed');
  return r.json();
}

async function fetchTemplates() {
  try {
    const r = await fetch(`${API_BASE}/templates`);
    if (!r.ok) throw new Error();
    return r.json();
  } catch { return { themes: [] }; }
}

async function reverseGeocode(lat, lon) {
  try {
    const r = await fetch(`${API_BASE}/reverse-geocode`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ lat, lon })
    });
    const d = await r.json();
    // Return full object so callers can access city/country_code too
    return { display_name: d.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`, city: d.city||'', country_code: d.country_code||'' };
  } catch {
    return { display_name: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, city:'', country_code:'' };
  }
}
