# RouteForge — System Architecture
Version 1.0 | May 2026

---

## 1. System Overview

RouteForge is a two-tier web application: a static frontend and a lightweight FastAPI backend. Both are hosted on Render.com free tier. All external APIs are free and require no authentication keys.

```
┌─────────────────────────────────────────────────┐
│                    BROWSER                      │
└────────────────────┬────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────┐
│           FRONTEND  (Render static site)        │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────┐  │
│  │Route Builder │ │  Map Canvas  │ │ Poster  │  │
│  │ builder.js   │ │   map.js     │ │Studio   │  │
│  │              │ │  + Leaflet   │ │poster.js│  │
│  └──────────────┘ └──────────────┘ └─────────┘  │
│  ┌──────────────┐ ┌──────────────┐              │
│  │Theme Engine  │ │  Export      │              │
│  │ themes.js    │ │  export.js   │              │
│  └──────────────┘ └──────────────┘              │
└────────┬─────────────────────────────┬───────────┘
         │ fetch() /geocode /route      │ fetch() /templates
┌────────▼────────────────────────────▼───────────┐
│           BACKEND  (Render web service)         │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │POST /geocode│ │ POST /route │ │GET /tmpls │  │
│  │Nominatim    │ │ OSRM proxy  │ │theme JSON │  │
│  │proxy + cache│ │   + cache   │ │  configs  │  │
│  └──────┬──────┘ └──────┬──────┘ └───────────┘  │
└─────────┼───────────────┼─────────────────────┘
          │ httpx         │ httpx
┌─────────▼───────────────▼─────────────────────┐
│        EXTERNAL APIs  (free, no keys)          │
│  ┌──────────────┐  ┌──────────────┐            │
│  │  Nominatim   │  │    OSRM      │            │
│  │ (geocoding)  │  │  (routing)   │            │
│  └──────────────┘  └──────────────┘            │
│  ┌──────────────────────────────────────────┐  │
│  │  Stadia Maps tile CDN (direct to browser)│  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

Note: Stadia Maps tiles are loaded directly by the browser through Leaflet. The backend is not involved in tile delivery.

---

## 2. Request Flow — Generate Route

What happens from the moment a user clicks "Generate Route" to the route appearing on the map.

```
Step 1   builder.js
         Reads start + end inputs. Validates not empty.
         Collects waypoints. Shows loading spinner on Generate button.

Step 2   api.js → POST /geocode
         Body: { "addresses": ["start address", "end address"] }
         Awaits response with [lat, lon] for each.

Step 3   FastAPI /geocode
         For each address: checks LRU cache.
         If cache miss: calls Nominatim, waits 1.1s between calls.
         Returns array of { address, lat, lon } results.

Step 4   api.js → POST /route
         Body: { "coordinates": [[lat,lon], [lat,lon]], "profile": "foot" }
         Awaits GeoJSON response.

Step 5   FastAPI /route
         Checks LRU cache keyed on hash(coordinates + profile).
         If cache miss: calls OSRM public routing API.
         Returns { geojson, distance_m, duration_s }.

Step 6   map.js — drawRoute()
         Flips GeoJSON [lon,lat] to Leaflet [lat,lon].
         Clears previous route layers.
         Draws glow layer (weight: 18, opacity: 0.12, color: theme.glowColor).
         Draws main route line (weight: 3.5, color: theme.routeColor).
         Adds directional arrow markers at 25%, 50%, 75% of route.

Step 7   map.js — placeMarkers()
         Adds checkered start marker at start coordinates.
         Adds colored end marker at end coordinates.
         Both get persistent tooltips: "START" / "FINISH".

Step 8   map.js — fitRoute()
         Calls map.fitBounds(routeLayer.getBounds().pad(0.15)).
         Map pans and zooms to show full route.

Step 9   poster.js
         Receives routeReady event with { distanceM, durationS }.
         Updates stat card: 3710 → "3.7 KM", 2640 → "44 MIN".
         Shows stats card if it was hidden.

Step 10  builder.js
         Removes loading spinner. Generate button returns to normal state.
