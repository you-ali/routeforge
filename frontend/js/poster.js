const FONTS = ['Bebas Neue','Barlow Condensed','Montserrat','Oswald','DM Sans','Space Grotesk','Syne','IBM Plex Mono','Playfair Display','Cormorant Garamond'];

// Four-level typographic hierarchy inspired by the reference poster.
// Positions are in the 1080×1350px poster coordinate space.
let textEls=[
  // ① Hero headline
  {id:2, text:'Step6ix',       size:148, color:'#ffffff', bgColor:'#000', removeBg:true, font:'Bebas Neue',        x:60, y:62},
  // ② Date subtitle
  {id:3, text:'Date',          size:90,  color:'#ffffff', bgColor:'#000', removeBg:true, font:'Bebas Neue',        x:62, y:230},
  // ③ Starting point line
  {id:4, text:'starting point', size:50, color:'#cccccc', bgColor:'#000', removeBg:true, font:'Barlow Condensed', x:62, y:340},
];

// Pan offset for the captured map image (poster-frame pixels)
let mapOffsetX=0, mapOffsetY=0;

document.addEventListener('DOMContentLoaded',()=>{
  renderTextUI();renderTextPoster();
  initStatsCtrl();initLegendCtrl();initLogoCtrl();initPosterScale();initMapImageDrag();initPosterMapCtrls();
});

// ── Map Image Pan ───────────────────────────────────────────────────────────
// Lets the user reposition which part of the map snapshot fills the poster.
// Delta is divided by the current CSS scale so dragging 1 screen-px moves
// exactly 1 poster-pixel at any zoom level.

function initMapImageDrag(){
  const img=document.getElementById('poster-map-img');
  if(!img)return;
  let dragging=false,sx,sy,sox,soy;

  img.addEventListener('mousedown',e=>{
    e.preventDefault();dragging=true;
    sx=e.clientX;sy=e.clientY;sox=mapOffsetX;soy=mapOffsetY;
    img.style.cursor='grabbing';
  });
  window.addEventListener('mousemove',e=>{
    if(!dragging)return;
    const sc=getScale();
    mapOffsetX=sox+(e.clientX-sx)/sc;
    mapOffsetY=soy+(e.clientY-sy)/sc;
    applyMapOffset(img);
  });
  window.addEventListener('mouseup',()=>{
    if(dragging){dragging=false;img.style.cursor='grab';}
  });
}

// Scale the captured map image to cover the poster frame (background-size:cover
// equivalent) and apply the user's pan offset on top.  No extra zoom factor —
// geographic zoom is controlled by changing the capture map's zoom level and
// re-capturing, so the image always fills the frame edge-to-edge.
function applyMapOffset(img){
  img=img||document.getElementById('poster-map-img');
  if(!img)return;
  const frame=document.getElementById('poster-frame');
  if(!frame)return;
  const fw=frame.offsetWidth, fh=frame.offsetHeight;
  const iw=img.naturalWidth,  ih=img.naturalHeight;
  if(iw&&ih&&fw&&fh){
    const sc=Math.max(fw/iw, fh/ih);
    const dw=Math.round(iw*sc), dh=Math.round(ih*sc);
    const bx=(fw-dw)/2, by=(fh-dh)/2;
    img.style.width =dw+'px';
    img.style.height=dh+'px';
    img.style.transform=`translate(${bx+mapOffsetX}px,${by+mapOffsetY}px)`;
  } else {
    img.style.transform=`translate(${mapOffsetX}px,${mapOffsetY}px)`;
  }
}
window.applyMapOffset=applyMapOffset;

// ── Poster Map Controls (zoom in/out + manual refresh) ───────────────────────
// + / − change the CAPTURE MAP's geographic zoom then re-capture.
// This means zooming out shows a wider area of real map tiles — no black edges
// and no artificial floor.  Drag pans the captured image without re-capturing.
// ⟳ resets pan and refits to the full route.

