# RouteForge

Static web app: build print-ready route posters over OpenStreetMap (**Carto** tiles + **Nominatim** geocoding — no API keys). Hosted as static files only: **`docs/`** is the site root.

Saved posters (route, overlays, map style, logo) are kept in **localStorage** on the device (Text tab → **Saved posters**). Up to 24 projects; not synced between browsers or devices.

## Run locally

```bash
cd docs
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Icons / PWA

Regenerate icons (optional):

```bash
python3 scripts/generate_pwa_icons.py
```

## Deploy

Configured for Render static publish: `staticPublishPath: docs/` (see `render.yaml`).