```

Total time (typical): 1–3 seconds for uncached routes. Under 500ms for cached.

---

## 3. Request Flow — Export PNG

PNG export is entirely client-side. The backend is not involved.

```
Step 1   export.js
         User clicks "Export PNG".
         Add class 'export-mode' to body.
         CSS: .export-mode hides .left-panel, .topbar, .export-btn,
              all Leaflet controls and attribution.

Step 2   export.js
         await new Promise(resolve => setTimeout(resolve, 200))
         Wait for CSS transitions to finish.

Step 3   dom-to-image-more
         domtoimage.toPng(document.getElementById('map-container'), { scale: 2 })
         Captures the map div at 2x resolution.
         Leaflet tiles must have crossOrigin: 'anonymous' or tiles will be blank.

Step 4   export.js
         Receives PNG data URL.
         const a = document.createElement('a')
         a.download = `routeforge-${Date.now()}.png`
         a.href = dataUrl
         a.click()
         File saves to user's Downloads folder.

Step 5   export.js
         Remove 'export-mode' class from body. UI reappears.
         Show toast: "Poster saved ✓" for 3 seconds.
```

---

## 4. Caching Strategy

In-memory LRU cache on the FastAPI backend. No Redis, no database needed for v1.

```
Geocode cache
  Key:     hash(address.strip().lower())
  Size:    500 entries max
  TTL:     No expiry — OSM addresses don't change
  Hit:     Return cached lat/lon instantly, no Nominatim call

Route cache
  Key:     hash(str(sorted_coordinates) + profile)
  Size:    200 entries max
  TTL:     24 hours
  Hit:     Return cached GeoJSON instantly, no OSRM call