function initPosterMapCtrls(){
  async function captureZoom(delta){
    const cm=window._captureMap;
    if(cm){
      cm.setZoom(cm.getZoom()+delta,{animate:false});
      window._captureTilesReady=false;
    }
    await window.updatePosterPreview?.();
  }

  document.getElementById('btn-pmap-zi').addEventListener('click',()=>captureZoom(+0.5));
  document.getElementById('btn-pmap-zo').addEventListener('click',()=>captureZoom(-0.5));

  document.getElementById('btn-pmap-refresh').addEventListener('click',async ()=>{
    mapOffsetX=0; mapOffsetY=0;
    // Re-fit to full route bounds then re-capture
    const cm=window._captureMap;
    const geojson=window.currentRouteData?.geojson;
    if(cm && geojson){
      const coords=geojson.coordinates.map(c=>[c[1],c[0]]);
      window._captureTilesReady=false;
      cm.fitBounds(L.latLngBounds(coords),{padding:[80,80],animate:false});
    }
    await window.updatePosterPreview?.();
  });
}

// ── Text Elements ──

function renderTextUI(){
  const list=document.getElementById('text-elements-list');
  list.innerHTML='';
  textEls.forEach(el=>{
    const card=document.createElement('div');card.className='tel';
    // Font options HTML
    const fontOpts=FONTS.map(f=>`<option value="${f}" ${f===el.font?'selected':''}>${f}</option>`).join('');
    card.innerHTML=`
      <div class="tel-head">
        <input class="tel-name-input" type="text" value="${el.text}">
        <button class="tel-del">✕</button>
      </div>
      <div class="tel-row">
        <div style="flex:1"><div class="tel-label">Font</div><select class="inp-font" style="width:100%;padding:4px 6px;border:1px solid var(--border2);border-radius:6px;font-size:11px;background:var(--bg);color:var(--t1)">${fontOpts}</select></div>
      </div>
      <div class="tel-row">
        <div><div class="tel-label">Size</div><div style="display:flex;align-items:center;gap:4px"><input type="range" class="inp-size" min="12" max="200" value="${el.size}" style="width:100px"><span class="range-val">${el.size}</span></div></div>
      </div>
      <div class="tel-row">
        <div><div class="tel-label">Color</div><input type="color" class="color-swatch inp-color" value="${el.color}" style="width:32px;height:24px"></div>
        <div><div class="tel-label">Bg</div><input type="color" class="color-swatch inp-bg" value="${el.bgColor}" style="width:32px;height:24px"></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;margin-left:auto">
          <span style="font-size:10px;color:var(--t3)">No bg</span>
          <label class="toggle"><input type="checkbox" class="inp-rbg" ${el.removeBg?'checked':''}><span class="tog-track"></span></label>
        </div>
      </div>`;
    card.querySelector('.tel-del').addEventListener('click',()=>{textEls=textEls.filter(t=>t.id!==el.id);document.getElementById('pe-'+el.id)?.remove();renderTextUI()});
    card.querySelector('.tel-name-input').addEventListener('input',e=>{el.text=e.target.value;syncDom(el)});
    card.querySelector('.inp-font').addEventListener('change',e=>{el.font=e.target.value;syncDom(el)});
    card.querySelector('.inp-size').addEventListener('input',e=>{el.size=+e.target.value;card.querySelector('.range-val').textContent=el.size;syncDom(el)});
    card.querySelector('.inp-color').addEventListener('input',e=>{el.color=e.target.value;syncDom(el)});
    card.querySelector('.inp-bg').addEventListener('input',e=>{el.bgColor=e.target.value;syncDom(el)});
    card.querySelector('.inp-rbg').addEventListener('change',e=>{el.removeBg=e.target.checked;syncDom(el)});
    list.appendChild(card);
  });
  document.getElementById('btn-add-text').onclick=()=>{
    textEls.push({id:Date.now(),text:'New Text',size:50,color:'#fff',bgColor:'#000',removeBg:true,font:'Bebas Neue',x:80,y:300});
    renderTextUI();renderTextPoster();
  };
}

