# RouteForge — Product Brief
Version 1.0 | May 2026

---

## 1. What Is This

RouteForge is a minimal web tool that lets runners, cyclists, and run clubs generate beautiful, print-ready route posters from any start and end address. Users pick a route, choose a visual theme, customize their poster with stats, logos, and typography, then export a high-quality PNG — all in under two minutes.

The product is designed to feel like a native Apple app: rounded corners, frosted-glass panels, generous whitespace, and a restrained color palette. Both the app UI and the output poster share this design philosophy — minimal, confident, and beautiful.

**Who is it for:** Runners, cyclists, run clubs, race organizers, fitness enthusiasts who want shareable visual records of their routes.

**Core value:** Enter an address. Get a beautiful poster. No design skills required.

**Hosting:** Render.com — free tier for both frontend (static site) and backend (FastAPI). Publicly accessible.

**Cost to run:** $0 — all external APIs are free with no key required (Nominatim, OSRM, Stadia Maps free tier).

---

## 2. Feature Set — v1.0

### Route Builder
Text input for start address and end address. Optional waypoints (add/remove dynamically). 4 Toronto presets for quick testing and demos.

### Geocode + Routing
Converts addresses to GPS coordinates (Nominatim), then fetches a walking/cycling/driving route as GeoJSON (OSRM). Both are proxied through FastAPI to handle rate limiting and caching. See Section 6 for full explanation of what this means and why it matters.

### Live Map Preview
Leaflet.js map with themed tiles (Stadia Maps). Route drawn as a glowing line with directional arrows. Checkered start marker, colored end marker. Map updates every time Generate is clicked.

### Map Themes
5 creative themes: Midnight (dark), Daylight (light), Blueprint, Sepia, Monochrome. Each theme changes the map tile style, route line color, glow color, and poster color palette — it's a complete visual system, not just a color swap.

### Stats Overlay
A frosted-glass card positioned on the poster showing: distance (km), estimated time, and surface type. The user can:
- Toggle each individual stat on/off
- Drag the card to any position on the map
- The card is excluded from the PNG export chrome (only the map + overlays export)

### PNG Export
Exports the current map view and all overlays as a high-resolution PNG using dom-to-image-more (client-side, no backend needed). Resolution: 2x retina scale.

### Font Picker
Dropdown of 10 curated Google Fonts suited to poster design. Selected font is applied to all poster overlay text. Font is loaded dynamically from Google Fonts CDN on selection.

### Run Club Branding
- Text field for club/event name — appears on the poster
- Logo upload (PNG or SVG, max 2MB) — appears on the poster
- Both are in a designated branding zone (bottom-left by default)
- Logo and club name can be independently repositioned by dragging

### Mode Toggle
Walk / Bike / Drive toggle in the top bar. Changes the OSRM routing profile (foot / bike / car), which affects which streets and paths are used for the route.

### Toronto Presets
4 preset routes that auto-fill all inputs for demos and onboarding:
- Waterfront: Toronto Music Garden → Distillery District
- Harbourfront Loop
- High Park Loop
- Belt Line Trail

---

## 3. Design Philosophy

### App UI — Apple-Inspired Minimalism
The application interface follows Apple Human Interface Guidelines as a design reference.

