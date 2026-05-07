let routeNodes=[];
window.isDrawingMode=false;
let routeTimer=null, startStyle='pin', endStyle='flag';

document.addEventListener('DOMContentLoaded', async ()=>{
  initMap('map');
  await initThemes();
  initTabs();
  initResizer();
  initMobile();
  addNode(); addNode();

  document.getElementById('btn-toggle-draw').addEventListener('click',()=>{window.isDrawingMode=!window.isDrawingMode;applyDrawMode();updateBanner()});
  document.getElementById('btn-stop-draw').addEventListener('click',()=>{window.isDrawingMode=false;applyDrawMode()});

  window.onMapClick=async(lat,lng)=>{
    updateBanner('Looking up address…');
    const geo=await reverseGeocode(lat,lng);
    const addr=geo.display_name;
    const empty=routeNodes.find(n=>!n.lat);
    if(empty){empty.lat=lat;empty.lng=lng;empty.address=addr}
    else routeNodes.push({id:uid(),address:addr,lat,lng});
    renderNodes(); triggerRoute(); updateBanner();
  };

  // Icon pickers
  document.querySelectorAll('#start-icon-picker .icn').forEach(o=>o.addEventListener('click',()=>{document.querySelectorAll('#start-icon-picker .icn').forEach(x=>x.classList.remove('active'));o.classList.add('active');startStyle=o.dataset.icon;refreshMarkers()}));
  document.querySelectorAll('#end-icon-picker .icn').forEach(o=>o.addEventListener('click',()=>{document.querySelectorAll('#end-icon-picker .icn').forEach(x=>x.classList.remove('active'));o.classList.add('active');endStyle=o.dataset.icon;refreshMarkers()}));

  document.getElementById('btn-add-node').addEventListener('click',()=>{addNode();renderNodes()});

  // Reset
  document.getElementById('btn-reset').addEventListener('click',()=>document.getElementById('reset-confirm').style.display='block');
  document.getElementById('confirm-yes').addEventListener('click',()=>{
    routeNodes=[];addNode();addNode();
    window.currentRouteData=null;clearRoute();
    window.setStatVal?.('dist','—');
    window.setStatVal?.('time','—');
    document.getElementById('poster-map-img').style.display='none';
    document.getElementById('poster-empty').style.display='flex';
    document.getElementById('reset-confirm').style.display='none';
    renderNodes();
  });
  document.getElementById('confirm-no').addEventListener('click',()=>document.getElementById('reset-confirm').style.display='none');
});

function uid(){return Date.now()+Math.random()}
function addNode(addr='',lat=null,lng=null){routeNodes.push({id:uid(),address:addr,lat,lng})}

function renderNodes(){
  const list=document.getElementById('route-nodes-list');
  list.innerHTML='';
  routeNodes.forEach((n,i)=>{
    const isS=i===0,isE=i===routeNodes.length-1&&routeNodes.length>1;
    const bg=isS?'#34C759':isE?'#FF3B30':'#007AFF';
    const lbl=isS?'S':isE?'F':i;
    const d=document.createElement('div');d.className='nd';
    d.innerHTML=`<div class="nd-badge" style="background:${bg}">${lbl}</div><input class="nd-input" type="text" value="${n.address}" placeholder="${isS?'Start address…':isE?'End address…':'Via point…'}"><button class="nd-del">✕</button>`;
    d.querySelector('input').addEventListener('change',e=>handleAddrChange(n.id,e.target.value));
    d.querySelector('.nd-del').addEventListener('click',()=>{routeNodes=routeNodes.filter(x=>x.id!==n.id);if(!routeNodes.length){addNode();addNode()}renderNodes();triggerRoute()});
    list.appendChild(d);
  });
  refreshMarkers();
}

async function handleAddrChange(id,address){
  const n=routeNodes.find(x=>x.id===id);if(!n)return;
  n.address=address;
  if(!address.trim()){n.lat=null;n.lng=null;renderNodes();triggerRoute();return}
  try{const g=await geocode([address]);if(g.results[0]&&!g.results[0].error){n.lat=g.results[0].lat;n.lng=g.results[0].lon;triggerRoute()}}catch(e){}
}

function refreshMarkers(){
  const valid=routeNodes.filter(n=>n.lat&&n.lng);
  placeEditMarkers(valid,startStyle,endStyle,async(id,lat,lng,addr)=>{
    const n=routeNodes.find(x=>x.id===id);
    if(n){n.lat=lat;n.lng=lng;n.address=addr;renderNodes();triggerRoute()}
  });
}
window.refreshMarkers=refreshMarkers;