function syncDom(el){
  const d=document.getElementById('pe-'+el.id);if(!d)return;
  d.textContent=el.text;
  d.style.fontSize=el.size+'px';
  d.style.color=el.color;
  d.style.fontFamily="'"+el.font+"',sans-serif";
  d.style.background=el.removeBg?'transparent':el.bgColor;
  d.style.padding=el.removeBg?'0':'10px 20px';
  d.style.borderRadius=el.removeBg?'0':'6px';
}

function renderTextPoster(){
  const layer=document.getElementById('poster-els');
  // Preserve static poster components; only remove dynamic .p-text elements
  const keep=new Set(['p-stats','p-brand','p-legend']);
  Array.from(layer.children).forEach(c=>{if(!keep.has(c.id))c.remove()});
  textEls.forEach(el=>{
    const div=document.createElement('div');
    div.id='pe-'+el.id;div.className='p-text';
    div.setAttribute('data-id',el.id);
    div.setAttribute('data-x',el.x);div.setAttribute('data-y',el.y);
    div.style.transform=`translate(${el.x}px,${el.y}px)`;

    // Double-click enters inline edit mode; single-click / drag positions the element
    div.addEventListener('dblclick',e=>{
      e.stopPropagation();
      div.contentEditable='true';
      div.focus();
      // Select all text so the user can immediately start typing
      const range=document.createRange();
      range.selectNodeContents(div);
      const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
    });
    div.addEventListener('blur',()=>{
      div.contentEditable='false';
      el.text=div.textContent.trim()||el.text;
      syncDom(el); // Re-applies styles and cleans up any <br> the browser inserted
      // Mirror back to the sidebar input
      const idx=textEls.indexOf(el);
      const cards=document.querySelectorAll('.tel');
      if(cards[idx])cards[idx].querySelector('.tel-name-input').value=el.text;
    });
    div.addEventListener('keydown',e=>{
      // Finish editing on Enter (single-line text box) or Escape
      if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();div.blur();}
    });

    layer.appendChild(div);syncDom(el);
  });
  initDrag();
}

// ── Stats Controls ──

function initStatsCtrl(){
  // Direct toggle handlers — apply immediately
  const chkDist=document.getElementById('chk-dist');
  const chkTime=document.getElementById('chk-time');
  const chkSurf=document.getElementById('chk-surface');

  function updateStats(){
    const d=chkDist.checked, t=chkTime.checked, s=chkSurf.checked;
    document.getElementById('ps-dist').style.display=d?'':'none';
    document.getElementById('ps-time').style.display=t?'':'none';
    document.getElementById('ps-surf').style.display=s?'':'none';
    document.getElementById('ps-div-dt').style.display=(d&&t)?'':'none';
    document.getElementById('ps-div-ts').style.display=(t&&s)?'':'none';
    // If all off, hide entire card
    document.getElementById('p-stats').style.display=(!d&&!t&&!s)?'none':'flex';
  }
  chkDist.addEventListener('change',updateStats);
  chkTime.addEventListener('change',updateStats);
  chkSurf.addEventListener('change',updateStats);

  // Stat icon inputs removed from sidebar (replaced by inline SVGs) — no listeners needed

  // Stat value overrides — sidebar inputs → poster values (two-way sync)
  function bindStatVal(inputId, posterId){
    const inp=document.getElementById(inputId);
    const poster=document.getElementById(posterId);
    // Sidebar → poster
    inp.addEventListener('input',()=>{ if(inp.value.trim()) poster.textContent=inp.value.trim(); });
    // Poster contenteditable → sidebar (when user edits directly in the poster)
    poster.addEventListener('input',()=>{ inp.value=poster.textContent.trim(); });
  }
  bindStatVal('val-dist','ps-val-dist');
  bindStatVal('val-time','ps-val-time');
  bindStatVal('val-surface','ps-val-surf');

  // Expose a helper so builder.js can sync both directions when auto-filling
  window.setStatVal=function(key,text){
    const map={dist:['val-dist','ps-val-dist'],time:['val-time','ps-val-time'],surf:['val-surface','ps-val-surf']};
    const [sid,pid]=map[key]||[];
    if(sid) document.getElementById(sid).value=text;
    if(pid) document.getElementById(pid).textContent=text;
  };

  // Sync value and label sizes together
  function applyStatSize(v){
    document.documentElement.style.setProperty('--sc-size',v+'px');
    // Label at 35% of value size, min 14px — keeps them readable alongside the value
    const lblPx=Math.max(14,Math.round(v*0.35));
    document.documentElement.style.setProperty('--sc-label-size',lblPx+'px');
    document.getElementById('stat-size-val').textContent=v;
  }
  // Initialize from slider default (reads the value attribute, so matches HTML default)
  applyStatSize(+(document.getElementById('stat-size').value||50));
  document.getElementById('stat-size').addEventListener('input',e=>applyStatSize(+e.target.value));

  // Font color
  const statFontPicker=document.getElementById('stat-font-color');
  if(statFontPicker){
    function applyStatFontColor(){
      document.getElementById('p-stats').style.setProperty('--sc-color',statFontPicker.value);
    }
    statFontPicker.addEventListener('input',applyStatFontColor);
    applyStatFontColor();
  }

  // Card bg — border stays visible in both states (changes opacity, never hides)
  function updateBg(){
    const rm=document.getElementById('stat-remove-bg').checked;
    const hex=document.getElementById('stat-bg-color').value;
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    const bg=rm?'transparent':`rgba(${r},${g},${b},.88)`;
    document.documentElement.style.setProperty('--sc-bg',bg);
    document.getElementById('p-stats').style.background=bg;
    document.getElementById('p-stats').style.borderColor=rm?'rgba(255,255,255,.65)':'rgba(255,255,255,.2)';
  }
  document.getElementById('stat-bg-color').addEventListener('input',updateBg);
  document.getElementById('stat-remove-bg').addEventListener('change',updateBg);
  updateBg();
}

