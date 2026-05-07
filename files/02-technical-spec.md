# RouteForge — Technical Specification
Version 1.0 | May 2026

---

## 1. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS | No build step. Instant local dev. Deploys as static site on Render free tier. |
| Map | Leaflet.js 1.9 (CDN) | Lightweight, no API key, works with any tile provider. |
| Map Tiles | Stadia Maps (free tier) | Beautiful dark/light tile sets. 200k req/month free. No billing info needed. |
| Geocoding | Nominatim (OSM) | Free, global, no API key. Proxied via FastAPI for rate limiting. |
| Routing | OSRM public instance | Free. Returns GeoJSON route + distance + duration. Foot/bike/car profiles. |
| Backend | FastAPI (Python 3.12) | Async, minimal, fast startup. Handles proxying, caching, theme configs. |
| Export | dom-to-image-more (CDN) | Client-side PNG capture of map + overlays. No server needed for v1. |
| Hosting | Render.com | Free static site + free web service. Auto-deploys from GitHub on push. |
| Fonts | Google Fonts (CDN) | 10 curated families. Only selected font is fetched at runtime. |
| Drag/drop | interact.js (CDN) | Smooth drag-to-reposition for stats card and logo overlay. |

---

## 2. Project File Structure

```
routeforge/
├── frontend/
│   ├── index.html              # App shell — all panels, map container, overlays
│   ├── css/
│   │   ├── app.css             # Layout, glass panels, Apple UI design tokens
│   │   ├── themes.css          # CSS custom properties per theme
│   │   └── poster.css          # Stats card, branding zone, overlay styles
│   ├── js/
│   │   ├── api.js              # fetch() wrapper — all backend calls go here
│   │   ├── map.js              # Leaflet init, tile switching, route drawing
│   │   ├── builder.js          # Input panel logic: start/end/waypoints/presets/generate
│   │   ├── poster.js           # Stats card drag, stat toggles, font picker, logo upload
│   │   ├── themes.js           # Theme switcher, CSS variable injection
│   │   └── export.js           # dom-to-image PNG capture and download
│   └── assets/
│       └── presets.json        # Toronto preset route definitions
│
├── backend/
│   ├── main.py                 # FastAPI app, CORS config, router registration
│   ├── routers/
│   │   ├── geocode.py          # POST /geocode  — Nominatim proxy + LRU cache
│   │   ├── route.py            # POST /route    — OSRM proxy + LRU cache
│   │   └── templates.py        # GET  /templates — serve theme JSON configs
│   ├── themes/
│   │   ├── midnight.json
│   │   ├── daylight.json
│   │   ├── blueprint.json
│   │   ├── sepia.json
│   │   └── monochrome.json
│   ├── cache.py                # Simple LRU cache with optional TTL
│   └── requirements.txt
│
├── render.yaml                 # Render.com deploy config (both services)
├── .env.example
└── README.md
```

---

## 3. Backend API Endpoints

### POST /geocode

Converts one or more address strings to GPS coordinates. Calls Nominatim with a 1.1s minimum delay between requests. Results are cached by address string.

Request body:
```json
{
  "addresses": ["Toronto Music Garden", "Distillery District, Toronto"]
}
```

Response:
```json
{
  "results": [
    {
      "address": "Toronto Music Garden",
      "lat": 43.6385,
      "lon": -79.4015,
      "display_name": "Toronto Music Garden, Queens Quay W, Toronto..."
    },
    {
      "address": "Distillery District, Toronto",
      "lat": 43.6503,
      "lon": -79.3596,
      "display_name": "Distillery District, Toronto..."
    }
  ]
}
```

On failure per address:
```json
{ "error": "not_found", "address": "..." }
```

---

### POST /route

Fetches a route between two or more coordinate pairs from OSRM. Returns the full GeoJSON LineString plus distance and duration.

Request body:
```json
{
  "coordinates": [[43.6385, -79.4015], [43.6503, -79.3596]],
  "profile": "foot"
}
```

Profiles: `foot` | `bike` | `car`

Response:
```json
{
  "geojson": {
    "type": "LineString",
    "coordinates": [[-79.4015, 43.6385], [-79.401, 43.639], ...]
  },
  "distance_m": 3710,
  "duration_s": 2640
}
```

Note: GeoJSON coordinates are [lon, lat] order (GeoJSON standard). Leaflet uses [lat, lon]. The frontend must flip these when passing to Leaflet.

---

### GET /templates

Returns all available themes. Frontend calls this on app load to populate the theme picker.

