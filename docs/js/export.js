document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-export').addEventListener('click', doExport);
});

// CSS properties that dom-to-image may not resolve from cascaded stylesheet
// rules or CSS custom properties (--sc-size, etc.).
const INLINE_PROPS = ['fontFamily', 'fontSize', 'color', 'fontWeight',
                      'lineHeight', 'letterSpacing', 'textTransform', 'opacity'];

async function doExport() {
  if (!window.currentRouteData) { showToast('Draw a route first'); return; }

  const frame = document.getElementById('poster-frame');
  const img   = document.getElementById('poster-map-img');

  showToast('Capturing…');

  // Always re-composite from the current visible map so the exported position
  // matches exactly what the user sees (compositeMapCanvas reads the live #map,
  // so there is no hidden-map sync / position-shift problem).
  if (window.compositeMapCanvas) {
    try {
      const freshUrl = await window.compositeMapCanvas();
      if (freshUrl && img) {
        img.src = freshUrl;
        await (img.decode?.().catch(() => {}) ?? new Promise(r => { img.onload = r; }));
      }
    } catch (_) {}
  }

  // If still no valid image after re-composite, bail.
  if (!img || !img.getAttribute('src') || img.naturalWidth === 0) {
    showToast('Map preview not ready — please wait a moment');
    return;
  }

  // Determine export dimensions from the active size class
  const dims    = { portrait: { w: 1080, h: 1350 }, square: { w: 1080, h: 1080 }, landscape: { w: 1080, h: 566 } };
  const sizeKey = Array.from(frame.classList).find(c => c.startsWith('size-'))?.replace('size-', '') || 'portrait';
  const { w, h } = dims[sizeKey] || dims.portrait;

  // Show the captured map image so dom-to-image sees the full poster.
  // On screen the frame is transparent (real map shows through), but for
  // export we need the captured image to fill the frame background.
  img.style.display = 'block';
  window.applyMapOffset?.(img);

  // Temporarily inline computed styles on text elements so dom-to-image
  // sees explicit values instead of unresolvable CSS custom properties.
  const targets = Array.from(frame.querySelectorAll('.ps-val,.ps-label,.ps-icon,.p-text'));
  const saved   = targets.map(el => {
    const snap = el.style.cssText;
    const cs   = getComputedStyle(el);
    INLINE_PROPS.forEach(p => { el.style[p] = cs[p]; });
    return snap;
  });

  try {
    const url = await domtoimage.toPng(frame, {
      width: w, height: h,
      // Strip the CSS scale so dom-to-image sees the frame at natural 1080 px
      style: { transform: 'none', transformOrigin: 'top left' }
    });
    const a = document.createElement('a');
    a.download = `step6ix-run-${w}x${h}.png`;
    a.href = url; a.click();
    showToast(`Saved ${w}×${h} px ✓`);
  } catch (e) {
    console.error(e);
    showToast('Export failed — try again');
  } finally {
    // Always restore — even if the capture threw
    targets.forEach((el, i) => { el.style.cssText = saved[i]; });
    // Hide the map image again (the real Leaflet map shows through on screen)
    img.style.display = 'none';
  }
}
