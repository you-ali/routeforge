document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-export').addEventListener('click', doExport);
});

// CSS properties that dom-to-image may not resolve from cascaded stylesheet
// rules or CSS custom properties (--sc-size, etc.).
const INLINE_PROPS = ['fontFamily', 'fontSize', 'color', 'fontWeight', 'fontStyle', 'textDecoration',
                      'lineHeight', 'letterSpacing', 'textTransform', 'opacity'];

/** Phone / PWA: prefer system share so user can Save to Photos; desktop keeps file download */
function _preferNativeGalleryShare() {
  if (typeof navigator.share !== 'function') return false;
  const narrow = window.matchMedia('(max-width: 899px)').matches;
  const standalone =
    window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const touch = (navigator.maxTouchPoints || 0) > 0;
  return narrow || standalone || (touch && coarse);
}

/**
 * @param {string} dataUrl png data URL from dom-to-image
 * @param {string} filename
 * @returns {'shared'|'aborted'|'unsupported'}
 */
async function _sharePngForGallery(dataUrl, filename) {
  if (typeof navigator.canShare !== 'function') return 'unsupported';
  let file;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    file = new File([blob], filename, { type: 'image/png' });
  } catch {
    return 'unsupported';
  }
  if (!navigator.canShare({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({
      files: [file],
      title: 'RouteForge',
    });
    return 'shared';
  } catch (e) {
    if (e && e.name === 'AbortError') return 'aborted';
    console.warn('navigator.share', e);
    return 'unsupported';
  }
}

function _triggerPngDownload(dataUrl, filename) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = dataUrl;
  a.click();
}

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
      let freshUrl = await window.compositeMapCanvas();
      // Cold mobile network: first attempt can still catch zero tiles; retry once after a beat.
      if (window._lastCompositeTileCount === 0) {
        await new Promise(r => setTimeout(r, 450));
        freshUrl = await window.compositeMapCanvas();
      }
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
  const filename = `RouteForge-${sizeKey}-${w}x${h}.png`;

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

  const pngOpts = {
    width: w,
    height: h,
    // Strip the CSS scale so dom-to-image sees the frame at natural 1080 px
    style: { transform: 'none', transformOrigin: 'top left' },
  };

  try {
    // First capture warms the pipeline (map <img> + dom-to-image); discard it.
    // Second capture is what we save — fixes missing map on some WebKit builds.
    await domtoimage.toPng(frame, pngOpts);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const url = await domtoimage.toPng(frame, pngOpts);

    let usedShare = false;
    if (_preferNativeGalleryShare()) {
      const shareResult = await _sharePngForGallery(url, filename);
      if (shareResult === 'shared') {
        showToast(`Tap “Save Image” (or Photos) in the share sheet — ${w}×${h}px`);
        usedShare = true;
      } else if (shareResult === 'aborted') {
        showToast('Export cancelled');
        usedShare = true;
      }
    }
    if (!usedShare) {
      _triggerPngDownload(url, filename);
      showToast(`Saved ${w}×${h}px`);
    }
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

window.doExport = doExport;