// ── Logo ──

function initLogoCtrl(){
  const inp=document.getElementById('logo-upload');
  inp.addEventListener('change',e=>{
    const f=e.target.files[0];if(!f)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      document.getElementById('p-logo').src=ev.target.result;
      document.getElementById('p-logo').style.display='block';
      document.getElementById('logo-preview').src=ev.target.result;
      document.getElementById('logo-preview').style.display='block';
      document.getElementById('btn-remove-logo').style.display='';
      document.getElementById('upload-zone').style.display='none';
    };reader.readAsDataURL(f);
  });
  document.getElementById('btn-remove-logo').addEventListener('click',()=>{
    document.getElementById('p-logo').style.display='none';
    document.getElementById('logo-preview').style.display='none';
    document.getElementById('btn-remove-logo').style.display='none';
    document.getElementById('upload-zone').style.display='';inp.value='';
  });
  document.getElementById('logo-size').addEventListener('input',e=>document.documentElement.style.setProperty('--logo-size',e.target.value+'px'));
}

// ── Legend box ────────────────────────────────────────────────────────────────

function initLegendCtrl(){
  const leg=document.getElementById('p-legend');
  if(!leg)return;

  // Visibility toggle
  const chkVis=document.getElementById('chk-legend');
  if(chkVis){
    chkVis.addEventListener('change',()=>{ leg.style.display=chkVis.checked?'':'none'; });
    leg.style.display=chkVis.checked?'':'none';
  }

  // Auto-hide legend container when every row is off
  function updateLegendContainerVis(){
    const allOff=[...leg.querySelectorAll('.pl-row')].every(r=>r.style.display==='none');
    leg.style.display=allOff?'none':'';
    // Keep the outer visibility checkbox in sync
    const chkVis=document.getElementById('chk-legend');
    if(chkVis&&allOff) chkVis.checked=false;
  }

  // Row label + visibility for each legend row
  function bindRow(inputId, chkId, labelEl){
    const inp=document.getElementById(inputId);
    const chk=document.getElementById(chkId);
    const row=leg.querySelector(labelEl);
    if(inp&&row) inp.addEventListener('input',()=>{ row.textContent=inp.value||row.textContent; });
    if(chk&&row){
      const parentRow=row.closest('.pl-row');
      const divider=parentRow?.nextElementSibling?.classList.contains('pl-div')?parentRow.nextElementSibling:null;
      function applyRow(){
        if(parentRow) parentRow.style.display=chk.checked?'':'none';
        if(divider) divider.style.display=chk.checked?'':'none';
        updateLegendContainerVis();
      }
      chk.addEventListener('change',applyRow);
      applyRow();
    }
  }
  bindRow('val-legend-start','chk-legend-start','.pl-row:first-of-type .pl-label');
  bindRow('val-legend-wp','chk-legend-wp','.pl-row:last-of-type .pl-label');

  // Label size
  function applyLegendSize(v){
    leg.querySelectorAll('.pl-label').forEach(el=>el.style.fontSize=v+'px');
    const sv=document.getElementById('legend-size-val');
    if(sv) sv.textContent=v;
  }
  const legSizeSlider=document.getElementById('legend-size');
  if(legSizeSlider){
    legSizeSlider.addEventListener('input',e=>applyLegendSize(+e.target.value));
    applyLegendSize(+legSizeSlider.value);
  }

  // Font color
  const legFontPicker=document.getElementById('legend-font-color');
  if(legFontPicker){
    function applyLegFontColor(){
      leg.style.setProperty('--pl-color',legFontPicker.value);
    }
    legFontPicker.addEventListener('input',applyLegFontColor);
    applyLegFontColor();
  }

  // Background
  function updateLegendBg(){
    const rm=document.getElementById('legend-remove-bg')?.checked??true;
    const hex=document.getElementById('legend-bg-color')?.value||'#000000';
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    leg.style.background=rm?'transparent':`rgba(${r},${g},${b},.88)`;
    leg.style.borderColor=rm?'rgba(255,255,255,.65)':'rgba(255,255,255,.2)';
  }
  document.getElementById('legend-bg-color')?.addEventListener('input',updateLegendBg);
  document.getElementById('legend-remove-bg')?.addEventListener('change',updateLegendBg);
  updateLegendBg();
}