Response:
```json
{
  "themes": [
    {
      "id": "midnight",
      "label": "Midnight",
      "tileUrl": "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
      "tileAttribution": "&copy; Stadia Maps &copy; OpenStreetMap contributors",
      "routeColor": "#E8FF47",
      "glowColor": "rgba(232, 255, 71, 0.18)",
      "arrowColor": "#E8FF47",
      "startMarkerColor": "#FFFFFF",
      "endMarkerColor": "#E8FF47",
      "posterBg": "#080808",
      "posterText": "#FFFFFF",
      "posterMuted": "rgba(255,255,255,0.38)",
      "statCardBg": "rgba(8,8,8,0.88)",
      "statCardBorder": "rgba(255,255,255,0.10)",
      "defaultFont": "Bebas Neue"
    }
  ]
}
```

---

### GET /health

Returns `{ "status": "ok" }` with HTTP 200. Used by Render uptime monitoring.

---

## 4. Frontend Module Responsibilities

### api.js
Single file for all backend communication. Contains one constant `API_BASE` that switches between localhost and production URL based on `window.location.hostname`.

```js
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://routeforge-backend.onrender.com';

async function geocode(addresses) { ... }
async function fetchRoute(coordinates, profile) { ... }
async function fetchTemplates() { ... }
```

All functions throw on error with a human-readable message so the UI can display it.

---

### map.js
Controls everything Leaflet. Exports these functions:

- `initMap(containerId)` — initialize Leaflet, center on Toronto (43.65, -79.38), zoom 13
- `switchTheme(themeObj)` — remove current tile layer, add new one, update CSS variables
- `drawRoute(geojson, routeColor, glowColor)` — clear previous route layers, draw glow path (weight 18, opacity 0.12) then main path (weight 3.5), add directional arrow markers at 25%, 50%, 75% of route length
- `placeMarkers(startLatLng, endLatLng)` — checkered start marker (white), colored end marker, START/FINISH tooltips
- `fitRoute(geojson)` — fitBounds with 0.15 padding
- `clearRoute()` — remove all route layers and markers

Important: Leaflet tile layer must include `crossOrigin: 'anonymous'` so dom-to-image can capture tiles for PNG export.

---

### builder.js
Controls the left panel. Responsibilities:

- Read and validate start + end inputs
- Manage dynamic waypoints list (add/remove)
- Mode toggle: updates a module-level `currentProfile` variable ('foot'|'bike'|'car')
- Load preset: fills start, end, name, club, date inputs from presets.json
- On Generate click:
  1. Show loading spinner on Generate button
  2. Call `api.geocode([start, ...waypoints, end])`
  3. Call `api.fetchRoute(coords, currentProfile)`
  4. Call `map.drawRoute(...)`, `map.placeMarkers(...)`, `map.fitRoute(...)`
  5. Fire a custom event `routeReady` with `{ distanceM, durationS }` so poster.js can update stats
  6. Hide spinner

---

### poster.js
Controls all poster overlays. Responsibilities:

**Stats card:**
- Listens for `routeReady` event, updates distance and time values
- Distance: convert metres to km with 1 decimal (e.g. "3.7 KM")
- Time: convert seconds to "44 MIN" or "1H 12MIN" format
- Each stat row has a toggle button (✕) that removes that row from the DOM
- A gear icon on the card opens a small popover to re-enable hidden stats
- Card is draggable via interact.js — constrained to map container bounds

**Font picker:**
- `<select>` element with 10 font options
- On change: dynamically inject a `<link rel="stylesheet">` for the Google Fonts URL
- Update `--poster-font` CSS variable on the map container
- All poster overlay text uses `font-family: var(--poster-font)`

**Club branding:**
- Club name text input: on input, update `.branding-name` div text in real time
- Logo upload: `<input type="file" accept="image/png,image/svg+xml">`
  - Client-side size check: reject files > 2MB with a toast message
  - On valid file: read as data URL, set as `<img>` src in `.branding-logo` div
  - Logo div is draggable via interact.js

**Branding zone:**
- Default position: bottom-left of map, 20px inset
- Contains `.branding-logo` (img) and `.branding-name` (div) stacked vertically
- Both independently draggable

---

### themes.js
- On app load: calls `api.fetchTemplates()`, renders theme picker (a row of small clickable swatches)
- On theme select: calls `map.switchTheme(themeObj)`, updates all CSS custom properties on `:root`:
  - `--route-color`, `--glow-color`, `--poster-bg`, `--poster-text`, `--poster-muted`
  - `--stat-card-bg`, `--stat-card-border`
- Active theme swatch gets a border/ring to show selection

---

