const FONTS = ['Bebas Neue','Barlow Condensed','Montserrat','Oswald','DM Sans','Space Grotesk','Syne','IBM Plex Mono','Playfair Display','Cormorant Garamond'];

// ── Undo / Redo History ───────────────────────────────────────────────────────
const _undoStack = [], _redoStack = [];
const MAX_HISTORY = 40;

function _captureState() {
  const getPos = id => {
    const el = document.getElementById(id);
    return el ? { x: +(el.getAttribute('data-x') || 0), y: +(el.getAttribute('data-y') || 0) } : { x: 0, y: 0 };
  };
  return {
    textEls:    JSON.parse(JSON.stringify(textEls)),
    pos:        { stats: getPos('p-stats'), legend: getPos('p-legend'), brand: getPos('p-brand') },
    statsSize:  document.getElementById('stat-size')?.value || '50',
    statsColor: document.getElementById('stat-font-color')?.value || '#ffffff',
    statsBgChk: document.getElementById('stat-remove-bg')?.checked ?? true,
    statsBgCol: document.getElementById('stat-bg-color')?.value || '#000000',
    statsDist:  document.getElementById('chk-dist')?.checked ?? true,
    statsTime:  document.getElementById('chk-time')?.checked ?? true,
    statsSurf:  document.getElementById('chk-surface')?.checked ?? false,
    legSize:    document.getElementById('legend-size')?.value || '13',
    legColor:   document.getElementById('legend-font-color')?.value || '#ffffff',
    legBgChk:   document.getElementById('legend-remove-bg')?.checked ?? true,
    legBgCol:   document.getElementById('legend-bg-color')?.value || '#000000',
    legStart:   document.getElementById('chk-legend-start')?.checked ?? true,
    legFinish:  document.getElementById('chk-legend-finish')?.checked ?? true,
    legWp:      document.getElementById('chk-legend-wp')?.checked ?? false,
    statsBorder:  document.getElementById('p-stats')?.classList.contains('has-border') ?? false,
    legBorder:    document.getElementById('p-legend')?.classList.contains('has-border') ?? false,
    statsDisplay: document.getElementById('p-stats')?.style.display ?? '',
    legDisplay:   document.getElementById('p-legend')?.style.display ?? '',
    routeNodes:   JSON.parse(JSON.stringify(window._routeNodes ?? [])),
  };
}

function _restoreState(state) {
  textEls = JSON.parse(JSON.stringify(state.textEls));
  renderTextUI(); renderTextPoster();

  // Restore element positions
  for (const [key, pos] of Object.entries(state.pos)) {
    const id = { stats: 'p-stats', legend: 'p-legend', brand: 'p-brand' }[key];
    const el = document.getElementById(id);
    if (el) { el.setAttribute('data-x', pos.x); el.setAttribute('data-y', pos.y); el.style.transform = `translate(${pos.x}px,${pos.y}px)`; }
  }

  // Restore stats
  const setChk = (id, val) => { const el = document.getElementById(id); if (el && el.checked !== val) { el.checked = val; el.dispatchEvent(new Event('change')); } };
  const setInp = (id, val, evtType = 'input') => { const el = document.getElementById(id); if (el) { el.value = val; el.dispatchEvent(new Event(evtType)); } };
  setInp('stat-size',       state.statsSize);
  setInp('stat-font-color', state.statsColor);
  setInp('stat-bg-color',   state.statsBgCol);
  setChk('stat-remove-bg',  state.statsBgChk);
  setChk('chk-dist',        state.statsDist);
  setChk('chk-time',        state.statsTime);
  setChk('chk-surface',     state.statsSurf);
  window._updateStats?.();
  window._updateStatsBg?.();

  // Restore legend
  setInp('legend-size',       state.legSize);
  setInp('legend-font-color', state.legColor);
  setInp('legend-bg-color',   state.legBgCol);
  setChk('legend-remove-bg',  state.legBgChk);
  setChk('chk-legend-start',  state.legStart);
  setChk('chk-legend-finish', state.legFinish ?? true);
  setChk('chk-legend-wp',     state.legWp);
  window._updateLegendBg?.();

  document.getElementById('p-stats')?.classList.toggle('has-border', state.statsBorder ?? false);
  document.getElementById('p-legend')?.classList.toggle('has-border', state.legBorder ?? false);

  // Restore layer-toggle forced display (can differ from checkbox-driven display)
  if (state.statsDisplay === 'none') {
    const ps = document.getElementById('p-stats');
    if (ps) ps.style.display = 'none';
  }
  if (state.legDisplay === 'none') {
    const pl = document.getElementById('p-legend');
    if (pl) pl.style.display = 'none';
  }

  // Restore route nodes
  if (state.routeNodes) window._restoreRouteNodes?.(state.routeNodes);

  hideEditBar();
  _updateUndoUI();
}

function _updateUndoUI() {
  const u = document.getElementById('btn-undo'), r = document.getElementById('btn-redo');
  if (u) u.disabled = _undoStack.length === 0;
  if (r) r.disabled = _redoStack.length === 0;
}

function pushUndo() {
  _undoStack.push(_captureState());
  if (_undoStack.length > MAX_HISTORY) _undoStack.shift();
  _redoStack.length = 0;
  _updateUndoUI();
}

function undoAction() {
  if (!_undoStack.length) return;
  _redoStack.push(_captureState());
  _restoreState(_undoStack.pop());
}

function redoAction() {
  if (!_redoStack.length) return;
  _undoStack.push(_captureState());
  _restoreState(_redoStack.pop());
}

window.pushUndo   = pushUndo;
window._pushUndo  = pushUndo;
window.undoAction = undoAction;
window.redoAction = redoAction;

// Proportionally rescale all overlay Y-positions when the aspect ratio changes.
// Frame width is always 1080px so only height matters.
window.rescaleElements = function(oldH, newH) {
  if (!oldH || !newH || oldH === newH) return;
  const fy = newH / oldH;

  textEls.forEach(te => {
    te.y = te.y * fy;
    const dom = document.getElementById('pe-' + te.id);
    if (dom) {
      dom.setAttribute('data-y', te.y);
      dom.style.transform = `translate(${te.x}px,${te.y}px)`;
    }
  });

  ['p-stats', 'p-legend', 'p-brand'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const x = parseFloat(el.getAttribute('data-x')) || 0;
    const y = (parseFloat(el.getAttribute('data-y')) || 0) * fy;
    el.setAttribute('data-y', y);
    el.style.transform = `translate(${x}px,${y}px)`;
  });
};

