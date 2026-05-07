document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('btn-export').addEventListener('click',doExport);
});

// Properties that use CSS custom properties (--sc-size, --poster-font, etc.)
// or that dom-to-image may not resolve correctly from cascaded stylesheet rules.
const INLINE_PROPS=['fontFamily','fontSize','color','fontWeight',
                    'lineHeight','letterSpacing','textTransform','opacity'];

async function doExport(){
  if(!window.currentRouteData){showToast('Generate a route first');return}

  // Only (re)capture the map if the preview image hasn't been generated yet.
  // Skipping re-capture ensures the export is a pixel-accurate match of exactly
  // what the user sees — including any pan offset and manual stat edits.
  const previewImg=document.getElementById('poster-map-img');
  if(!previewImg.naturalWidth){
    await window.updatePosterPreview?.();
    await new Promise(r=>setTimeout(r,400));
  }

  const frame=document.getElementById('poster-frame');
  const dims={portrait:{w:1080,h:1350},square:{w:1080,h:1080},landscape:{w:1080,h:566}};
  const sizeKey=Array.from(frame.classList).find(c=>c.startsWith('size-'))?.replace('size-','') || 'portrait';
  const{w,h}=dims[sizeKey]||dims.portrait;

  // dom-to-image clones the DOM but does NOT resolve CSS custom properties
  // (--sc-size, --sc-label-size, --poster-font …) when building the SVG.
  // We temporarily write the browser's computed values as inline styles so
  // the SVG renderer sees explicit values for every text element.
  const targets=Array.from(frame.querySelectorAll('.ps-val,.ps-label,.ps-icon,.p-text'));
  const saved=targets.map(el=>{
    const snap=el.style.cssText;
    const cs=getComputedStyle(el);
    INLINE_PROPS.forEach(p=>{ el.style[p]=cs[p]; });
    return snap;
  });

  try{
    const url=await domtoimage.toPng(frame,{
      width:w,height:h,
      // Strip the preview's CSS scale so dom-to-image sees the frame at its
      // natural 1080px dimensions.
      style:{transform:'none',transformOrigin:'top left'}
    });
    const a=document.createElement('a');
    a.download=`routeforge-${w}x${h}.png`;
    a.href=url;a.click();
    showToast(`Saved ${w}×${h}px ✓`);
  }catch(e){
    console.error(e);showToast('Export failed');
  }finally{
    // Always restore — even if the capture threw
    targets.forEach((el,i)=>{ el.style.cssText=saved[i]; });
  }
}
