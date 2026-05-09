/**
 * Library — saved posters in localStorage (no server).
 */
const PROJ_INDEX_KEY = 'routeforge_projects_index_v1';
const PROJ_PREFIX = 'routeforge_project_v1_';
const MAX_PROJECTS = 24;

let _activeProjectId = null;
let _activeProjectName = null;
/** Poster id currently shown in Library detail view */
let _libraryDetailId = null;
let _pendingContinue = null;

function _hasUnsavedChanges() {
  return window._hasUndoablePosterChanges?.() === true;
}

function _readIndex() {
  try {
    return JSON.parse(localStorage.getItem(PROJ_INDEX_KEY) || '[]');
  } catch {
    return [];
  }
}

function _writeIndex(list) {
  localStorage.setItem(PROJ_INDEX_KEY, JSON.stringify(list));
}

function _newId() {
  return (crypto.randomUUID && crypto.randomUUID()) ||
    `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function _captureLogo() {
  const img = document.getElementById('p-logo');
  const hasImg = img && img.style.display !== 'none' && img.getAttribute('src');
  const src = img?.getAttribute('src') || '';
  if (!hasImg || !src) {
    return {
      dataUrl: null,
      size: document.getElementById('logo-size')?.value || '120',
    };
  }
  return {
    dataUrl: src,
    size: document.getElementById('logo-size')?.value || '120',
  };
}

function captureProjectPayload() {
  window._syncTextElsFromDom?.();
  const map = window._leafletMap;
  const center = map?.getCenter();
  const themeIds = window.getThemeIds?.() || { route: 'white', map: 'dark' };
  const core = window._capturePosterCoreState?.();
  return {
    v: 1,
    core: core || {},
    formatSize: window.getFormatSize?.() || 'portrait',
    markerStyles: window.getMarkerStyles?.() || { start: 'pin', end: 'flag' },
    routeColorId: themeIds.route,
    mapStyleId: themeIds.map,
    routeWidth: window.getRouteWidth?.() ?? 7,
    mapDetail: document.getElementById('map-detail-slider')?.value ?? '100',
    mapAngle: document.getElementById('map-angle-slider')?.value ?? '0',
    mapView:
      center && map
        ? { lat: center.lat, lng: center.lng, zoom: map.getZoom() }
        : null,
    layerStats: document.getElementById('layer-stats')?.checked ?? true,
    layerLegend: document.getElementById('layer-legend')?.checked ?? true,
    legendInputs: {
      start: document.getElementById('val-legend-start')?.value ?? 'START',
      finish: document.getElementById('val-legend-finish')?.value ?? 'FINISH',
      wp: document.getElementById('val-legend-wp')?.value ?? 'WAYPOINT',
    },
    logo: _captureLogo(),
  };
}

function _applyLogo(saved) {
  const pLogo = document.getElementById('p-logo');
  const preview = document.getElementById('logo-preview');
  const rmBtn = document.getElementById('btn-remove-logo');
  const szInp = document.getElementById('logo-size');
  if (!pLogo) return;
  if (saved?.dataUrl) {
    pLogo.src = saved.dataUrl;
    pLogo.style.display = 'block';
    if (preview) {
      preview.src = saved.dataUrl;
      preview.style.display = 'block';
    }
    if (rmBtn) rmBtn.style.display = '';
    const s = saved.size || '120';
    if (szInp) szInp.value = s;
    document.documentElement.style.setProperty('--logo-size', `${s}px`);
  } else {
    pLogo.removeAttribute('src');
    pLogo.style.display = 'none';
    if (preview) {
      preview.removeAttribute('src');
      preview.style.display = 'none';
    }
    if (rmBtn) rmBtn.style.display = 'none';
  }
}

function _applyLayerVisibility(layerStats, layerLegend) {
  const statsEl = document.getElementById('p-stats');
  const legEl = document.getElementById('p-legend');
  const stChk = document.getElementById('layer-stats');
  const lgChk = document.getElementById('layer-legend');
  if (stChk) stChk.checked = !!layerStats;
  if (lgChk) lgChk.checked = !!layerLegend;
  if (statsEl) {
    if (layerStats) {
      statsEl.style.display = 'flex';
      window._updateStats?.();
    } else statsEl.style.display = 'none';
  }
  if (legEl) {
    if (layerLegend) legEl.style.display = '';
    else legEl.style.display = 'none';
  }
  window._onStatsVisChange?.();
  window._onLegVisChange?.();
}

function restoreProjectPayload(data) {
  if (!data || data.v !== 1) return;
  const core = data.core && typeof data.core === 'object' ? data.core : {};
  window._clearUndoHistory?.();

  window.setFormatSizeNoRescale?.(data.formatSize || 'portrait');
  window.applyThemeIds?.(
    data.routeColorId || 'white',
    data.mapStyleId || 'dark'
  );
  window.setMarkerStyles?.(data.markerStyles?.start, data.markerStyles?.end);
  window.setRouteWidth?.(data.routeWidth ?? 7);

  const md = document.getElementById('map-detail-slider');
  if (md && data.mapDetail != null) {
    md.value = String(data.mapDetail);
    md.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const ma = document.getElementById('map-angle-slider');
  const av = document.getElementById('angle-val');
  const mapEl = document.getElementById('map');
  if (ma && data.mapAngle != null && mapEl) {
    ma.value = String(data.mapAngle);
    const deg = parseInt(data.mapAngle, 10) || 0;
    if (av) av.textContent = `${deg}°`;
    if (deg === 0) {
      mapEl.style.transform = '';
      mapEl.style.perspective = '';
    } else {
      mapEl.style.perspective = '1200px';
      mapEl.style.transform = `rotateX(${deg}deg) scale(${1 + deg / 100})`;
    }
  }

  if (data.legendInputs) {
    const m = data.legendInputs;
    [
      ['val-legend-start', m.start],
      ['val-legend-finish', m.finish],
      ['val-legend-wp', m.wp],
    ].forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val != null) {
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  window._restorePosterCoreState?.(core);

  _applyLogo(data.logo);
  _applyLayerVisibility(data.layerStats !== false, data.layerLegend !== false);

  const map = window._leafletMap;
  if (map && data.mapView && typeof data.mapView.lat === 'number') {
    requestAnimationFrame(() => {
      map.setView([data.mapView.lat, data.mapView.lng], data.mapView.zoom, {
        animate: false,
      });
    });
  }

  setTimeout(() => window.updatePosterPreview?.({ resetPan: true }), 900);
}

async function _thumbForPayload() {
  return (await window.buildLibraryThumbnail?.()) || '';
}

function _mergeIndexEntry(list, entry) {
  const idx = list.findIndex((p) => p.id === entry.id);
  if (idx >= 0) list[idx] = entry;
  else list.unshift(entry);
}

async function saveCurrentProject(name) {
  const id = _newId();
  const thumb = await _thumbForPayload();
  const payload = {
    ...captureProjectPayload(),
    id,
    thumb,
    name: (name || 'Untitled').trim().slice(0, 80),
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(PROJ_PREFIX + id, JSON.stringify(payload));
  } catch (e) {
    if (e && e.name === 'QuotaExceededError') {
      window.showToast?.(
        'Storage full — use a smaller logo or delete old posters'
      );
    } else window.showToast?.('Could not save');
    return null;
  }
  let list = _readIndex();
  _mergeIndexEntry(list, {
    id,
    name: payload.name,
    updatedAt: payload.updatedAt,
    thumb: thumb || '',
  });
  while (list.length > MAX_PROJECTS) {
    const rem = list.pop();
    localStorage.removeItem(PROJ_PREFIX + rem.id);
  }
  _writeIndex(list);
  _activeProjectId = id;
  _activeProjectName = payload.name;
  return id;
}

/** @param {string} [newName] If set, updates the Library title. Omit to keep current name. */
async function updateActiveProject(newName) {
  if (newName != null && String(newName).trim() !== '') {
    _activeProjectName = String(newName).trim().slice(0, 80);
  }
  if (!_activeProjectId) {
    const id = await saveCurrentProject(_activeProjectName || 'Untitled');
    return id != null;
  }
  const thumb = await _thumbForPayload();
  const payload = {
    ...captureProjectPayload(),
    id: _activeProjectId,
    thumb,
    name: (_activeProjectName || 'Untitled').trim().slice(0, 80),
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(PROJ_PREFIX + _activeProjectId, JSON.stringify(payload));
  } catch (e) {
    if (e && e.name === 'QuotaExceededError') {
      window.showToast?.(
        'Storage full — use a smaller logo or delete old posters'
      );
    } else window.showToast?.('Could not save');
    return false;
  }
  let list = _readIndex();
  _mergeIndexEntry(list, {
    id: _activeProjectId,
    name: payload.name,
    updatedAt: payload.updatedAt,
    thumb: thumb || '',
  });
  _writeIndex(list);
  _activeProjectName = payload.name;
  return true;
}

function loadProject(id) {
  const raw = localStorage.getItem(PROJ_PREFIX + id);
  if (!raw) {
    window.showToast?.('Poster not found');
    return;
  }
  try {
    const data = JSON.parse(raw);
    restoreProjectPayload(data);
    _activeProjectId = data.id;
    _activeProjectName = data.name;
    window.showToast?.('Editing “' + (data.name || 'Poster') + '”');
    renderLibraryGrid();
  } catch {
    window.showToast?.('Could not load poster');
  }
}

function deleteProject(id) {
  localStorage.removeItem(PROJ_PREFIX + id);
  _writeIndex(_readIndex().filter((p) => p.id !== id));
  if (_activeProjectId === id) {
    _activeProjectId = null;
    _activeProjectName = null;
  }
  if (_libraryDetailId === id) {
    closeLibraryFullscreen();
  }
  renderLibraryGrid();
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function _placeholderSvg(name) {
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="400" viewBox="0 0 320 400">` +
    `<rect width="320" height="400" fill="#2a2a2e"/>` +
    `<text x="160" y="220" text-anchor="middle" fill="#666" font-size="72" font-weight="700" ` +
    `font-family="system-ui,sans-serif">${escapeHtml(letter)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function closeLibraryFullscreen() {
  document.removeEventListener('keydown', _libraryFsKeydown);
  _libraryDetailId = null;
  const root = document.getElementById('library-fullscreen');
  const img = document.getElementById('library-fs-img');
  if (root) root.hidden = true;
  if (img) {
    img.removeAttribute('src');
    img.alt = '';
  }
}

function _libraryFsKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeLibraryFullscreen();
  }
}

function openLibraryFullscreen(meta) {
  if (!meta || !meta.id) return;
  _libraryDetailId = meta.id;
  const root = document.getElementById('library-fullscreen');
  const img = document.getElementById('library-fs-img');
  const title = document.getElementById('library-fs-title');
  const submeta = document.getElementById('library-fs-meta');
  if (!root || !img || !title) return;
  img.src = meta.thumb || _placeholderSvg(meta.name);
  img.alt = meta.name || 'Poster';
  title.textContent = meta.name || 'Untitled';
  const d = new Date(meta.updatedAt);
  if (submeta) {
    submeta.textContent = Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
  }
  root.hidden = false;
  document.addEventListener('keydown', _libraryFsKeydown);
}

function _closeUnsavedModal() {
  const m = document.getElementById('library-unsaved-modal');
  if (m) m.hidden = true;
  _pendingContinue = null;
}

function _openUnsavedModal(onContinue) {
  _pendingContinue = onContinue;
  const m = document.getElementById('library-unsaved-modal');
  if (m) m.hidden = false;
}

function runWithUnsavedGuard(onContinue) {
  if (!_hasUnsavedChanges()) {
    onContinue();
    return;
  }
  _openUnsavedModal(onContinue);
}

async function _unsavedSaveAndContinue() {
  if (_activeProjectId) {
    await updateActiveProject();
  } else {
    const name =
      _activeProjectName?.trim() ||
      `Poster ${new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
    await saveCurrentProject(name);
  }
  const fn = _pendingContinue;
  _pendingContinue = null;
  const m = document.getElementById('library-unsaved-modal');
  if (m) m.hidden = true;
  if (fn) fn();
}

