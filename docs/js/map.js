let map, tileLayer, routeLayerGroup, editMarkerGroup;
let captureMap, captureTileLayer, captureRouteGroup, captureMarkerGroup;
let routeWidth = 7;

function buildIcon(type, color, label, isMid) {
  if (isMid) {
    const h = `<svg viewBox="0 0 20 26" width="14" height="18"><path d="M10 1C10 1,1 11,1 16A9 9 0 0 0 19 16C19 11,10 1,10 1Z" fill="${color}"/><circle cx="10" cy="16" r="3.5" fill="rgba(0,0,0,.4)"/></svg>`;
    return L.divIcon({ className: 'midpoint-dot', html: h, iconSize: [14, 18], iconAnchor: [7, 18] });
  }
  let h;
  if (type === 'circle') {
    h = `<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="11" fill="${color}" stroke="rgba(0,0,0,.2)" stroke-width="1.5"/><text x="12" y="16" text-anchor="middle" font-size="9" font-weight="900" fill="white" font-family="sans-serif">${label}</text></svg>`;
    return L.divIcon({ className: '', html: h, iconSize: [22, 22], iconAnchor: [11, 11] });
  }
  if (type === 'flag') {
    h = `<svg viewBox="0 0 26 32" width="24" height="30">
      <line x1="3" y1="1" x2="3" y2="31" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="3" y="1" width="22" height="16" fill="${color}"/>
      <rect x="3"  y="1" width="5.5" height="4" fill="rgba(0,0,0,.75)"/>
      <rect x="14" y="1" width="5.5" height="4" fill="rgba(0,0,0,.75)"/>
      <rect x="8.5" y="5" width="5.5" height="4" fill="rgba(0,0,0,.75)"/>
      <rect x="19.5" y="5" width="5.5" height="4" fill="rgba(0,0,0,.75)"/>
      <rect x="3"  y="9" width="5.5" height="4" fill="rgba(0,0,0,.75)"/>
      <rect x="14" y="9" width="5.5" height="4" fill="rgba(0,0,0,.75)"/>
      <rect x="8.5" y="13" width="5.5" height="4" fill="rgba(0,0,0,.75)"/>
      <rect x="19.5" y="13" width="5.5" height="4" fill="rgba(0,0,0,.75)"/>
    </svg>`;
    return L.divIcon({ className: '', html: h, iconSize: [24, 30], iconAnchor: [3, 30] });
  }
  if (type === 'diamond') {
    h = `<svg viewBox="0 0 22 22" width="22" height="22"><polygon points="11,1 21,11 11,21 1,11" fill="${color}" stroke="rgba(0,0,0,.2)" stroke-width="1.5"/><text x="11" y="15" text-anchor="middle" font-size="8" font-weight="900" fill="white" font-family="sans-serif">${label}</text></svg>`;
    return L.divIcon({ className: '', html: h, iconSize: [22, 22], iconAnchor: [11, 11] });
  }
  // Pin (default)
  h = `<svg viewBox="0 0 26 34" width="24" height="32"><path d="M13 0C6 0 0 6 0 13c0 10 13 21 13 21S26 23 26 13C26 6 20 0 13 0z" fill="${color}" stroke="rgba(0,0,0,.2)" stroke-width="1"/><circle cx="13" cy="13" r="5" fill="rgba(0,0,0,.35)"/></svg>`;
  return L.divIcon({ className: '', html: h, iconSize: [24, 32], iconAnchor: [12, 32] });
}