// ── Interact.js ──

function getScale(){
  const t=document.getElementById('poster-frame').style.transform||'';
  const m=t.match(/scale\(([^)]+)\)/);
  return m?parseFloat(m[1]):1;
}

function initDrag(){
  // Shared drag-move logic for all draggable poster elements
  function dragMove(e){
    // Don't drag when a text element is in inline-edit mode
    if(e.target.contentEditable==='true')return;
    const sc=getScale(),el=e.target;
    const x=(parseFloat(el.getAttribute('data-x'))||0)+e.dx/sc;
    const y=(parseFloat(el.getAttribute('data-y'))||0)+e.dy/sc;
    el.style.transform=`translate(${x}px,${y}px)`;
    el.setAttribute('data-x',x);el.setAttribute('data-y',y);
    const id=el.getAttribute('data-id');
    if(id){const te=textEls.find(t=>t.id==id);if(te){te.x=x;te.y=y}}
  }

  // Text boxes, brand, legend, location stamp: drag anywhere
  interact('.p-text,.p-brand,.p-legend,.p-location').draggable({listeners:{move:dragMove}});

  // Stats card: dragging from the padding / border area is fine, but clicking
  // directly on a label or value should let the browser place the text cursor
  // (those elements already have contenteditable="true").
  interact('.p-stats').draggable({
    ignoreFrom:'.ps-label,.ps-val,.ps-icon',
    listeners:{move:dragMove}
  });

  interact('.p-text').resizable({
    edges:{right:true,bottom:true},
    listeners:{
      move(e){
        if(e.target.contentEditable==='true')return;
        const sc=getScale(),el=e.target,id=el.getAttribute('data-id');if(!id)return;
        const te=textEls.find(t=>t.id==id);if(!te)return;
        const dw=e.deltaRect.width/sc;
        const ratio=(el.offsetWidth+dw)/(el.offsetWidth||1);
        te.size=Math.max(10,Math.min(300,te.size*ratio));
        syncDom(te);
        const cards=document.querySelectorAll('.tel');
        const idx=textEls.indexOf(te);
        if(cards[idx]){cards[idx].querySelector('.inp-size').value=Math.round(te.size);cards[idx].querySelector('.range-val').textContent=Math.round(te.size)}
      }
    }
  });
}