// Four-level typographic hierarchy in the 1080×1350 poster coordinate space
let textEls = [
  { id: 2, text: 'ROUTEFORGE',     size: 148, color: '#ffffff', bgColor: '#000000', removeBg: true, font: 'Oswald',           x: 60, y: 62  },
  { id: 3, text: 'DATE',           size: 90,  color: '#ffffff', bgColor: '#000000', removeBg: true, font: 'Oswald',           x: 62, y: 230 },
  { id: 4, text: 'STARTING POINT', size: 50,  color: '#cccccc', bgColor: '#000000', removeBg: true, font: 'Barlow Condensed', x: 62, y: 340 },
];

document.addEventListener('DOMContentLoaded', () => {
  renderTextUI();
  renderTextPoster();
  initStatsCtrl();
  initLegendCtrl();
  initLogoCtrl();
  initPosterScale();
  initEditBar();
  initLayerToggles();
  _updateUndoUI();

  // Undo/Redo topbar buttons
  document.getElementById('btn-undo')?.addEventListener('click', undoAction);
  document.getElementById('btn-redo')?.addEventListener('click', redoAction);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undoAction(); }
    if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redoAction(); }
  });
});

// ── Poster Frame Scaling ──────────────────────────────────────────────────────

function updateVignette(W, H, x, y, w, h) {
  x = Math.round(x); y = Math.round(y);
  w = Math.round(w); h = Math.round(h);
  const set = (id, top, left, width, height) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.top    = top    + 'px';
    el.style.left   = left   + 'px';
    el.style.width  = width  + 'px';
    el.style.height = height + 'px';
  };
  set('vgn-top',    0,     0,     W,     y);
  set('vgn-bottom', y + h, 0,     W,     H - y - h);
  set('vgn-left',   y,     0,     x,     h);
  set('vgn-right',  y,     x + w, W - x - w, h);
}

function initPosterScale() {
  window.scalePoster = function () {
    const vp    = document.getElementById('app');
    const frame = document.getElementById('poster-frame');
    if (!vp || !frame) return;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    if (!vw || !vh) return;
    const fw = frame.offsetWidth, fh = frame.offsetHeight;
    if (!fw || !fh) return;
    const margin = 24;
    const sc = Math.min((vw - margin * 2) / fw, (vh - margin * 2) / fh);
    const ox = (vw - fw * sc) / 2;
    const oy = (vh - fh * sc) / 2;
    frame.style.transform = `translate(${ox}px,${oy}px) scale(${sc})`;
    updateVignette(vw, vh, ox, oy, fw * sc, fh * sc);
  };

  requestAnimationFrame(() => requestAnimationFrame(window.scalePoster));
  setTimeout(window.scalePoster, 150);
  setTimeout(window.scalePoster, 600);

  const vpEl = document.getElementById('app');
  if (window.ResizeObserver && vpEl) {
    new ResizeObserver(() => requestAnimationFrame(window.scalePoster)).observe(vpEl);
  }
}

// ── Poster Preview Capture ────────────────────────────────────────────────────

function getScale() {
  const t = document.getElementById('poster-frame').style.transform || '';
  const m = t.match(/scale\(([^)]+)\)/);
  return m ? parseFloat(m[1]) : 1;
}

function waitForCaptureTiles(maxMs = 6000) {
  if (window._captureTilesReady !== false) return Promise.resolve();
  return new Promise(resolve => {
    const tid = setInterval(() => {
      if (window._captureTilesReady !== false) { clearInterval(tid); resolve(); }
    }, 150);
    setTimeout(() => { clearInterval(tid); resolve(); }, maxMs);
  });
}

function applyMapOffset(img) {
  img = img || document.getElementById('poster-map-img');
  if (!img) return;
  const frame = document.getElementById('poster-frame');
  if (!frame) return;
  const fw = frame.offsetWidth, fh = frame.offsetHeight;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (iw && ih && fw && fh) {
    const sc = Math.max(fw / iw, fh / ih);
    const dw = Math.round(iw * sc), dh = Math.round(ih * sc);
    const bx = (fw - dw) / 2, by = (fh - dh) / 2;
    img.style.width  = dw + 'px';
    img.style.height = dh + 'px';
    img.style.transform = `translate(${bx}px,${by}px)`;
  }
}
window.applyMapOffset = applyMapOffset;

async function updatePosterPreview(opts = {}) {
  const cm = window._captureMap;
  const vm = window._leafletMap;

  if (opts.resetPan && cm && window.currentRouteData) {
    const coords = window.currentRouteData.geojson.coordinates.map(c => [c[1], c[0]]);
    window._captureTilesReady = false;
    cm.fitBounds(L.latLngBounds(coords), { padding: [60, 60], animate: false });
  } else if (cm && vm) {
    cm.setView(vm.getCenter(), vm.getZoom(), { animate: false });
    window._captureTilesReady = false;
  }

  const captureEl = document.getElementById('capture-map');
  if (!captureEl) return;

  try {
    await waitForCaptureTiles(6000);
    await new Promise(r => setTimeout(r, 80));

    const url = await domtoimage.toPng(captureEl, { scale: 2 });

    const img = document.getElementById('poster-map-img');
    img.src = url;
    await (img.decode?.().catch(() => {}) ?? new Promise(r => { img.onload = r; }));
    img.style.display = 'block';
    applyMapOffset(img);
    img.style.display = 'none';
  } catch (e) {
    console.warn('preview err', e);
  }
}
window.updatePosterPreview = updatePosterPreview;

// ── Text Elements ─────────────────────────────────────────────────────────────