### export.js
- User clicks "Export PNG" button
- Add class `export-mode` to body (CSS hides all UI chrome: sidebar, topbar, buttons, tooltips)
- Wait 200ms for transitions
- Call `domtoimage.toPng(document.getElementById('map-container'), { scale: 2 })`
- On success: create `<a download="routeforge-[timestamp].png">`, set href to data URL, click it
- Remove `export-mode` class
- Show success toast: "Poster saved"
- Known issue: if tiles aren't loaded yet, the PNG may show gray tiles. The Export button should only be enabled after a route has been generated.

---

## 5. CSS Design Tokens (app.css)

```css
:root {
  /* Surfaces */
  --bg-primary: #F2F2F7;
  --surface-glass: rgba(255, 255, 255, 0.72);
  --surface-card: #FFFFFF;

  /* Borders */
  --border-subtle: rgba(0, 0, 0, 0.08);
  --border-medium: rgba(0, 0, 0, 0.14);

  /* Typography */
  --font-ui: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  --text-primary: #1C1C1E;
  --text-secondary: #6E6E73;
  --text-tertiary: #AEAEB2;

  /* Accent */
  --accent: #007AFF;
  --accent-bg: rgba(0, 122, 255, 0.10);

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-xl: 24px;

  /* Glass */
  --glass-blur: blur(24px) saturate(180%);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1C1C1E;
    --surface-glass: rgba(30, 30, 30, 0.80);
    --surface-card: #2C2C2E;
    --border-subtle: rgba(255, 255, 255, 0.08);
    --border-medium: rgba(255, 255, 255, 0.14);
    --text-primary: #FFFFFF;
    --text-secondary: #8E8E93;
    --text-tertiary: #636366;
  }
}
```

---

## 6. Poster CSS Variables (set dynamically by themes.js)

```css
/* These are set on :root at runtime by themes.js */
--route-color: ...;
--glow-color: ...;
--poster-bg: ...;
--poster-text: ...;
--poster-muted: ...;
--stat-card-bg: ...;
--stat-card-border: ...;
--poster-font: 'Bebas Neue', sans-serif;  /* updated by font picker */
```

The stat card and branding zone should consume these variables, not hardcode any colors.

---

## 7. Layout Structure (index.html)

```
body
└── .app-shell
    ├── .topbar                          (height: 52px, fixed)
    │   ├── .logo
    │   ├── .mode-toggle                 (Run / Bike / Drive pills)
    │   └── .theme-picker               (row of theme swatches)
    │
    └── .app-body                        (height: calc(100vh - 52px), display: flex)
        ├── .left-panel                  (width: 300px, glass, scrollable)
        │   ├── section.route-inputs
        │   │   ├── .input-start
        │   │   ├── .waypoints-list      (dynamic)
        │   │   └── .input-end
        │   ├── section.presets
        │   ├── section.metadata
        │   │   ├── .input-event-name
        │   │   ├── .input-club-name
        │   │   └── .logo-upload
        │   ├── section.customization
        │   │   ├── .font-picker
        │   │   └── .stat-toggles
        │   └── .btn-generate            (bottom of panel, sticky)
        │
        └── .map-wrap                    (flex: 1, position: relative)
            ├── #map                     (width: 100%, height: 100%, Leaflet target)
            ├── .stats-card              (position: absolute, draggable)
            ├── .branding-zone           (position: absolute, bottom-left)
            │   ├── .branding-logo
            │   └── .branding-name
            └── .export-btn              (position: absolute, bottom-right)
```

---

## 8. Stat Card HTML Structure

```html
<div class="stats-card" id="stats-card">
  <div class="stats-card-header">
    <span class="stats-event-name">Morning Run</span>
    <button class="stats-settings-btn" title="Manage stats">⚙</button>
  </div>

  <div class="stat-row" data-stat="distance">
    <span class="stat-icon"><!-- distance SVG --></span>
    <div class="stat-content">
      <div class="stat-label">Distance</div>
      <div class="stat-value" id="stat-dist">—</div>
    </div>
    <button class="stat-remove" aria-label="Remove distance">✕</button>
  </div>

  <div class="stat-row" data-stat="time">
    <span class="stat-icon"><!-- time SVG --></span>
    <div class="stat-content">
      <div class="stat-label">Est. Time</div>
      <div class="stat-value" id="stat-time">—</div>
    </div>
    <button class="stat-remove" aria-label="Remove time">✕</button>
  </div>

  <div class="stat-row" data-stat="surface">
    <span class="stat-icon"><!-- surface SVG --></span>
    <div class="stat-content">
      <div class="stat-label">Surface</div>
      <div class="stat-value" id="stat-surface">Paved</div>
    </div>
    <button class="stat-remove" aria-label="Remove surface">✕</button>
  </div>
</div>
```