// ── Poster Frame Scaling ─────────────────────────────────────────────────────
// The frame is position:absolute with a fixed 1080×Hpx size.
// We scale it to fit the viewport using translate(centreX, centreY) scale(s)
// from a top-left origin. This means the 1080px layout box never pushes the
// viewport scroll — only the visual pixels change.

function initPosterScale(){
  window.scalePoster=function(){
    const vp=document.getElementById('poster-viewport');
    const frame=document.getElementById('poster-frame');
    if(!vp||!frame)return;
    const vw=vp.clientWidth, vh=vp.clientHeight;
    if(!vw||!vh)return; // not yet laid out
    const fw=frame.offsetWidth, fh=frame.offsetHeight;
    if(!fw||!fh)return;
    // Scale to fit with a small inset margin
    const margin=20;
    const sc=Math.min((vw-margin*2)/fw, (vh-margin*2)/fh);
    // Center visually: translate by the gap between viewport and scaled frame
    const ox=(vw-fw*sc)/2;
    const oy=(vh-fh*sc)/2;
    frame.style.transform=`translate(${ox}px,${oy}px) scale(${sc})`;
  };

  // Fire on load at multiple points to handle font/layout settling
  requestAnimationFrame(()=>requestAnimationFrame(window.scalePoster));
  setTimeout(window.scalePoster,150);
  setTimeout(window.scalePoster,600);

  // ResizeObserver on the viewport — fires after layout recalculation whenever
  // the panel is resized (CSS variable change, window resize, etc.)
  const vpEl=document.getElementById('poster-viewport');
  if(window.ResizeObserver && vpEl){
    new ResizeObserver(()=>requestAnimationFrame(window.scalePoster)).observe(vpEl);
  }

  // Size buttons
  document.querySelectorAll('.sz').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.sz').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById('poster-frame').className='poster-frame size-'+b.dataset.size;
    requestAnimationFrame(window.scalePoster);
  }));
}

// ── Preview capture ─────────────────────────────────────────────────────────

// Wait for the capture map's tiles to finish loading (or timeout)
function waitForCaptureTiles(maxMs=6000){
  if(window._captureTilesReady!==false) return Promise.resolve();
  return new Promise(resolve=>{
    const tid=setInterval(()=>{ if(window._captureTilesReady!==false){clearInterval(tid);resolve();} },150);
    setTimeout(()=>{ clearInterval(tid);resolve(); },maxMs);
  });
}

async function updatePosterPreview(opts={}){
  if(opts.resetPan){ mapOffsetX=0; mapOffsetY=0; }

  // The capture map is a hidden Leaflet instance that always shows the full
  // route fitted to its bounds.  It is completely independent of the visible
  // middle map — the user can pan/zoom the middle map freely without affecting
  // what ends up in the poster.
  const captureEl=document.getElementById('capture-map');
  if(!captureEl) return;

  try{
    await waitForCaptureTiles(6000);
    // Small pause after tiles finish loading so any remaining CSS transitions
    // (like Leaflet's tile fade-in on other browsers) fully complete before capture.
    await new Promise(r=>setTimeout(r,80));

    const url=await domtoimage.toPng(captureEl,{scale:2});

    const img=document.getElementById('poster-map-img');
    img.src=url;
    img.style.display='block';
    document.getElementById('poster-empty').style.display='none';
    // Wait for naturalWidth/Height before computing cover layout
    await (img.decode?.().catch(()=>{}) ?? new Promise(r=>{ img.onload=r; }));
    applyMapOffset(img);
  }catch(e){
    console.warn('preview err',e);
  }
}
window.updatePosterPreview=updatePosterPreview;