```

Implementation: use Python's `functools.lru_cache` for the geocode cache. For the route cache with TTL, use a plain dict of `{ key: (result, timestamp) }` and evict on read if `time.time() - timestamp > 86400`.

When the Render service cold-starts, caches are empty. They warm up quickly from real usage.

---

## 5. Frontend Layout (Annotated)

```
┌──────────────────────────────────────────────────────────┐
│  TOPBAR  (height: 52px, position: relative, z-index: 100)│
│  [RouteForge logo]  [Run|Bike|Drive toggle]  [Themes ●●●]│
└──────────────────────────────────────────────────────────┘
┌─────────────────┬────────────────────────────────────────┐
│  LEFT PANEL     │  MAP CANVAS (flex: 1)                  │
│  (width: 300px) │  Leaflet fills 100% width/height       │
│  Glass surface  │                                        │
│  Scrollable     │  ┌──────────────────┐  ← stats-card   │
│                 │  │ 3.7 KM           │    position:abs  │
│  Start ──────── │  │ 44 MIN           │    top-right     │
│  + Waypoint     │  │ Paved            │    draggable     │
│  End ─────────  │  └──────────────────┘                  │
│                 │                                        │
│  [Waterfront]   │    route drawn here                    │
│  [High Park]    │    ═══════════►════════                │
│  [Belt Line]    │                                        │
│                 │  ┌─────────────┐  ← branding-zone     │
│  Event name     │  │ [logo] Club │    position:abs       │
│  Club name      │  └─────────────┘    bottom-left       │
│  [Upload logo]  │                     draggable          │
│  Font: [▼]      │                           [Export PNG] │
│  ☑ Distance     │                                        │
│  ☑ Time         └────────────────────────────────────────┘
│  ☑ Surface
│                 
│  [GENERATE ▶]   ← sticky to panel bottom, accent blue
└─────────────────┘
```

CSS layout:
```css
.app-shell { display: flex; flex-direction: column; height: 100vh; }
.topbar    { height: 52px; flex-shrink: 0; }
.app-body  { flex: 1; display: flex; overflow: hidden; }
.left-panel { width: 300px; flex-shrink: 0; overflow-y: auto; }
.map-wrap  { flex: 1; position: relative; }
#map       { width: 100%; height: 100%; }
```

All overlays inside `.map-wrap` use `position: absolute` and are layered above Leaflet via `z-index: 500+`.

---

## 6. Theme System

Themes live as JSON files in `backend/themes/`. Fetched once on app load via `GET /templates`. Stored in a module-level variable in `themes.js`.

When a theme is selected:
1. `map.switchTheme()` swaps the Leaflet tile layer
2. `themes.js` updates all `--poster-*` and `--stat-card-*` CSS variables on `:root`
3. The stats card, branding zone, and route line color update immediately via CSS cascade

The full theme schema:
```json
{
  "id": "midnight",
  "label": "Midnight",
  "tileUrl": "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
  "tileAttribution": "&copy; <a href='https://stadiamaps.com/'>Stadia Maps</a>",
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
```

All 5 themes:
- midnight:    dark tiles, acid yellow route
- daylight:    light tiles, coral red route
- blueprint:   bright tiles (CSS blue tint), white route
- sepia:       toner tiles (CSS sepia filter), burnt orange route
- monochrome:  toner tiles (no tint), black route

---

## 7. Poster Overlay Z-Index Stack

```
z-index 100   Topbar
z-index 400   Leaflet tile layer (internal)
z-index 450   Leaflet route polylines (internal, set via options)
z-index 480   Leaflet markers + tooltips
z-index 500   Stats card (.stats-card)
z-index 500   Branding zone (.branding-zone)
z-index 510   Export button (.export-btn)
z-index 600   Toast notifications
z-index 1000  Theme picker popover (if open)
```

During export-mode, all UI chrome elements get `display: none`. Only the Leaflet layers and the poster overlays (z-index 500–510) remain visible for the screenshot.

---

## 8. Error States

Every error should be shown as a non-blocking toast at the bottom of the map, not an alert dialog.

| Error | Message shown to user |
|---|---|
| Address not found | "Could not find '[address]'. Try being more specific." |
| Routing failed | "Could not find a route between those points. Try different addresses." |
| Backend cold start (>5s response) | "Warming up server, please wait..." (replace with success on response) |
| Logo file too large | "Logo must be under 2MB. Please try a smaller file." |
| Export failed | "Export failed. Try generating the route again." |
| Network error | "Connection error. Check your internet and try again." |

---

## 9. Environment Variables

Backend (`backend/.env` locally, Render env vars in production):
```
FRONTEND_URL=https://routeforge-frontend.onrender.com
```

Frontend (`frontend/js/api.js` constant, not a .env file):
```js
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://routeforge-backend.onrender.com';
```

No other secrets or API keys. The entire codebase can be public on GitHub.

---

## 10. Render.com Deployment

```yaml
# render.yaml (repo root)
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

Both services deploy automatically on every push to the `main` branch. The frontend deploys in ~30 seconds (it's just static files). The backend takes ~2 minutes to build.

Free tier limits: 750 hours/month per service, backend sleeps after 15min inactivity.

---

## 11. Local Development

```bash
# Clone the repo
git clone https://github.com/your-username/routeforge
cd routeforge

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# Backend running at http://localhost:8000

# Frontend (new terminal)
cd frontend
python -m http.server 3000
# Open http://localhost:3000
```

No npm, no webpack, no build step. Vanilla HTML/CSS/JS served directly from the filesystem.

---

## 12. Key Decisions Log

**Why Vanilla JS instead of React/Vue?**
This is a tool, not a product with complex component state. No build step means instant local dev and zero deploy complexity. The entire frontend is ~5 JS files that a developer can understand in an afternoon.

**Why FastAPI instead of Express/Rails?**
Python is the owner's preference. FastAPI has the cleanest async syntax for making HTTP requests to Nominatim and OSRM. It starts up instantly on Render (unlike some other Python frameworks).

**Why OSRM instead of Google Maps Directions?**
Google Maps costs money once you exceed the free tier. OSRM is completely free, open-source, and built on OSM data which matches Stadia's map tiles. The only risk is the public OSRM server having no SLA — acceptable for v1.

**Why client-side PNG export instead of server-side?**
Eliminates a whole class of infrastructure complexity (headless browser on a server). dom-to-image-more is well-maintained and handles the Leaflet canvas correctly when tiles have CORS headers. Downside: resolution is limited to 2x screen resolution, which is more than sufficient for a poster PNG.

**Why no database?**
v1 has no user accounts and no persistent state. Routes are generated fresh each session. The in-memory cache in FastAPI handles performance. Adding a database is a v2 decision.