Stat card CSS:
```css
.stats-card {
  background: var(--stat-card-bg);
  border: 1px solid var(--stat-card-border);
  border-radius: var(--radius-lg);
  backdrop-filter: var(--glass-blur);
  padding: 14px 18px;
  min-width: 180px;
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 500;
  cursor: grab;
  user-select: none;
}

.stat-label {
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--poster-muted);
  font-family: var(--poster-font);
}

.stat-value {
  font-size: 22px;
  color: var(--poster-text);
  font-family: var(--poster-font);
  line-height: 1.1;
}
```

---

## 9. Backend Implementation Notes

### main.py structure
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import geocode, route, templates
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
        "http://localhost:3000",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(geocode.router)
app.include_router(route.router)
app.include_router(templates.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### Nominatim rate limiting (geocode.py)
```python
import asyncio
import httpx
from functools import lru_cache

_last_nominatim_call = 0.0

async def call_nominatim(address: str) -> dict:
    global _last_nominatim_call
    now = asyncio.get_event_loop().time()
    wait = 1.1 - (now - _last_nominatim_call)
    if wait > 0:
        await asyncio.sleep(wait)
    _last_nominatim_call = asyncio.get_event_loop().time()

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": address, "format": "json", "limit": 1},
            headers={"User-Agent": "RouteForge/1.0"}
        )
    results = resp.json()
    if not results:
        return {"error": "not_found", "address": address}
    r = results[0]
    return {"address": address, "lat": float(r["lat"]), "lon": float(r["lon"]), "display_name": r["display_name"]}
```

### OSRM call (route.py)
```python
async def call_osrm(coordinates: list, profile: str) -> dict:
    coord_str = ";".join(f"{lon},{lat}" for lat, lon in coordinates)
    url = f"https://router.project-osrm.org/route/v1/{profile}/{coord_str}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params={"overview": "full", "geometries": "geojson"})
    data = resp.json()
    if data.get("code") != "Ok":
        raise ValueError("Routing failed")
    route = data["routes"][0]
    return {
        "geojson": route["geometry"],
        "distance_m": route["distance"],
        "duration_s": route["duration"]
    }
```

### requirements.txt
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
httpx==0.27.0
python-multipart==0.0.9
```

---

## 10. CDN Libraries (load in index.html)

```html
<!-- Leaflet -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>

<!-- dom-to-image-more (PNG export) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/dom-to-image-more/2.9.1/dom-to-image-more.min.js"></script>

<!-- interact.js (drag/drop) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/interact.js/1.10.27/interact.min.js"></script>
```

Google Fonts base (override per selection in poster.js):
```html
<link id="google-font-link" rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap"/>
```

---

## 11. Render.com Deploy Config (render.yaml)

```yaml
services:
  - type: web
    name: routeforge-frontend
    env: static
    staticPublishPath: frontend/
    headers:
      - path: /*
        name: Cache-Control
        value: public, max-age=3600

  - type: web
    name: routeforge-backend
    env: python
    buildCommand: pip install -r backend/requirements.txt
    startCommand: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: FRONTEND_URL
        value: https://routeforge-frontend.onrender.com
```

---

## 12. Local Development

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```

No build step. No npm. Edit a file, refresh the browser.

---

## 13. Key Constraints and Gotchas

**Nominatim rate limit:** Never call Nominatim from the browser. Always proxy through FastAPI with the 1.1s sleep guard. Multiple users hitting the endpoint simultaneously must be queued server-side.

**GeoJSON coordinate order:** GeoJSON uses [longitude, latitude]. Leaflet uses [latitude, longitude]. When passing OSRM's GeoJSON coordinates to Leaflet, flip every coordinate pair.

**dom-to-image CORS:** The Leaflet tile layer must be initialized with `crossOrigin: 'anonymous'`. Stadia Maps tiles support CORS. Without this, the PNG export will have blank tile areas.

**Render free tier cold start:** The backend sleeps after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. Show a "Warming up server..." message with a spinner while waiting. Subsequent requests are fast.

**interact.js bounds:** Constrain draggable overlays (stats card, logo) within the map container using `interact.js` `restrict` modifier so they can't be dragged off screen.

**Logo upload:** Enforce 2MB max on the client before reading the file. SVG logos should be rendered as `<img>` (not inline SVG) so they capture correctly in the PNG export.

**Export button visibility:** Only show the Export PNG button after a route has been successfully generated. Before that, the button should either be hidden or disabled with a tooltip "Generate a route first."
