/* === Route Color Presets (only route line color, not map tiles) === */
const ROUTE_COLORS = [
  { id:'white',     label:'White',       routeColor:'#FFFFFF', glowColor:'rgba(255,255,255,0.12)' },
  { id:'neon-yellow',label:'Neon Yellow', routeColor:'#E8FF47', glowColor:'rgba(232,255,71,0.15)' },
  { id:'neon-green', label:'Neon Green',  routeColor:'#39FF14', glowColor:'rgba(57,255,20,0.12)' },
  { id:'coral',      label:'Coral',       routeColor:'#FF6B6B', glowColor:'rgba(255,107,107,0.12)' },
  { id:'electric',   label:'Electric',    routeColor:'#00D4FF', glowColor:'rgba(0,212,255,0.12)' },
  { id:'amber',      label:'Amber',       routeColor:'#FFB340', glowColor:'rgba(255,179,64,0.12)' },
  { id:'violet',     label:'Violet',      routeColor:'#B57AFF', glowColor:'rgba(181,122,255,0.12)' },
  { id:'hot-pink',   label:'Hot Pink',    routeColor:'#FF2D9B', glowColor:'rgba(255,45,155,0.12)' },
  { id:'deep-red',   label:'Deep Red',    routeColor:'#C00000', glowColor:'rgba(192,0,0,0.14)' },
  { id:'sand',       label:'Sand',        routeColor:'#F2CC8F', glowColor:'rgba(242,204,143,0.18)' },
];

// All tile URLs use CartoDB (Carto) — free, no API key, no rate limit.
// Subdomains a–d are declared on the tile layer (see map.js switchTileUrl).
const MAP_STYLES = [
  { id:'dark',  label:'Dark',  tileUrl:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',           mapBg:'#0a0a0a' },
  { id:'light', label:'Light', tileUrl:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',          mapBg:'#f0f0f0' },
  { id:'warm',  label:'Warm',  tileUrl:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', mapBg:'#e8e4dc' },
];

let currentRoutePreset = ROUTE_COLORS[0];
let currentMapStyle = MAP_STYLES[0];

async function initThemes() {
  renderRouteColorGrid();
  renderMapStyleGrid();
  applyRouteColor(ROUTE_COLORS[0]);
  applyMapStyle(MAP_STYLES[0]);
}

function renderRouteColorGrid() {
  const grid = document.getElementById('route-color-grid');
  if (!grid) return;
  grid.innerHTML = '';
  ROUTE_COLORS.forEach((rc, i) => {
    const card = document.createElement('div');
    card.className = 'theme-card' + (i===0?' active':'');
    card.innerHTML = `<div class="theme-dot" style="background:${rc.routeColor};border:2px solid rgba(255,255,255,0.2)"></div><div class="theme-name">${rc.label}</div>`;
    card.addEventListener('click', () => {
      grid.querySelectorAll('.theme-card').forEach(x=>x.classList.remove('active'));
      card.classList.add('active');
      applyRouteColor(rc);
    });
    grid.appendChild(card);
  });
}

function renderMapStyleGrid() {
  const grid = document.getElementById('map-style-grid');
  if (!grid) return;
  grid.innerHTML = '';
  MAP_STYLES.forEach((ms, i) => {
    const card = document.createElement('div');
    card.className = 'theme-card' + (i===0?' active':'');
    card.innerHTML = `<div class="theme-dot" style="background:${ms.mapBg};border:2px solid rgba(128,128,128,0.3)"></div><div class="theme-name">${ms.label}</div>`;
    card.addEventListener('click', () => {
      grid.querySelectorAll('.theme-card').forEach(x=>x.classList.remove('active'));
      card.classList.add('active');
      applyMapStyle(ms);
    });
    grid.appendChild(card);
  });
}

function applyRouteColor(rc) {
  currentRoutePreset = rc;
  document.documentElement.style.setProperty('--route-color', rc.routeColor);
  document.documentElement.style.setProperty('--glow-color', rc.glowColor);
  if (window.currentRouteData) {
    drawRoute(window.currentRouteData.geojson);
    if (window.refreshMarkers) window.refreshMarkers();
    setTimeout(() => { if (window.updatePosterPreview) window.updatePosterPreview(); }, 600);
  }
}

function applyMapStyle(ms) {
  currentMapStyle = ms;
  switchTileUrl(ms.tileUrl);
  // Update the CSS variable — vignette strips and #app bg use this automatically
  document.documentElement.style.setProperty('--poster-bg', ms.mapBg);
  document.getElementById('app').style.background = ms.mapBg;
  // Optional CSS filter class per style (none of the current styles use one)
  const mapEl = document.getElementById('map');
  if (mapEl) {
    mapEl.dataset.filterClass && mapEl.classList.remove(mapEl.dataset.filterClass);
    mapEl.dataset.filterClass = ms.filterClass || '';
    if (ms.filterClass) mapEl.classList.add(ms.filterClass);
  }
  // NOTE: poster-frame intentionally stays transparent so the live Leaflet
  // map shows through it. Do NOT set poster-frame.style.background here.
  setTimeout(() => { if (window.updatePosterPreview) window.updatePosterPreview(); }, 600);
}

window.getCurrentTheme = () => ({
  routeColor: currentRoutePreset.routeColor,
  glowColor: currentRoutePreset.glowColor,
  posterBg: currentMapStyle.mapBg,
  posterText: '#FFFFFF',
  posterMuted: 'rgba(255,255,255,0.5)',
});
window.getRouteColor = () => currentRoutePreset.routeColor;
window.getGlowColor = () => currentRoutePreset.glowColor;

function _syncThemeGridActive() {
  const rg = document.getElementById('route-color-grid');
  if (rg) {
    ROUTE_COLORS.forEach((rc, i) => {
      const c = rg.children[i];
      if (c) c.classList.toggle('active', rc.id === currentRoutePreset.id);
    });
  }
  const mg = document.getElementById('map-style-grid');
  if (mg) {
    MAP_STYLES.forEach((ms, i) => {
      const c = mg.children[i];
      if (c) c.classList.toggle('active', ms.id === currentMapStyle.id);
    });
  }
}

window.getThemeIds = () => ({
  route: currentRoutePreset.id,
  map: currentMapStyle.id,
});

/** Re-apply route + map themes by id (updates grid selection). */
window.applyThemeIds = function (routeId, mapId) {
  const rc = ROUTE_COLORS.find((r) => r.id === routeId) || ROUTE_COLORS[0];
  const ms = MAP_STYLES.find((m) => m.id === mapId) || MAP_STYLES[0];
  applyRouteColor(rc);
  applyMapStyle(ms);
  _syncThemeGridActive();
};