function _unsavedDiscardAndContinue() {
  const fn = _pendingContinue;
  _pendingContinue = null;
  const m = document.getElementById('library-unsaved-modal');
  if (m) m.hidden = true;
  if (fn) fn();
}

function _saveModalEscape(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    _closeSaveToLibraryModal();
  }
}

function _closeSaveToLibraryModal() {
  document.removeEventListener('keydown', _saveModalEscape);
  const m = document.getElementById('save-to-library-modal');
  if (m) m.hidden = true;
}

function _openSaveToLibraryModal() {
  const m = document.getElementById('save-to-library-modal');
  const inp = document.getElementById('save-to-library-name');
  if (!m || !inp) return;
  inp.value = _activeProjectName?.trim() || '';
  m.hidden = false;
  document.addEventListener('keydown', _saveModalEscape);
  requestAnimationFrame(() => {
    inp.focus();
    inp.select();
  });
}

async function _commitSaveToLibraryFromModal() {
  const inp = document.getElementById('save-to-library-name');
  const name = (inp?.value || '').trim();
  if (!name) {
    window.showToast?.('Enter a name');
    inp?.focus();
    return;
  }
  const prevName = (_activeProjectName || '').trim();
  const saveAsNewCopy =
    !_activeProjectId || name.toLowerCase() !== prevName.toLowerCase();
  let ok = false;
  let isNew = false;
  if (saveAsNewCopy) {
    const id = await saveCurrentProject(name);
    ok = id != null;
    isNew = true;
  } else {
    ok = await updateActiveProject(name);
    isNew = false;
  }
  if (!ok) return;
  _closeSaveToLibraryModal();
  window.showToast?.(isNew ? 'Poster saved' : 'Poster updated');
  renderLibraryGrid();
}

