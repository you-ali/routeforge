let routeNodes = [];
Object.defineProperty(window, '_routeNodes', { get: () => routeNodes });
window.isDrawingMode = false;
let routeTimer = null, startStyle = 'pin', endStyle = 'flag';

// Frame heights for each aspect ratio (width is always 1080)
const FRAME_H = { portrait: 1350, square: 1080, landscape: 566 };
let _currentSize = 'portrait';

document.addEventListener('DOMContentLoaded', async () => {
  initMap('map');
  await initThemes();
  initDrawerTabs();
  initDrawer();
  addNode(); addNode();

  document.getElementById('btn-toggle-draw').addEventListener('click', () => {
    window.isDrawingMode = !window.isDrawingMode;
    applyDrawMode();
    updateBanner();
    // Close the drawer when starting to draw so the map is fully visible
    if (window.isDrawingMode) collapseDrawer();
  });

  document.getElementById('btn-stop-draw').addEventListener('click', () => {
    window.isDrawingMode = false;
    applyDrawMode();
  });

  // FAB mirrors the draw toggle
  document.getElementById('fab').addEventListener('click', () => {
    window.isDrawingMode = !window.isDrawingMode;
    applyDrawMode();
    updateBanner();
    if (window.isDrawingMode) collapseDrawer();
  });

  window.onMapClick = async (lat, lng) => {
    window._pushUndo?.();
    // Claim a node synchronously so rapid clicks each get their own slot
    const empty = routeNodes.find(n => !n.lat);
    if (empty) { empty.lat = lat; empty.lng = lng; empty.address = '…'; }
    else routeNodes.push({ id: uid(), address: '…', lat, lng });
    renderNodes(); triggerRoute();
    // Fetch display address in the background and update label only
    updateBanner('Looking up address…');
    const geo = await reverseGeocode(lat, lng);
    const node = routeNodes.find(n => n.lat === lat && n.lng === lng);
    if (node) { node.address = geo.display_name; renderNodes(); }
    updateBanner();
  };

  // Icon pickers
  document.querySelectorAll('#start-icon-picker .icn').forEach(o => o.addEventListener('click', () => {
    document.querySelectorAll('#start-icon-picker .icn').forEach(x => x.classList.remove('active'));
    o.classList.add('active'); startStyle = o.dataset.icon; refreshMarkers();
  }));
  document.querySelectorAll('#end-icon-picker .icn').forEach(o => o.addEventListener('click', () => {
    document.querySelectorAll('#end-icon-picker .icn').forEach(x => x.classList.remove('active'));
    o.classList.add('active'); endStyle = o.dataset.icon; refreshMarkers();
  }));

  document.getElementById('btn-add-node').addEventListener('click', () => { addNode(); renderNodes(); });

  // Reset
  document.getElementById('btn-reset').addEventListener('click', () =>
    document.getElementById('reset-confirm').style.display = 'block'
  );
  document.getElementById('confirm-yes').addEventListener('click', () => {
    routeNodes = []; addNode(); addNode();
    window.currentRouteData = null; clearRoute();
    window.setStatVal?.('dist', '—');
    window.setStatVal?.('time', '—');
    document.getElementById('poster-map-img').style.display = 'none';
    document.getElementById('reset-confirm').style.display = 'none';
    renderNodes();
    // Reset peek
    setPeekStats('—', '—');
  });
  document.getElementById('confirm-no').addEventListener('click', () =>
    document.getElementById('reset-confirm').style.display = 'none'
  );

  // Format / aspect-ratio picker — rescale all overlay positions before switching
  const CAPTURE_H_MAP = { portrait: 937, square: 750, landscape: 422 };
  document.querySelectorAll('#sz-pick .sz').forEach(b => b.addEventListener('click', () => {
    const newSize = b.dataset.size;
    if (newSize !== _currentSize) {
      window.rescaleElements?.(FRAME_H[_currentSize], FRAME_H[newSize]);
      _currentSize = newSize;
    }
    document.querySelectorAll('#sz-pick .sz').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById('poster-frame').className = 'size-' + newSize;
    // Resize the hidden capture map to match the new aspect ratio before
    // triggering a new preview so the captured image has the right proportions.
    const captureMapEl = document.getElementById('capture-map');
    if (captureMapEl) {
      captureMapEl.style.height = (CAPTURE_H_MAP[newSize] || 937) + 'px';
      window._captureMap?.invalidateSize({ animate: false });
    }
    requestAnimationFrame(() => window.scalePoster?.());
  }));

  window.addEventListener('resize', () => requestAnimationFrame(() => window.scalePoster?.()));
});