- Rounded squares (border-radius 12–20px) on all panels, inputs, and buttons
- Frosted-glass left panel: backdrop-filter blur with ~70% opacity fill
- Two-column layout: left glass panel (300px) for controls, right full-bleed map
- Color palette: system grays (#F2F2F7, #E5E5EA, #C6C6C8), iOS blue (#007AFF) as the single accent color
- Typography: -apple-system font stack (SF Pro), Inter as fallback
- No decorative gradients, no drop shadows on chrome elements, no borders except subtle 0.5–1px dividers
- Inputs and buttons have pressed states and focus rings
- The left panel should feel like it's floating above the map — glass, not opaque

### Poster Output — Editorial Minimalism
The poster must look like it was made by a professional graphic designer.

- Large, confident typography for the event name — display weight, generous tracking
- Negative space is intentional — the map breathes, overlays are compact
- Stats card is tight and typographic — no unnecessary decoration
- The route line is the hero of the poster — everything else is supporting detail
- Each theme has a complete typographic and color system
- Logo and club name live in a fixed branding zone, not floating randomly
- When exported, the poster should look like something you'd find printed on a wall at a running expo

---

## 4. Map Themes

Each theme is a complete visual system defined as a JSON config. The developer should implement these 5 for v1.

| Theme | Map Tile Style | Route Color | Vibe |
|---|---|---|---|
| Midnight | Stadia Alidade Smooth Dark | #E8FF47 (acid yellow) | Dark, dramatic, race-poster energy |
| Daylight | Stadia Alidade Smooth | #FF375F (coral red) | Clean, airy, minimal editorial |
| Blueprint | Stadia OSM Bright (CSS blue tint) | #FFFFFF (white) | Technical, architectural, precise |
| Sepia | Stadia Stamen Toner (CSS sepia tint) | #C45C26 (burnt orange) | Vintage, warm, nostalgic |
| Monochrome | Stadia Stamen Toner | #000000 (black) | Stark, graphic, print-ready |

Each theme config also includes: glow color, poster background color, text color, muted text color, stat card background, stat card border color.

---

## 5. Curated Font Palette (10 fonts)

These are loaded from Google Fonts on demand.

| Font | Category | Best for |
|---|---|---|
| Bebas Neue | Display / all-caps | Race posters, bold event names |
| Barlow Condensed | Condensed sans | Stats, labels — pairs with Bebas Neue |
| Playfair Display | Serif editorial | Elegant club names, marathon commemoratives |
| Montserrat | Geometric sans | Clean, universal, works at any size |
| DM Sans | Humanist sans | Modern minimal, excellent legibility on dark maps |
| Space Grotesk | Techy sans | Tech-forward runs, cycling events |
| Oswald | Condensed display | Compact but strong, tight vertical rhythm |
| Cormorant Garamond | Classic serif | Heritage feel, long-distance marathon prestige |
| Syne | Avant-garde | Creative run clubs, art-run crossovers |
| IBM Plex Mono | Monospace | Data-forward, GPS coordinate display |

---

## 6. What is Geocode + Routing? (Explained Simply)

This is the technical core of the product. Here's exactly what happens when a user types an address.

### Step 1 — Geocoding (Address → GPS Coordinates)
Geocoding converts a human-readable address like "Toronto Music Garden" into a GPS coordinate pair: latitude 43.6385, longitude -79.4015.

RouteForge uses **Nominatim**, the free geocoding API from OpenStreetMap. No API key required, works globally. The FastAPI backend proxies all geocoding requests because:
- Nominatim has a strict 1 request/second rate limit. The backend queues and spaces requests automatically.
- Previously geocoded addresses are cached so repeat searches are instant.

### Step 2 — Routing (Coordinates → Path on the Map)
Once we have GPS coordinates for the start and end, routing finds the actual path a person would walk, cycle, or drive between them — following real streets and trails.

RouteForge uses **OSRM** (Open Source Routing Machine), a free routing engine built on OpenStreetMap data. It returns a GeoJSON LineString — a list of lat/lon points that trace the exact route on the map.

The OSRM response also includes total distance in metres and estimated duration in seconds, which feed directly into the stats overlay.

Three routing profiles:
- **foot** — pedestrian/runner paths, trails, sidewalks, avoids highways
- **bike** — cycling network, bike lanes, off-road paths
- **car** — road network only

### Why proxy through a backend?
Both APIs could technically be called from the browser. The FastAPI backend exists because:
1. Nominatim's 1 req/sec policy breaks under any real user load without server-side queuing
2. OSRM may return CORS errors in some browsers without a proxy
3. Caching: the Waterfront preset route never hits the external API twice

---

## 7. Out of Scope — v1.0

Do not build these for v1. They are documented for v2 planning.

- User accounts or saved routes
- Server-side PDF/PNG generation (browser export is sufficient)
- GPX file upload or Strava integration
- Elevation profile data or chart
- Custom map tiles or Mapbox Studio
- Mobile-responsive layout (desktop-first for v1)
- Payment or subscription tier
- Social sharing or short URL generation
- Drag-to-resize the stats card (drag-to-move is enough for v1)