function renderLibraryGrid() {
  const host = document.getElementById('library-grid');
  if (!host) return;
  const list = _readIndex();
  if (_libraryDetailId && !list.some((p) => p.id === _libraryDetailId)) {
    closeLibraryFullscreen();
  }
  host.innerHTML = '';
  if (!list.length) {
    closeLibraryFullscreen();
    host.innerHTML = '<p class="library-empty">No posters saved yet.</p>';
    return;
  }
  list.forEach((meta) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'library-card';
    card.setAttribute('aria-label', `Open ${meta.name || 'poster'}`);
    const thumbSrc = meta.thumb || _placeholderSvg(meta.name);
    const d = new Date(meta.updatedAt);
    const sub = d.toLocaleDateString(undefined, { dateStyle: 'short' });
    card.innerHTML =
      `<span class="library-card-img-wrap">` +
      `<img class="library-card-img" src="${thumbSrc}" alt="" loading="lazy"/>` +
      `</span>` +
      `<span class="library-card-name">${escapeHtml(meta.name)}</span>` +
      `<span class="library-card-date">${sub}</span>`;
    card.addEventListener('click', () => openLibraryFullscreen(meta));
    host.appendChild(card);
  });
}

function _goToEditorTab() {
  document.querySelectorAll('.dtab').forEach((x) =>
    x.classList.toggle('active', x.dataset.tab === 'route')
  );
  document.querySelectorAll('.dtab-pane').forEach((p) =>
    p.classList.toggle('active', p.id === 'dtab-route')
  );
  if (typeof window.collapseDrawer === 'function') window.collapseDrawer();
  else document.getElementById('drawer')?.classList.remove('expanded');
}

