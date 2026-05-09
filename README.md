# RouteForge

Static web app: build print-ready route posters over OpenStreetMap (**Carto** tiles + **Nominatim** geocoding — no API keys). Hosted as static files only: **`docs/`** is the site root.

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