function uid() { return Date.now() + Math.random(); }
function addNode(addr = '', lat = null, lng = null) { routeNodes.push({ id: uid(), address: addr, lat, lng }); }

function renderNodes() {
  const list = document.getElementById('route-nodes-list');
  list.innerHTML = '';
  routeNodes.forEach((n, i) => {
    const isS = i === 0, isE = i === routeNodes.length - 1 && routeNodes.length > 1;
    const bg = isS ? '#34C759' : isE ? '#FF3B30' : '#007AFF';
    const lbl = isS ? 'S' : isE ? 'F' : i;
    const d = document.createElement('div'); d.className = 'nd';
    d.innerHTML = `<div class="nd-badge" style="background:${bg}">${lbl}</div><input class="nd-input" type="text" value="${n.address}" placeholder="${isS ? 'Start address…' : isE ? 'End address…' : 'Via point…'}"><button class="nd-del">✕</button>`;
    d.querySelector('input').addEventListener('change', e => handleAddrChange(n.id, e.target.value));
    d.querySelector('.nd-del').addEventListener('click', () => {
      window._pushUndo?.();
      routeNodes = routeNodes.filter(x => x.id !== n.id);
      if (!routeNodes.length) { addNode(); addNode(); }
      renderNodes(); triggerRoute();
    });
    list.appendChild(d);
  });
  refreshMarkers();
  // Enable Clear All only when at least one node has coordinates placed
  const hasPoints = routeNodes.some(n => n.lat && n.lng);
  const btnReset = document.getElementById('btn-reset');
  if (btnReset) { btnReset.disabled = !hasPoints; btnReset.style.opacity = hasPoints ? '' : '0.35'; }
}

async function handleAddrChange(id, address) {
  const n = routeNodes.find(x => x.id === id); if (!n) return;
  n.address = address;
  if (!address.trim()) { n.lat = null; n.lng = null; renderNodes(); triggerRoute(); return; }
  try {
    const g = await geocode([address]);
    if (g.results[0] && !g.results[0].error) { n.lat = g.results[0].lat; n.lng = g.results[0].lon; triggerRoute(); }
  } catch (e) {}
}

function refreshMarkers() {
  const valid = routeNodes.filter(n => n.lat && n.lng);
  placeEditMarkers(valid, startStyle, endStyle, async (id, lat, lng, addr) => {
    window._pushUndo?.();
    const n = routeNodes.find(x => x.id === id);
    if (n) { n.lat = lat; n.lng = lng; n.address = addr; renderNodes(); triggerRoute(); }
  });
}
window.refreshMarkers = refreshMarkers;

window._restoreRouteNodes = function(nodes) {
  routeNodes = JSON.parse(JSON.stringify(nodes));
  renderNodes();
  refreshMarkers();
  triggerRoute();
};