function renderTextUI() {
  const list = document.getElementById('text-elements-list');
  if (!list) return;
  list.innerHTML = '';
  textEls.forEach(el => {
    const row = document.createElement('div');
    row.className = 'tel-row-simple';
    row.innerHTML = `
      <span class="tel-name-label" style="flex:1;font-size:13px;font-weight:600;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${el.text}</span>
      <button class="tel-del" title="Delete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    row.querySelector('.tel-del').addEventListener('click', () => {
      pushUndo();
      textEls = textEls.filter(t => t.id !== el.id);
      document.getElementById('pe-' + el.id)?.remove();
      hideEditBar();
      renderTextUI();
    });
    list.appendChild(row);
  });

  document.getElementById('btn-add-text').onclick = () => {
    pushUndo();
    textEls.push({ id: Date.now(), text: 'NEW TEXT', size: 50, color: '#ffffff', bgColor: '#000000', removeBg: true, font: 'Oswald', x: 80, y: 300 });
    renderTextUI(); renderTextPoster();
  };
}

function syncDom(el) {
  const d = document.getElementById('pe-' + el.id); if (!d) return;
  d.textContent = el.text;
  d.style.fontSize   = el.size + 'px';
  d.style.color      = el.color;
  d.style.fontFamily = "'" + el.font + "',sans-serif";
  d.style.background = el.removeBg ? 'transparent' : el.bgColor;
  d.style.padding    = el.removeBg ? '0' : '10px 20px';
  d.style.borderRadius = el.removeBg ? '0' : '6px';
}

function updateTextListRow(teData) {
  const list = document.getElementById('text-elements-list');
  if (!list) return;
  const rows = list.querySelectorAll('.tel-row-simple');
  const idx = textEls.indexOf(teData);
  if (rows[idx]) {
    const lbl = rows[idx].querySelector('.tel-name-label');
    if (lbl) lbl.textContent = teData.text;
  }
}

function renderTextPoster() {
  const layer = document.getElementById('poster-els');
  const keep = new Set(['p-stats', 'p-brand', 'p-legend']);
  Array.from(layer.children).forEach(c => { if (!keep.has(c.id)) c.remove(); });
  textEls.forEach(el => {
    const div = document.createElement('div');
    div.id = 'pe-' + el.id; div.className = 'p-text';
    div.setAttribute('data-id', el.id);
    div.setAttribute('data-x', el.x); div.setAttribute('data-y', el.y);
    div.style.transform = `translate(${el.x}px,${el.y}px)`;

    div.addEventListener('dblclick', e => {
      e.stopPropagation();
      div.contentEditable = 'true'; div.focus();
      const range = document.createRange(); range.selectNodeContents(div);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    });
    // Capture state once when text editing begins (before any keystrokes change content)
    div.addEventListener('focus', () => {
      if (div.contentEditable === 'true') pushUndo();
    });
    div.addEventListener('blur', () => {
      div.contentEditable = 'false';
      el.text = div.textContent.trim() || el.text;
      syncDom(el);
      updateTextListRow(el);
      // Re-show the edit bar (stays selected, just exits text-edit mode)
      if (_selectedEl === div) {
        const te = textEls.find(t => t.id == div.getAttribute('data-id'));
        if (te) { requestAnimationFrame(() => showTextEditBar(div, te)); }
      }
    });
    div.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); div.blur(); }
    });

    // Click behaviour:
    //  • 1st click (not yet selected) → select + show edit bar
    //  • 2nd click (already selected) → enter text-edit mode (place cursor)
    //  • Double-click → same as 2nd click (select-all)
    let _tapX = 0, _tapY = 0;
    div.addEventListener('pointerdown', e => { _tapX = e.clientX; _tapY = e.clientY; });
    div.addEventListener('pointerup', e => {
      if (Math.hypot(e.clientX - _tapX, e.clientY - _tapY) >= 20) return;
      if (div.contentEditable === 'true') return; // already editing — browser handles it

      if (_selectedEl === div) {
        // Second click on already-selected element → enter text-edit mode
        div.contentEditable = 'true';
        div.focus();
        // Place cursor at click position (browser handles this naturally since
        // we didn't prevent default on pointerdown)
      } else {
        // First click → select + edit bar
        if (_selectedEl) _selectedEl.classList.remove('poster-el-selected');
        _selectedEl = div;
        div.classList.add('poster-el-selected');
        const te = textEls.find(t => t.id == div.getAttribute('data-id'));
        if (te) showTextEditBar(div, te);
      }
    });

    layer.appendChild(div); syncDom(el);
  });
  initDrag();
}

// ── Stats Controls ────────────────────────────────────────────────────────────

function initStatsCtrl() {
  function updateStats() {
    const d = document.getElementById('chk-dist')?.checked ?? true;
    const t = document.getElementById('chk-time')?.checked ?? true;
    const s = document.getElementById('chk-surface')?.checked ?? false;
    document.getElementById('ps-dist').style.display   = d ? '' : 'none';
    document.getElementById('ps-time').style.display   = t ? '' : 'none';
    document.getElementById('ps-surf').style.display   = s ? '' : 'none';
    document.getElementById('ps-div-dt').style.display = (d && t) ? '' : 'none';
    document.getElementById('ps-div-ts').style.display = (t && s) ? '' : 'none';
    document.getElementById('p-stats').style.display   = (!d && !t && !s) ? 'none' : 'flex';
    // Keep the sidebar layer toggle in sync
    window._onStatsVisChange?.();
  }
  window._updateStats = updateStats;
  updateStats();

  window.setStatVal = function(key, text) {
    const map = { dist: 'ps-val-dist', time: 'ps-val-time', surf: 'ps-val-surf' };
    const pid = map[key];
    if (pid) document.getElementById(pid).textContent = text;
  };

  function applyStatSize(v) {
    document.documentElement.style.setProperty('--sc-size', v + 'px');
    const lblPx = Math.max(14, Math.round(v * 0.35));
    document.documentElement.style.setProperty('--sc-label-size', lblPx + 'px');
    const sv = document.getElementById('stat-size-val');
    if (sv) sv.textContent = v;
  }
  const statSizeEl = document.getElementById('stat-size');
  applyStatSize(+(statSizeEl?.value || 50));
  statSizeEl?.addEventListener('input', e => applyStatSize(+e.target.value));

  const statFontPicker = document.getElementById('stat-font-color');
  if (statFontPicker) {
    const apply = () => document.getElementById('p-stats')?.style.setProperty('--sc-color', statFontPicker.value);
    statFontPicker.addEventListener('input', apply);
    apply();
  }

  function updateBg() {
    const rm  = document.getElementById('stat-remove-bg')?.checked ?? true;
    const hex = document.getElementById('stat-bg-color')?.value || '#000000';
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const bg = rm ? 'transparent' : `rgba(${r},${g},${b},.88)`;
    document.documentElement.style.setProperty('--sc-bg', bg);
    const ps = document.getElementById('p-stats');
    if (ps) {
      ps.style.background = bg;
    }
  }
  window._updateStatsBg = updateBg;
  document.getElementById('stat-bg-color')?.addEventListener('input', updateBg);
  document.getElementById('stat-remove-bg')?.addEventListener('change', updateBg);
  updateBg();
}

// ── Logo ──────────────────────────────────────────────────────────────────────

function initLogoCtrl() {
  // Prevent the browser from treating the logo image as a native draggable file
  document.getElementById('p-brand')?.addEventListener('dragstart', e => e.preventDefault());

  const inp = document.getElementById('logo-upload');
  inp.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('p-logo').src         = ev.target.result;
      document.getElementById('p-logo').style.display = 'block';
      document.getElementById('logo-preview').src   = ev.target.result;
      document.getElementById('logo-preview').style.display = 'block';
      document.getElementById('btn-remove-logo').style.display = '';
      document.getElementById('upload-zone').style.display    = 'none';
    };
    reader.readAsDataURL(f);
  });
  document.getElementById('btn-remove-logo').addEventListener('click', () => {
    document.getElementById('p-logo').style.display       = 'none';
    document.getElementById('logo-preview').style.display = 'none';
    document.getElementById('btn-remove-logo').style.display = 'none';
    document.getElementById('upload-zone').style.display     = '';
    inp.value = '';
  });
  document.getElementById('logo-size').addEventListener('input', e =>
    document.documentElement.style.setProperty('--logo-size', e.target.value + 'px')
  );
}

// ── Legend Box ────────────────────────────────────────────────────────────────

function initLegendCtrl() {
  const leg = document.getElementById('p-legend');
  if (!leg) return;

  // Re-evaluates divider visibility so a divider only shows when the row
  // ABOVE it is visible AND at least one row below it is visible.
  function updateDividers() {
    const startOn  = document.getElementById('chk-legend-start')?.checked  ?? true;
    const finishOn = document.getElementById('chk-legend-finish')?.checked ?? true;
    const wpOn     = document.getElementById('chk-legend-wp')?.checked     ?? false;
    // Divider between Start and Finish rows
    const divSF = document.getElementById('pl-div-sf');
    if (divSF) divSF.style.display = (startOn && finishOn) ? '' : 'none';
    // Divider between Finish and Waypoint rows
    const divFW = document.getElementById('pl-div-fw');
    if (divFW) divFW.style.display = ((startOn || finishOn) && wpOn) ? '' : 'none';
  }

  function updateLegendContainerVis() {
    const allOff = [...leg.querySelectorAll('.pl-row')].every(r => r.style.display === 'none');
    leg.style.display = allOff ? 'none' : '';
    window._onLegVisChange?.();
  }

  function bindRow(chkId, rowId) {
    const chk = document.getElementById(chkId);
    const row = document.getElementById(rowId);
    if (!chk || !row) return;
    function applyRow() {
      row.style.display = chk.checked ? '' : 'none';
      updateDividers();
      updateLegendContainerVis();
    }
    chk.addEventListener('change', applyRow);
    applyRow();
  }
  bindRow('chk-legend-start',  'pl-row-start');
  bindRow('chk-legend-finish', 'pl-row-finish');
  bindRow('chk-legend-wp',     'pl-row-wp');

  function applyLegendSize(v) {
    leg.querySelectorAll('.pl-label').forEach(el => el.style.fontSize = v + 'px');
    const sv = document.getElementById('legend-size-val');
    if (sv) sv.textContent = v;
  }
  const legSizeSlider = document.getElementById('legend-size');
  if (legSizeSlider) {
    legSizeSlider.addEventListener('input', e => applyLegendSize(+e.target.value));
    applyLegendSize(+legSizeSlider.value);
  }
  window._applyLegendSize = applyLegendSize;

  const legFontPicker = document.getElementById('legend-font-color');
  if (legFontPicker) {
    const apply = () => leg.style.setProperty('--pl-color', legFontPicker.value);
    legFontPicker.addEventListener('input', apply);
    apply();
  }

  function updateLegendBg() {
    const rm  = document.getElementById('legend-remove-bg')?.checked ?? true;
    const hex = document.getElementById('legend-bg-color')?.value || '#000000';
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    leg.style.background = rm ? 'transparent' : `rgba(${r},${g},${b},.88)`;
  }
  window._updateLegendBg = updateLegendBg;
  document.getElementById('legend-bg-color')?.addEventListener('input', updateLegendBg);
  document.getElementById('legend-remove-bg')?.addEventListener('change', updateLegendBg);
  updateLegendBg();

  const startInput  = document.getElementById('val-legend-start');
  const finishInput = document.getElementById('val-legend-finish');
  const wpInput     = document.getElementById('val-legend-wp');
  if (startInput)  startInput.addEventListener('input',  () => { const l = document.getElementById('pl-label-start');  if (l) l.textContent = startInput.value; });
  if (finishInput) finishInput.addEventListener('input', () => { const l = document.getElementById('pl-label-finish'); if (l) l.textContent = finishInput.value; });
  if (wpInput)     wpInput.addEventListener('input',     () => { const l = document.getElementById('pl-label-wp');     if (l) l.textContent = wpInput.value; });
}

// ── Drag (raw pointer events) + Resize (interact.js) ─────────────────────────
//
// interact.js calls setPointerCapture on pointerdown which locks all subsequent
// events to the element — this makes "select on click, drag only when selected"
// impossible to implement cleanly via interact.js alone.
//
// Solution: replace all draggable() calls with raw pointer events on
// #poster-frame.  Dragging only starts when the element is already _selectedEl
// (or for p-brand which is always freely draggable).  interact.js is kept
// exclusively for the .p-text resize handles.

function initDrag() {
  const frame = document.getElementById('poster-frame');
  if (!frame) return;

  let _drag = null;
  // { el, pid, startX, startY, ox, oy, moved, captured }

  // IMPORTANT: pointerdown is passive — we never call preventDefault here.
  // This lets the browser handle focus, cursor placement, and text selection
  // normally when the user taps without dragging.
  // Pointer capture + preventDefault are deferred to the first pointermove
  // that crosses the drag threshold, so only real drags interrupt text editing.
  frame.addEventListener('pointerdown', e => {
    const el = e.target.closest('.p-text,.p-stats,.p-legend,.p-brand,.p-location');
    if (!el) return;
    // Already in text-edit mode — let the browser handle it completely
    if (el.contentEditable === 'true' || e.target.contentEditable === 'true') return;
    // Stats card: editable children handle their own clicks
    if (el.id === 'p-stats' && e.target.closest('.ps-label,.ps-val,.ps-icon')) return;

    // Only arm a potential drag if already selected (or p-brand which is always free)
    const canDrag = (el === _selectedEl) || (el.id === 'p-brand');
    if (!canDrag) return;

    // Store candidate — but do NOT preventDefault and do NOT capture yet
    _drag = {
      el,
      pid:      e.pointerId,
      startX:   e.clientX,
      startY:   e.clientY,
      ox:       parseFloat(el.getAttribute('data-x')) || 0,
      oy:       parseFloat(el.getAttribute('data-y')) || 0,
      moved:    false,
      captured: false,
    };
  }); // passive by default — no preventDefault

  frame.addEventListener('pointermove', e => {
    if (!_drag || e.pointerId !== _drag.pid) return;

    // No button held (e.g. stopPropagation swallowed pointerup) — cancel silently
    if (e.buttons === 0) { _drag = null; return; }

    const dx = e.clientX - _drag.startX;
    const dy = e.clientY - _drag.startY;

    // Dead zone — ignore tiny movements
    if (Math.hypot(dx, dy) < 6) return;

    // Threshold crossed: commit to drag — NOW capture the pointer and
    // prevent default (stops text-selection cursor from appearing during drag)
    if (!_drag.captured) {
      try { frame.setPointerCapture(e.pointerId); } catch (_) {}
      _drag.captured = true;
      pushUndo();
      _drag.moved = true;
    }

    const sc = getScale();
    const nx = _drag.ox + dx / sc;
    const ny = _drag.oy + dy / sc;
    const el = _drag.el;

    el.style.transform = `translate(${nx}px,${ny}px)`;
    el.setAttribute('data-x', nx);
    el.setAttribute('data-y', ny);

    const id = el.getAttribute('data-id');
    if (id) { const te = textEls.find(t => t.id == id); if (te) { te.x = nx; te.y = ny; } }

    positionEditBar(el);
  });

  const endDrag = () => { _drag = null; };
  frame.addEventListener('pointerup',     endDrag);
  frame.addEventListener('pointercancel', endDrag);

  // ── interact.js: resize handles for .p-text only ──────────────────────────
  interact('.p-text').resizable({
    edges: { right: true, bottom: true },
    listeners: {
      move(e) {
        if (e.target.contentEditable === 'true') return;
        const sc = getScale(), el = e.target, id = el.getAttribute('data-id');
        if (!id) return;
        const te = textEls.find(t => t.id == id);
        if (!te) return;
        const dw = e.deltaRect.width / sc;
        const ratio = (el.offsetWidth + dw) / (el.offsetWidth || 1);
        te.size = Math.max(10, Math.min(300, te.size * ratio));
        syncDom(te);
        if (_selectedEl === el) {
          const szVal = document.getElementById('eb-sz-val');
          if (szVal) szVal.textContent = Math.round(te.size);
        }
      }
    }
  });
}

// ── Inline Edit Bar ───────────────────────────────────────────────────────────

let _selectedEl = null;

function hideEditBar() {
  const bar = document.getElementById('edit-bar');
  if (bar) bar.classList.remove('visible');
  if (_selectedEl) { _selectedEl.classList.remove('poster-el-selected'); _selectedEl = null; }
}

function positionEditBar(targetEl) {
  const bar = document.getElementById('edit-bar');
  if (!bar) return;
  const rect   = targetEl.getBoundingClientRect();
  const barW   = bar.offsetWidth  || 300;
  const barH   = bar.offsetHeight || 48;
  const margin = 8;
  // topbar height (CSS var --topbar-h = 52px)
  const topbarH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 52;

  // Center X, clamped so bar never bleeds off left or right edge
  const rawCx  = rect.left + rect.width / 2;
  const minCx  = barW / 2 + margin;
  const maxCx  = window.innerWidth - barW / 2 - margin;
  const cx     = Math.max(minCx, Math.min(maxCx, rawCx));

  // Prefer above the element; fall back to below if not enough room
  const spaceAbove = rect.top - topbarH - margin;
  const below      = spaceAbove < barH + 10;

  const arrow = bar.querySelector('.eb-arrow');
  if (below) {
    bar.style.left      = cx + 'px';
    bar.style.top       = (rect.bottom + 10) + 'px';
    bar.style.transform = 'translate(-50%, 0)';
    arrow?.classList.add('flip');
  } else {
    bar.style.left      = cx + 'px';
    bar.style.top       = (rect.top - 10) + 'px';
    bar.style.transform = 'translate(-50%, -100%)';
    arrow?.classList.remove('flip');
  }
}

function showTextEditBar(el, teData) {
  const bar = document.getElementById('edit-bar');
  if (!bar) return;
  document.getElementById('eb-text-bar').style.display   = 'flex';
  document.getElementById('eb-stats-bar').style.display  = 'none';
  document.getElementById('eb-legend-bar').style.display = 'none';

  const fontSel = document.getElementById('eb-font');
  fontSel.innerHTML = FONTS.map(f => `<option value="${f}" ${f === teData.font ? 'selected' : ''}>${f}</option>`).join('');
  document.getElementById('eb-sz-val').textContent = Math.round(teData.size);
  const colorIn = document.getElementById('eb-color');
  colorIn.value = teData.color;
  document.getElementById('eb-color-dot').style.background = teData.color;
  document.getElementById('eb-bg-toggle').classList.toggle('active', !teData.removeBg);

  const bgColorWrap = document.getElementById('eb-bg-color-wrap');
  const bgColorDot  = document.getElementById('eb-bg-color-dot');
  const bgColorIn   = document.getElementById('eb-bg-color');
  if (bgColorWrap && bgColorIn) {
    const bgVal = teData.bgColor || '#000000';
    bgColorIn.value = bgVal;
    if (bgColorDot) bgColorDot.style.background = bgVal;
    bgColorWrap.style.display = teData.removeBg ? 'none' : 'flex';
  }

  bar.classList.add('visible');
  positionEditBar(el);

  function rewire(id, fn) {
    const node = document.getElementById(id);
    if (!node) return node;
    const clone = node.cloneNode(true);
    node.parentNode.replaceChild(clone, node);
    const evtType = (clone.tagName === 'INPUT' && clone.type === 'color') ? 'input'
                  : (clone.tagName === 'SELECT') ? 'change'
                  : 'click';
    clone.addEventListener(evtType, fn);
    return clone;
  }

  rewire('eb-font', e => { pushUndo(); teData.font = e.target.value; syncDom(teData); updateTextListRow(teData); });
  rewire('eb-sz-m', () => {
    pushUndo();
    teData.size = Math.max(8, teData.size - 4);
    document.getElementById('eb-sz-val').textContent = Math.round(teData.size);
    syncDom(teData);
  });
  rewire('eb-sz-p', () => {
    pushUndo();
    teData.size = Math.min(400, teData.size + 4);
    document.getElementById('eb-sz-val').textContent = Math.round(teData.size);
    syncDom(teData);
  });
  const newColorIn = rewire('eb-color', e => {
    pushUndo();
    const newCol = e.target.value;
    document.getElementById('eb-color-dot').style.background = newCol;
    // If the element is in text-edit mode with a non-collapsed selection,
    // apply color only to the selected characters via execCommand.
    const sel = window.getSelection();
    if (el.contentEditable === 'true' && sel && !sel.isCollapsed && el.contains(sel.anchorNode)) {
      document.execCommand('foreColor', false, newCol);
    } else {
      teData.color = newCol;
      syncDom(teData);
    }
  });
  if (newColorIn) newColorIn.value = teData.color;
  rewire('eb-bg-toggle', () => {
    pushUndo();
    teData.removeBg = !teData.removeBg;
    document.getElementById('eb-bg-toggle').classList.toggle('active', !teData.removeBg);
    document.getElementById('eb-bg-color-wrap').style.display = teData.removeBg ? 'none' : 'flex';
    syncDom(teData);
  });
  const newBgColorIn = rewire('eb-bg-color', e => {
    pushUndo();
    teData.bgColor = e.target.value;
    document.getElementById('eb-bg-color-dot').style.background = e.target.value;
    syncDom(teData);
  });
  if (newBgColorIn) newBgColorIn.value = teData.bgColor || '#000000';
  rewire('eb-del', () => {
    pushUndo();
    textEls = textEls.filter(t => t.id !== teData.id);
    document.getElementById('pe-' + teData.id)?.remove();
    hideEditBar();
    renderTextUI();
  });
}

function showStatsEditBar(el) {
  const bar = document.getElementById('edit-bar');
  if (!bar) return;
  document.getElementById('eb-text-bar').style.display   = 'none';
  document.getElementById('eb-stats-bar').style.display  = 'flex';
  document.getElementById('eb-legend-bar').style.display = 'none';

  const distChk = document.getElementById('chk-dist');
  const timeChk = document.getElementById('chk-time');
  const surfChk = document.getElementById('chk-surface');
  document.getElementById('eb-s-dist').classList.toggle('active', distChk?.checked ?? true);
  document.getElementById('eb-s-time').classList.toggle('active', timeChk?.checked ?? true);
  document.getElementById('eb-s-surf').classList.toggle('active', surfChk?.checked ?? false);

  const sz = +(document.getElementById('stat-size')?.value || 50);
  document.getElementById('eb-ss-val').textContent = sz;

  const col = document.getElementById('stat-font-color')?.value || '#ffffff';
  document.getElementById('eb-s-color').value = col;
  document.getElementById('eb-s-color-dot').style.background = col;

  const noBg = document.getElementById('stat-remove-bg')?.checked ?? true;
  document.getElementById('eb-s-bg-toggle').classList.toggle('active', !noBg);

  const sBgColorWrap = document.getElementById('eb-s-bg-color-wrap');
  const sBgColorDot  = document.getElementById('eb-s-bg-color-dot');
  const sBgColorIn   = document.getElementById('eb-s-bg-color');
  if (sBgColorWrap && sBgColorIn) {
    const bgVal = document.getElementById('stat-bg-color')?.value || '#000000';
    sBgColorIn.value = bgVal;
    if (sBgColorDot) sBgColorDot.style.background = bgVal;
    sBgColorWrap.style.display = noBg ? 'none' : 'flex';
  }

  const hasBorderS = document.getElementById('p-stats')?.classList.contains('has-border') ?? false;
  document.getElementById('eb-s-border').classList.toggle('active', hasBorderS);

  bar.classList.add('visible');
  positionEditBar(el);

  function rewire(id, fn) {
    const node = document.getElementById(id);
    if (!node) return node;
    const clone = node.cloneNode(true);
    node.parentNode.replaceChild(clone, node);
    const evtType = (clone.tagName === 'INPUT' && clone.type === 'color') ? 'input'
                  : (clone.tagName === 'SELECT') ? 'change'
                  : 'click';
    clone.addEventListener(evtType, fn);
    return clone;
  }

  rewire('eb-s-dist', () => {
    pushUndo();
    const chk = document.getElementById('chk-dist');
    if (chk) { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }
    window._updateStats?.();
    document.getElementById('eb-s-dist').classList.toggle('active', document.getElementById('chk-dist')?.checked);
  });
  rewire('eb-s-time', () => {
    pushUndo();
    const chk = document.getElementById('chk-time');
    if (chk) { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }
    window._updateStats?.();
    document.getElementById('eb-s-time').classList.toggle('active', document.getElementById('chk-time')?.checked);
  });
  rewire('eb-s-surf', () => {
    pushUndo();
    const chk = document.getElementById('chk-surface');
    if (chk) { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }
    window._updateStats?.();
    document.getElementById('eb-s-surf').classList.toggle('active', document.getElementById('chk-surface')?.checked);
  });

  rewire('eb-ss-m', () => {
    pushUndo();
    const inp = document.getElementById('stat-size');
    if (inp) { inp.value = Math.max(20, +inp.value - 4); inp.dispatchEvent(new Event('input')); }
    document.getElementById('eb-ss-val').textContent = document.getElementById('stat-size')?.value;
  });
  rewire('eb-ss-p', () => {
    pushUndo();
    const inp = document.getElementById('stat-size');
    if (inp) { inp.value = Math.min(120, +inp.value + 4); inp.dispatchEvent(new Event('input')); }
    document.getElementById('eb-ss-val').textContent = document.getElementById('stat-size')?.value;
  });

  const newColorIn = rewire('eb-s-color', e => {
    pushUndo();
    const pick = document.getElementById('stat-font-color');
    if (pick) { pick.value = e.target.value; pick.dispatchEvent(new Event('input')); }
    document.getElementById('eb-s-color-dot').style.background = e.target.value;
  });
  if (newColorIn) newColorIn.value = col;

  rewire('eb-s-bg-toggle', () => {
    pushUndo();
    const rmChk = document.getElementById('stat-remove-bg');
    if (rmChk) { rmChk.checked = !rmChk.checked; rmChk.dispatchEvent(new Event('change')); }
    const noBg2 = document.getElementById('stat-remove-bg')?.checked ?? true;
    document.getElementById('eb-s-bg-toggle').classList.toggle('active', !noBg2);
    document.getElementById('eb-s-bg-color-wrap').style.display = noBg2 ? 'none' : 'flex';
  });

  const newSBgColorIn = rewire('eb-s-bg-color', e => {
    pushUndo();
    const pick = document.getElementById('stat-bg-color');
    if (pick) { pick.value = e.target.value; pick.dispatchEvent(new Event('input')); }
    document.getElementById('eb-s-bg-color-dot').style.background = e.target.value;
  });
  if (newSBgColorIn) newSBgColorIn.value = document.getElementById('stat-bg-color')?.value || '#000000';

  rewire('eb-s-border', () => {
    pushUndo();
    const ps = document.getElementById('p-stats');
    if (ps) ps.classList.toggle('has-border');
    document.getElementById('eb-s-border').classList.toggle('active', document.getElementById('p-stats')?.classList.contains('has-border'));
  });
}

function showLegendEditBar(el) {
  const bar = document.getElementById('edit-bar');
  if (!bar) return;
  document.getElementById('eb-text-bar').style.display   = 'none';
  document.getElementById('eb-stats-bar').style.display  = 'none';
  document.getElementById('eb-legend-bar').style.display = 'flex';

  document.getElementById('eb-l-start').classList.toggle('active',  document.getElementById('chk-legend-start')?.checked  ?? true);
  document.getElementById('eb-l-finish').classList.toggle('active', document.getElementById('chk-legend-finish')?.checked ?? true);
  document.getElementById('eb-l-wp').classList.toggle('active',     document.getElementById('chk-legend-wp')?.checked     ?? false);

  const sz = +(document.getElementById('legend-size')?.value || 13);
  document.getElementById('eb-ls-val').textContent = sz;

  const col = document.getElementById('legend-font-color')?.value || '#ffffff';
  document.getElementById('eb-l-color').value = col;
  document.getElementById('eb-l-color-dot').style.background = col;

  const noBg = document.getElementById('legend-remove-bg')?.checked ?? true;
  document.getElementById('eb-l-bg-toggle').classList.toggle('active', !noBg);

  const lBgColorWrap = document.getElementById('eb-l-bg-color-wrap');
  const lBgColorDot  = document.getElementById('eb-l-bg-color-dot');
  const lBgColorIn   = document.getElementById('eb-l-bg-color');
  if (lBgColorWrap && lBgColorIn) {
    const bgVal = document.getElementById('legend-bg-color')?.value || '#000000';
    lBgColorIn.value = bgVal;
    if (lBgColorDot) lBgColorDot.style.background = bgVal;
    lBgColorWrap.style.display = noBg ? 'none' : 'flex';
  }

  const hasBorderL = document.getElementById('p-legend')?.classList.contains('has-border') ?? false;
  document.getElementById('eb-l-border').classList.toggle('active', hasBorderL);

  bar.classList.add('visible');
  positionEditBar(el);

  function rewire(id, fn) {
    const node = document.getElementById(id);
    if (!node) return node;
    const clone = node.cloneNode(true);
    node.parentNode.replaceChild(clone, node);
    const evtType = (clone.tagName === 'INPUT' && clone.type === 'color') ? 'input'
                  : (clone.tagName === 'SELECT') ? 'change'
                  : 'click';
    clone.addEventListener(evtType, fn);
    return clone;
  }

  rewire('eb-l-start', () => {
    pushUndo();
    const chk = document.getElementById('chk-legend-start');
    if (chk) { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }
    document.getElementById('eb-l-start').classList.toggle('active', document.getElementById('chk-legend-start')?.checked);
  });
  rewire('eb-l-finish', () => {
    pushUndo();
    const chk = document.getElementById('chk-legend-finish');
    if (chk) { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }
    document.getElementById('eb-l-finish').classList.toggle('active', document.getElementById('chk-legend-finish')?.checked);
  });
  rewire('eb-l-wp', () => {
    pushUndo();
    const chk = document.getElementById('chk-legend-wp');
    if (chk) { chk.checked = !chk.checked; chk.dispatchEvent(new Event('change')); }
    document.getElementById('eb-l-wp').classList.toggle('active', document.getElementById('chk-legend-wp')?.checked);
  });

  rewire('eb-ls-m', () => {
    pushUndo();
    const inp = document.getElementById('legend-size');
    if (inp) { inp.value = Math.max(8, +inp.value - 1); inp.dispatchEvent(new Event('input')); }
    document.getElementById('eb-ls-val').textContent = document.getElementById('legend-size')?.value;
  });
  rewire('eb-ls-p', () => {
    pushUndo();
    const inp = document.getElementById('legend-size');
    if (inp) { inp.value = Math.min(60, +inp.value + 1); inp.dispatchEvent(new Event('input')); }
    document.getElementById('eb-ls-val').textContent = document.getElementById('legend-size')?.value;
  });

  const newColorIn = rewire('eb-l-color', e => {
    pushUndo();
    const pick = document.getElementById('legend-font-color');
    if (pick) { pick.value = e.target.value; pick.dispatchEvent(new Event('input')); }
    document.getElementById('eb-l-color-dot').style.background = e.target.value;
  });
  if (newColorIn) newColorIn.value = col;

  rewire('eb-l-bg-toggle', () => {
    pushUndo();
    const rmChk = document.getElementById('legend-remove-bg');
    if (rmChk) { rmChk.checked = !rmChk.checked; rmChk.dispatchEvent(new Event('change')); }
    const noBg2 = document.getElementById('legend-remove-bg')?.checked ?? true;
    document.getElementById('eb-l-bg-toggle').classList.toggle('active', !noBg2);
    document.getElementById('eb-l-bg-color-wrap').style.display = noBg2 ? 'none' : 'flex';
  });

  const newLBgColorIn = rewire('eb-l-bg-color', e => {
    pushUndo();
    const pick = document.getElementById('legend-bg-color');
    if (pick) { pick.value = e.target.value; pick.dispatchEvent(new Event('input')); }
    document.getElementById('eb-l-bg-color-dot').style.background = e.target.value;
  });
  if (newLBgColorIn) newLBgColorIn.value = document.getElementById('legend-bg-color')?.value || '#000000';

  rewire('eb-l-border', () => {
    pushUndo();
    const pl = document.getElementById('p-legend');
    if (pl) pl.classList.toggle('has-border');
    document.getElementById('eb-l-border').classList.toggle('active', document.getElementById('p-legend')?.classList.contains('has-border'));
  });
}

// ── Layer Visibility Toggles ─────────────────────────────────────────────────

function initLayerToggles() {
  // Stats card
  const statsToggle = document.getElementById('layer-stats');
  const statsEl = document.getElementById('p-stats');
  if (statsToggle && statsEl) {
    // Keep toggle in sync with the hidden chk-dist/time/surface state
    // (if all rows are hidden, the card itself is hidden — reflect that)
    function syncStatsToggle() {
      const visible = statsEl.style.display !== 'none';
      statsToggle.checked = visible;
    }
    statsToggle.addEventListener('change', () => {
      pushUndo();
      if (statsToggle.checked) {
        // Restore: force at least Dist + Time visible
        const chkDist = document.getElementById('chk-dist');
        const chkTime = document.getElementById('chk-time');
        if (chkDist && !chkDist.checked) { chkDist.checked = true; chkDist.dispatchEvent(new Event('change')); }
        if (chkTime && !chkTime.checked) { chkTime.checked = true; chkTime.dispatchEvent(new Event('change')); }
        window._updateStats?.();
        statsEl.style.display = 'flex';
        // Sync the edit bar chip state if open
        document.getElementById('eb-s-dist')?.classList.toggle('active', document.getElementById('chk-dist')?.checked);
        document.getElementById('eb-s-time')?.classList.toggle('active', document.getElementById('chk-time')?.checked);
      } else {
        statsEl.style.display = 'none';
        if (_selectedEl === statsEl) hideEditBar();
      }
    });
    // Observe changes from the edit bar chips (all-off hides the card)
    window._onStatsVisChange = syncStatsToggle;
  }

  // Legend card
  const legToggle = document.getElementById('layer-legend');
  const legEl = document.getElementById('p-legend');
  if (legToggle && legEl) {
    function syncLegToggle() {
      legToggle.checked = legEl.style.display !== 'none';
    }
    legToggle.addEventListener('change', () => {
      pushUndo();
      if (legToggle.checked) {
        // Restore: force start + finish rows visible
        const chkStart  = document.getElementById('chk-legend-start');
        const chkFinish = document.getElementById('chk-legend-finish');
        if (chkStart  && !chkStart.checked)  { chkStart.checked  = true; chkStart.dispatchEvent(new Event('change')); }
        if (chkFinish && !chkFinish.checked) { chkFinish.checked = true; chkFinish.dispatchEvent(new Event('change')); }
        legEl.style.display = '';
        document.getElementById('eb-l-start')?.classList.add('active');
        document.getElementById('eb-l-finish')?.classList.add('active');
      } else {
        legEl.style.display = 'none';
        if (_selectedEl === legEl) hideEditBar();
      }
    });
    window._onLegVisChange = syncLegToggle;
  }
}

function initEditBar() {
  // Deselect (and close bar) when pointer goes down on the canvas background.
  // Done on pointerdown so that _selectedEl is already null before interact.js
  // tries to start any drag on the newly-tapped element.
  document.getElementById('app')?.addEventListener('pointerdown', e => {
    const isPosterEl = e.target.closest('.p-text,.p-stats,.p-legend,.p-brand');
    const isEditBar  = e.target.closest('#edit-bar');
    if (!isPosterEl && !isEditBar) hideEditBar();
  });

  document.getElementById('topbar')?.addEventListener('pointerdown', hideEditBar);
  document.getElementById('drawer')?.addEventListener('pointerdown', hideEditBar);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') hideEditBar(); });

  // Hook stats card
  const statsEl = document.getElementById('p-stats');
  if (statsEl) {
    let _sx = 0, _sy = 0;
    statsEl.addEventListener('pointerdown', e => { _sx = e.clientX; _sy = e.clientY; });
    statsEl.addEventListener('pointerup', e => {
      if (Math.hypot(e.clientX - _sx, e.clientY - _sy) >= 20) return;
      if (e.target.contentEditable === 'true') return;
      if (_selectedEl) _selectedEl.classList.remove('poster-el-selected');
      _selectedEl = statsEl;
      statsEl.classList.add('poster-el-selected');
      showStatsEditBar(statsEl);
    });
  }

  // Hook legend
  const legEl = document.getElementById('p-legend');
  if (legEl) {
    let _lx = 0, _ly = 0;
    legEl.addEventListener('pointerdown', e => { _lx = e.clientX; _ly = e.clientY; });
    legEl.addEventListener('pointerup', e => {
      if (Math.hypot(e.clientX - _lx, e.clientY - _ly) >= 20) return;
      if (_selectedEl) _selectedEl.classList.remove('poster-el-selected');
      _selectedEl = legEl;
      legEl.classList.add('poster-el-selected');
      showLegendEditBar(legEl);
    });
  }
}

window.hideEditBar = hideEditBar;