function getBearing(a, b) {
  const r = Math.PI / 180;
  const y = Math.sin((b[1] - a[1]) * r) * Math.cos(b[0] * r);
  const x = Math.cos(a[0] * r) * Math.sin(b[0] * r) - Math.sin(a[0] * r) * Math.cos(b[0] * r) * Math.cos((b[1] - a[1]) * r);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function initCaptureMap() {
  const el = document.getElementById('capture-map');
  if (!el) return;
  captureMap = L.map(el, { zoomControl: false, attributionControl: false, zoomSnap: 0.5, zoomDelta: 0.5 }).setView([43.65, -79.38], 13);
  captureRouteGroup  = L.layerGroup().addTo(captureMap);
  captureMarkerGroup = L.layerGroup().addTo(captureMap);
  window._captureMap = captureMap;
  window._captureTilesReady = false;
}

function initMap(id) {
  map = L.map(id, { zoomControl: false, attributionControl: false, zoomSnap: 0.5, zoomDelta: 0.5 }).setView([43.65, -79.38], 13);
  routeLayerGroup = L.layerGroup().addTo(map);
  editMarkerGroup = L.layerGroup().addTo(map);
  window._leafletMap = map;
  initCaptureMap();

  map.on('click', e => { if (window.isDrawingMode && window.onMapClick) window.onMapClick(e.latlng.lat, e.latlng.lng); });

  // Zoom/pan controls
  document.getElementById('btn-zi').addEventListener('click', () => map.zoomIn(0.5));
  document.getElementById('btn-zo').addEventListener('click', () => map.zoomOut(0.5));
  document.getElementById('btn-fit').addEventListener('click', fitRoute);

  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    if (e.key === '+' || e.key === '=') map.zoomIn(0.5);
    else if (e.key === '-' || e.key === '_') map.zoomOut(0.5);
    else if (e.key === 'r' || e.key === 'R') fitRoute();
    else if (e.key === 'Escape') { window.isDrawingMode = false; applyDrawMode(); }
  });

  // Map detail — CSS filter on tile pane (visible map only)
  document.getElementById('map-detail-slider').addEventListener('input', e => {
    const v = parseInt(e.target.value), tp = document.querySelector('.leaflet-tile-pane');
    if (!tp) return;
    tp.style.filter  = v < 100 ? `blur(${((100 - v) / 100 * 2.5).toFixed(1)}px)` : 'none';
    tp.style.opacity = (0.3 + (v / 100) * 0.7).toFixed(2);
  });

  // Route width — redraws on both maps
  document.getElementById('route-width-slider').addEventListener('input', e => {
    routeWidth = parseFloat(e.target.value);
    if (window.currentRouteData) drawRoute(window.currentRouteData.geojson);
  });

  // Map angle — CSS perspective (visible map only)
  const angSlider = document.getElementById('map-angle-slider');
  const angVal    = document.getElementById('angle-val');
  angSlider.addEventListener('input', e => {
    const deg = parseInt(e.target.value);
    angVal.textContent = deg + '°';
    const mapEl = document.getElementById('map');
    if (deg === 0) { mapEl.style.transform = ''; mapEl.style.perspective = ''; }
    else { mapEl.style.perspective = '1200px'; mapEl.style.transform = `rotateX(${deg}deg) scale(${1 + deg / 100})`; }
  });
  document.getElementById('btn-reset-angle').addEventListener('click', () => {
    angSlider.value = 0; angVal.textContent = '0°';
    document.getElementById('map').style.transform = '';
    document.getElementById('map').style.perspective = '';
  });
}

window.setRouteWidth = function (w) {
  routeWidth = parseFloat(w) || 7;
  const s = document.getElementById('route-width-slider');
  if (s) s.value = String(routeWidth);
  if (window.currentRouteData) drawRoute(window.currentRouteData.geojson);
};

function applyDrawMode() {
  const on     = window.isDrawingMode;
  const btn    = document.getElementById('btn-toggle-draw');
  const banner = document.getElementById('draw-banner');
  if (on) {
    btn?.classList.add('active');
    const lbl = document.getElementById('draw-label'); if (lbl) lbl.textContent = 'Drawing Mode On';
    document.body.classList.add('draw-mode');
    if (banner) banner.style.display = 'flex';
  } else {
    btn?.classList.remove('active');
    const lbl = document.getElementById('draw-label'); if (lbl) lbl.textContent = 'Start Drawing';
    document.body.classList.remove('draw-mode');
    if (banner) banner.style.display = 'none';
  }
}
window.applyDrawMode = applyDrawMode;

function switchTileUrl(url) {
  // Visible map
  if (tileLayer) map.removeLayer(tileLayer);
  tileLayer = L.tileLayer(url, { subdomains: 'abcd', crossOrigin: 'anonymous' }).addTo(map);
  tileLayer.setZIndex(0);
  window._leafletTileLayer = tileLayer;
  window._tilesReady = false;
  tileLayer.on('loading', () => { window._tilesReady = false; });
  tileLayer.on('load',    () => { window._tilesReady = true;  });

  // Capture map — same tiles, independent view
  if (captureMap) {
    if (captureTileLayer) captureMap.removeLayer(captureTileLayer);
    captureTileLayer = L.tileLayer(url, { subdomains: 'abcd', crossOrigin: 'anonymous' }).addTo(captureMap);
    captureTileLayer.setZIndex(0);
    window._captureTilesReady = false;
    captureTileLayer.on('loading', () => { window._captureTilesReady = false; });
    captureTileLayer.on('load',    () => { window._captureTilesReady = true;  });
  }
}
window.switchTileUrl = switchTileUrl;