// Haversine distance (metres)
function haversine(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const lat1 = a.lat * r, lat2 = b.lat * r;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Straight-line geodesic routing (Google Maps "Measure distance" style)
function buildStraightRoute(nodes) {
  const coords = nodes.map(n => [n.lng, n.lat]);
  let dist = 0;
  for (let i = 1; i < nodes.length; i++) dist += haversine(nodes[i - 1], nodes[i]);
  const pace = 10 / 60 / 60; // 10 km/h
  return {
    geojson: { type: 'LineString', coordinates: coords },
    distance_m: dist,
    duration_s: dist / (pace * 1000)
  };
}

function triggerRoute() { clearTimeout(routeTimer); routeTimer = setTimeout(doRoute, 400); }

function doRoute() {
  const valid = routeNodes.filter(n => n.lat && n.lng);
  if (valid.length < 2) { window.currentRouteData = null; clearRoute(); refreshMarkers(); return; }
  const rd = buildStraightRoute(valid);
  window.currentRouteData = { geojson: rd.geojson, coords: valid.map(n => [n.lat, n.lng]) };
  drawRoute(rd.geojson); refreshMarkers();

  const distText = `${(rd.distance_m / 1000).toFixed(1)} KM`;
  const m = Math.round(rd.duration_s / 60);
  const timeText = m < 60 ? `${m} MIN` : `${Math.floor(m / 60)}H ${m % 60 ? m % 60 + 'M' : ''}`;

  window.setStatVal?.('dist', distText);
  window.setStatVal?.('time', timeText);
  window.setStatVal?.('surf', 'PAVEMENT');

  // Update the drawer peek stats
  setPeekStats((rd.distance_m / 1000).toFixed(1), String(m));

  // Capture the route for export (delayed so tiles have loaded)
  setTimeout(() => window.updatePosterPreview?.({ resetPan: true }), 800);
}

function setPeekStats(dist, time) {
  const pd = document.getElementById('peek-val-dist');
  const pt = document.getElementById('peek-val-time');
  if (pd) pd.textContent = dist;
  if (pt) pt.textContent = time;
}

function updateBanner(override) {
  const n = routeNodes.filter(x => x.lat).length;
  const el = document.getElementById('draw-banner-text');
  if (el) el.textContent = override || (n === 0 ? 'Tap map to place Start' : n === 1 ? 'Tap to add more points' : n + ' points — tap more or Done');
}

function applyDrawMode() {
  const on = window.isDrawingMode;
  const btn = document.getElementById('btn-toggle-draw');
  const fab = document.getElementById('fab');
  const banner = document.getElementById('draw-banner');
  const label = document.getElementById('draw-label');

  if (on) {
    btn?.classList.add('active');
    if (label) label.textContent = 'Drawing Mode On';
    document.body.classList.add('draw-mode');
    if (banner) banner.style.display = 'flex';
    // FAB: becomes "Done" check mark
    if (fab) {
      fab.classList.add('active');
      fab.title = 'Done drawing';
      fab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    }
  } else {
    btn?.classList.remove('active');
    if (label) label.textContent = 'Start Drawing';
    document.body.classList.remove('draw-mode');
    if (banner) banner.style.display = 'none';
    // FAB: pencil icon
    if (fab) {
      fab.classList.remove('active');
      fab.title = 'Draw route';
      fab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`;
    }
  }
}
window.applyDrawMode = applyDrawMode;

function showToast(msg, dur = 3000) {
  const c = document.getElementById('toasts'), t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; c.appendChild(t);
  setTimeout(() => t.remove(), dur);
}
window.showToast = showToast;

// ── Drawer (bottom-sheet on mobile, sidebar on desktop) ──────────────────────

function collapseDrawer() {
  document.getElementById('drawer')?.classList.remove('expanded');
}

function expandDrawer() {
  document.getElementById('drawer')?.classList.add('expanded');
}

function initDrawer() {
  const drawer = document.getElementById('drawer');
  const handle = document.getElementById('drawer-handle');
  const peek   = document.getElementById('drawer-peek');
  if (!drawer) return;

  // Tap handle or peek row to toggle
  handle?.addEventListener('click', () => drawer.classList.toggle('expanded'));
  peek?.addEventListener('click', () => drawer.classList.add('expanded'));

  // Touch-swipe: quick upward flick expands, downward flick collapses
  let touchStartY = 0;
  drawer.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
  drawer.addEventListener('touchend', e => {
    const dy = touchStartY - e.changedTouches[0].clientY;
    if (dy > 40) expandDrawer();
    else if (dy < -40) collapseDrawer();
  }, { passive: true });

  // On desktop the drawer is always a sidebar — nothing to toggle
}

function initDrawerTabs() {
  document.querySelectorAll('.dtab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.dtab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.dtab-pane').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('dtab-' + t.dataset.tab)?.classList.add('active');
  }));
}