function initSaveToLibraryModal() {
  document.getElementById('btn-save-library')?.addEventListener('click', () => {
    _openSaveToLibraryModal();
  });
  document.getElementById('save-to-library-confirm')?.addEventListener('click', () => {
    _commitSaveToLibraryFromModal();
  });
  document.getElementById('save-to-library-discard')?.addEventListener('click', () => {
    _closeSaveToLibraryModal();
  });
  document
    .querySelector('#save-to-library-modal .save-library-backdrop')
    ?.addEventListener('click', () => {
      _closeSaveToLibraryModal();
    });
  document.getElementById('save-to-library-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      _commitSaveToLibraryFromModal();
    }
  });
}

function _exportPosterFromLibrary() {
  const id = _libraryDetailId;
  if (!id) return;
  closeLibraryFullscreen();
  runWithUnsavedGuard(async () => {
    loadProject(id);
    _goToEditorTab();
    await new Promise((r) => setTimeout(r, 1100));
    try {
      await window.doExport?.();
    } catch (_) {
      window.showToast?.('Export failed — try again');
    }
  });
}

function initLibraryPanel() {
  document.getElementById('library-fs-close')?.addEventListener('click', closeLibraryFullscreen);
  document
    .querySelector('#library-fullscreen .library-fs-backdrop')
    ?.addEventListener('click', closeLibraryFullscreen);

  document.getElementById('library-fs-edit')?.addEventListener('click', () => {
    const id = _libraryDetailId;
    if (!id) return;
    runWithUnsavedGuard(() => {
      loadProject(id);
      closeLibraryFullscreen();
      _goToEditorTab();
    });
  });

  document.getElementById('library-fs-delete')?.addEventListener('click', () => {
    const id = _libraryDetailId;
    if (!id) return;
    if (!confirm('Delete this poster from your Library?')) return;
    deleteProject(id);
  });

  document.getElementById('library-fs-export')?.addEventListener('click', () => {
    _exportPosterFromLibrary();
  });

  document.getElementById('lib-unsaved-save')?.addEventListener('click', () => {
    _unsavedSaveAndContinue();
  });
  document.getElementById('lib-unsaved-discard')?.addEventListener('click', () => {
    _unsavedDiscardAndContinue();
  });

  renderLibraryGrid();
}

document.addEventListener('DOMContentLoaded', () => {
  initSaveToLibraryModal();
  initLibraryPanel();
});

window.restoreProjectPayload = restoreProjectPayload;
window._refreshLibraryGrid = renderLibraryGrid;