function hideEditMarkers() { editMarkerGroup.eachLayer(l => { if (!l._isMid) return; const el = l.getElement(); if (el) el.style.visibility = 'hidden'; }); }
function showEditMarkers() { editMarkerGroup.eachLayer(l => { const el = l.getElement(); if (el) el.style.visibility = ''; }); }
window.hideEditMarkers = hideEditMarkers;
window.showEditMarkers = showEditMarkers;

function renderRouteOnGroup(geojson, group) {
  group.clearLayers();
  const coords = geojson.coordinates.map(c => [c[1], c[0]]);
  const rc = window.getRouteColor ? window.getRouteColor() : '#fff';
  const gc = window.getGlowColor  ? window.getGlowColor()  : 'rgba(255,255,255,.1)';
  L.polyline(coords, { color: gc, weight: routeWidth * 4, opacity: .15, lineCap: 'round', lineJoin: 'round' }).addTo(group);
  L.polyline(coords, { color: rc, weight: routeWidth,     opacity: 1,   lineCap: 'round', lineJoin: 'round' }).addTo(group);

  function placeArrow(a, b) {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const br  = getBearing(a, b);
    const h   = `<svg viewBox="0 0 12 14" width="16" height="18" style="display:block;transform:rotate(${br}deg);transform-origin:50% 50%"><path d="M6 0L12 11L6 7.5L0 11Z" fill="${rc}" opacity="0.95"/></svg>`;
    L.marker(mid, { icon: L.divIcon({ className: 'route-arrow-icon', html: h, iconSize: [16, 18], iconAnchor: [8, 9] }), interactive: false, zIndexOffset: 200 }).addTo(group);
  }

  if (coords.length <= 10) {
    for (let i = 0; i < coords.length - 1; i++) placeArrow(coords[i], coords[i + 1]);
  } else {
    const step = Math.max(6, Math.floor(coords.length / 6));
    for (let i = step; i < coords.length - step; i += step) placeArrow(coords[i - 1], coords[i + 1]);
  }
  return coords;
}

function drawRoute(geojson) {
  const coords = renderRouteOnGroup(geojson, routeLayerGroup);

  // Mirror onto the capture map — fit to full route bounds so the export
  // always shows the complete route at a nice zoom level.
  if (captureMap && captureRouteGroup) {
    renderRouteOnGroup(geojson, captureRouteGroup);
    window._captureTilesReady = false;
    captureMap.fitBounds(L.latLngBounds(coords), { padding: [80, 80], animate: false });
  }
}
window.drawRoute = drawRoute;
window.getRouteWidth = () => routeWidth;

function placeEditMarkers(nodes, ss, es, onDrag) {
  editMarkerGroup.clearLayers();
  if (captureMarkerGroup) captureMarkerGroup.clearLayers();
  const color = window.getRouteColor ? window.getRouteColor() : '#fff';
  nodes.forEach((n, i) => {
    if (!n.lat || !n.lng) return;
    const isS = i === 0, isE = i === nodes.length - 1 && nodes.length > 1;
    const isMid = !isS && !isE;
    const icon = isS ? buildIcon(ss, color, 'S') : isE ? buildIcon(es, color, 'F') : buildIcon('dot', color, '', true);
    const m = L.marker([n.lat, n.lng], { icon, draggable: true, zIndexOffset: isS || isE ? 600 : 400 });
    m._isMid = isMid;
    m.on('dragend', async e => { const { lat, lng } = e.target.getLatLng(); const geo = await reverseGeocode(lat, lng); onDrag(n.id, lat, lng, geo.display_name); });
    m.addTo(editMarkerGroup);

    // Mirror start/end onto capture map (no drag handles)
    if (!isMid && captureMarkerGroup) {
      const ci = isS ? buildIcon(ss, color, 'S') : buildIcon(es, color, 'F');
      L.marker([n.lat, n.lng], { icon: ci, interactive: false, zIndexOffset: 600 }).addTo(captureMarkerGroup);
    }
  });
}
window.placeEditMarkers = placeEditMarkers;

function fitRoute() {
  const layers = [...routeLayerGroup.getLayers(), ...editMarkerGroup.getLayers()];
  if (layers.length > 0) map.fitBounds(L.featureGroup(layers).getBounds().pad(0.15));
}
function clearRoute() {
  routeLayerGroup.clearLayers(); editMarkerGroup.clearLayers();
  if (captureRouteGroup)  captureRouteGroup.clearLayers();
  if (captureMarkerGroup) captureMarkerGroup.clearLayers();
}
window.clearRoute = clearRoute;
window.fitRoute   = fitRoute;