// Haversine distance in metres between two {lat,lng} points
function haversine(a,b){
  const R=6371000,r=Math.PI/180;
  const lat1=a.lat*r,lat2=b.lat*r;
  const dLat=(b.lat-a.lat)*r,dLon=(b.lng-a.lng)*r;
  const x=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

// Build a straight-line route (geodesic segments, like Google Maps "Measure distance").
// No road-snapping — the line goes exactly where you place your points.
function buildStraightRoute(nodes){
  const coords=nodes.map(n=>[n.lng,n.lat]); // GeoJSON order: [lon, lat]
  let dist=0;
  for(let i=1;i<nodes.length;i++) dist+=haversine(nodes[i-1],nodes[i]);
  const pace=10/60/60; // 10 km/h running pace → km per second
  return{
    geojson:{type:'LineString',coordinates:coords},
    distance_m:dist,
    duration_s:dist/(pace*1000)
  };
}

function triggerRoute(){clearTimeout(routeTimer);routeTimer=setTimeout(doRoute,400)}

function doRoute(){
  const valid=routeNodes.filter(n=>n.lat&&n.lng);
  if(valid.length<2){window.currentRouteData=null;clearRoute();refreshMarkers();return}
  const rd=buildStraightRoute(valid);
  window.currentRouteData={geojson:rd.geojson,coords:valid.map(n=>[n.lat,n.lng])};
  drawRoute(rd.geojson);refreshMarkers();
  window.setStatVal?.('dist',`${(rd.distance_m/1000).toFixed(1)} KM`);
  const m=Math.round(rd.duration_s/60);
  window.setStatVal?.('time',m<60?`${m} MIN`:`${Math.floor(m/60)}H ${m%60?m%60+'M':''}`);
  window.setStatVal?.('surf','PAVEMENT');
  setTimeout(()=>window.updatePosterPreview?.({resetPan:true}),700);
}

function updateBanner(override){
  const n=routeNodes.filter(x=>x.lat).length;
  document.getElementById('draw-banner-text').textContent=override||(n===0?'Click map to place Start':n===1?'Click to add more points':n+' points — click more or Done');
}

function initTabs(){document.querySelectorAll('.panel-tab').forEach(t=>t.addEventListener('click',()=>{document.querySelectorAll('.panel-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab-pane').forEach(x=>x.classList.remove('active'));t.classList.add('active');document.getElementById('tab-'+t.dataset.tab)?.classList.add('active')}))}

function initResizer(){
  let on=false;const rs=document.getElementById('resizer');
  rs.addEventListener('mousedown',()=>{on=true;rs.classList.add('on');document.body.style.cursor='col-resize';document.body.style.userSelect='none'});
  window.addEventListener('mousemove',e=>{
    if(!on)return;
    const w=document.body.clientWidth-e.clientX;
    if(w>260&&w<document.body.clientWidth*.75){
      document.documentElement.style.setProperty('--right-w',w+'px');
      // Defer until after the browser recalculates layout from the CSS variable change
      requestAnimationFrame(()=>window.scalePoster?.());
    }
  });
  window.addEventListener('mouseup',()=>{if(on){on=false;rs.classList.remove('on');document.body.style.cursor='';document.body.style.userSelect=''}});
  window.addEventListener('resize',()=>requestAnimationFrame(()=>window.scalePoster?.()));
}

function showToast(msg,dur=3000){const c=document.getElementById('toasts'),t=document.createElement('div');t.className='toast';t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),dur)}
window.showToast=showToast;

// ── Mobile layout ──────────────────────────────────────────────────────────────
function initMobile(){
  const isMob=()=>window.innerWidth<=768;
  if(!isMob()) return;

  const leftPanel  = document.querySelector('.left-panel');
  const rightPanel = document.getElementById('right-panel');
  const backdrop   = document.getElementById('mob-backdrop');
  const exportBtn  = document.getElementById('btn-export-mobile');

  const btns = {
    map:      document.getElementById('mnav-map'),
    controls: document.getElementById('mnav-controls'),
    preview:  document.getElementById('mnav-preview'),
  };

  let currentView = 'map';

  function showView(view){
    currentView = view;

    // Panel visibility
    leftPanel.classList.toggle('mob-open',  view==='controls');
    rightPanel.classList.toggle('mob-open', view==='preview');
    backdrop.classList.toggle('visible',    view==='controls');

    // Nav active state
    Object.entries(btns).forEach(([k,b])=>b?.classList.toggle('active', k===view));

    // Trigger poster scaling when preview becomes visible
    if(view==='preview') requestAnimationFrame(()=>window.scalePoster?.());
  }

  Object.entries(btns).forEach(([view, btn])=>{
    btn?.addEventListener('click',()=>showView(view));
  });

  // Tapping the backdrop closes the controls sheet
  backdrop?.addEventListener('click',()=>showView('map'));

  // Export shortcut in topbar → same as the main export button
  exportBtn?.addEventListener('click',()=>document.getElementById('btn-export')?.click());

  // Show the mobile export button
  if(exportBtn) exportBtn.style.display='flex';

  // Auto-switch to Map view when draw mode is turned on
  const origApplyDraw = window.applyDrawMode;
  window.applyDrawMode = function(...args){
    if(isMob() && window.isDrawingMode) showView('map');
    return origApplyDraw?.(...args);
  };

  // Recalculate on orientation change
  window.addEventListener('orientationchange',()=>setTimeout(()=>window.scalePoster?.(),300));

  showView('map');
}
