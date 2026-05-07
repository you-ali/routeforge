// Direct Nominatim calls — no backend required.
// Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
// Fine for low-volume personal / club use (< 1 req/s per user).

const NOMINATIM = 'https://nominatim.openstreetmap.org';

async function geocode(addresses) {
  const results = [];
  for (const address of addresses) {
    try {
      const url = `${NOMINATIM}/search?` +
        new URLSearchParams({ q: address, format: 'json', limit: 1 });
      const r = await fetch(url);
      const data = await r.json();
      if (data.length) {
        const d = data[0];
        results.push({ address, lat: parseFloat(d.lat), lon: parseFloat(d.lon), display_name: d.display_name });
      } else {
        results.push({ error: 'not_found', address });
      }
    } catch {
      results.push({ error: 'network_error', address });
    }
  }
  return { results };
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `${NOMINATIM}/reverse?` +
      new URLSearchParams({ lat, lon, format: 'json' });
    const r = await fetch(url);
    const d = await r.json();
    const addr = d.address || {};
    const city = addr.city || addr.town || addr.village ||
                 addr.municipality || addr.county || '';
    const country_code = (addr.country_code || '').toUpperCase();
    return {
      display_name: d.display_name || `${parseFloat(lat).toFixed(5)}, ${parseFloat(lon).toFixed(5)}`,
      city,
      country_code,
    };
  } catch {
    return {
      display_name: `${parseFloat(lat).toFixed(5)}, ${parseFloat(lon).toFixed(5)}`,
      city: '',
      country_code: '',
    };
  }
}
