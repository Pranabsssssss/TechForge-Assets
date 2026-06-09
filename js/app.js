

async function fetchDirectory(url, depth = 0){
  // Attempt to fetch an index page at url and parse anchors; recurse into subfolders up to depth
  try{
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) return [];
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const anchors = Array.from(doc.querySelectorAll('a'))
      .map(a=>a.getAttribute('href'))
      .filter(Boolean);
    const results = [];
    for(const h of anchors){
      // skip parent links
      if(h === '../' || h === '/') continue;
      // build absolute path relative to url
      const abs = new URL(h, url).href;
      if(/\/$/.test(h) && depth < 2){
        // subdirectory: recurse
        const sub = await fetchDirectory(abs, depth+1);
        results.push(...sub);
      }else{
        // file: include (any file type) -> assets should list all files as tiles
        // Skip items that look like directory entries ending with '/'
        if(!/\/$/.test(h)) results.push(abs);
      }
    }
    return results;
  }catch(e){ return []; }
}

async function loadAssets(){
  const grid = document.getElementById('grid');
  const status = document.getElementById('status');
  const search = document.getElementById('search');
  const filter = document.getElementById('filter');

  const normalize = (raw) => {
    if(!raw) return null;
    // If it's an absolute URL, return as-is
    if(/^https?:\/\//i.test(raw) || /^\/\//.test(raw)) return raw;
    let p = raw.replace(/\\+/g, '/');
    try{ p = decodeURIComponent(p); }catch(e){}
    p = p.split(/[?#]/)[0];
    p = p.replace(/^\.\//, '').replace(/^\//, '');
    if(!/^assets\//i.test(p)) p = 'assets/' + p;
    // resolve relative to current location
    return new URL(p, location.href).href;
  };

  status.textContent = 'Discovering assets…';
  let files = [];

  // 1) Try index.json (explicit list)
  try{
    const res = await fetch('assets/index.json', {cache:'no-store'});
    if(res.ok){
      const json = await res.json(); if(Array.isArray(json)) files = json.map(normalize).filter(Boolean);
    }
  }catch(e){}

  // 2) Try manifest.json
  if(!files.length){
    try{
      const res = await fetch('assets/manifest.json', {cache:'no-store'});
      if(res.ok){ const json = await res.json(); if(Array.isArray(json)) files = json.map(normalize).filter(Boolean); }
    }catch(e){}
  }

  // 3) Try directory listing and recursive discovery
  if(!files.length){
    const discovered = await fetchDirectory(new URL('assets/', location.href).href, 0);
    files = discovered.map(u => u);
  }

  files = Array.from(new Set(files));

  if(!files.length){ status.textContent = 'No assets found in /assets'; grid.innerHTML = '<div class="card"><div class="meta">No assets found in <span class="mono">/assets</span>.</div></div>'; return; }

  status.textContent = `${files.length} asset${files.length>1?'s':''} found`;

  function makeCard(url){
    const u = url;
    // Robustly derive display name from URL/path even when directory listings return
    // Windows-style backslashes encoded as %5C or literal backslashes.
    let name = (function(){
      try{
        const urlObj = new URL(u, location.href);
        let p = urlObj.pathname || u;
        p = p.replace(/\\+/g, '/');
        const segs = p.split('/').filter(Boolean);
        let n = segs.pop() || '';
        n = decodeURIComponent(n);
        n = n.replace(/\\+/g, '/');
        n = n.split('/').filter(Boolean).pop() || n;
        return n.replace(/^\/+/, '');
      }catch(e){
        try{ const raw = u.split('/').pop() || u; return decodeURIComponent(raw).replace(/\\+/g,'/').split('/').pop(); }catch(e){ return (u.split('/').pop()||u); }
      }
    })();
    const ext = (name.split('.').pop()||'').toLowerCase();

    const card = document.createElement('div'); card.className = 'card'; card.setAttribute('role','listitem');
    const thumb = document.createElement('div'); thumb.className = 'thumb';

    // Render SVG inline for crispness; images use <img>; other files show an icon
    if(ext === 'svg'){
      // fetch SVG text and inject
      fetch(u, {cache:'no-store'}).then(r=> r.text()).then(svgText=>{
        // Minimal safety: if it looks like svg, inject; otherwise fallback to img
        if(/<svg[\s>]/i.test(svgText)){
          thumb.innerHTML = svgText;
          // Make sure injected svg scales to fit
          const sv = thumb.querySelector('svg'); if(sv){ sv.setAttribute('width','100%'); sv.setAttribute('height','100%'); sv.style.maxWidth = '100%'; sv.style.maxHeight='100%'; }
        }else{
          const img = document.createElement('img'); img.src = u; img.alt = name; img.loading = 'lazy'; thumb.appendChild(img);
        }
      }).catch(()=>{ const img = document.createElement('img'); img.src = u; img.alt = name; img.loading = 'lazy'; thumb.appendChild(img); });
    }else if(/\.(png|jpe?g|gif|webp)$/i.test(name)){
      const img = document.createElement('img'); img.src = u; img.alt = name; img.loading = 'lazy'; thumb.appendChild(img);
    }else{
      // generic file icon with extension
      const icon = document.createElement('div'); icon.className = 'file-icon'; icon.textContent = ext ? ext.toUpperCase() : 'FILE'; thumb.appendChild(icon);
    }

    const meta = document.createElement('div'); meta.className = 'meta';
    const title = document.createElement('div'); title.className = 'name'; title.title = name; title.textContent = name;
    const extLabel = document.createElement('div'); extLabel.className = 'ext'; extLabel.textContent = ext ? ext.toUpperCase() : '';

    const actions = document.createElement('div'); actions.className = 'actions';
    const btnCopy = document.createElement('button'); btnCopy.className = 'btn'; btnCopy.textContent = 'Copy Link';
    btnCopy.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(u); btnCopy.textContent='Copied'; setTimeout(()=>btnCopy.textContent='Copy Link',1000);}catch(e){alert('Copy failed')}});
    const btnOpen = document.createElement('button'); btnOpen.className = 'btn'; btnOpen.textContent = 'Open'; btnOpen.addEventListener('click', ()=>window.open(u,'_blank'));

    actions.appendChild(btnCopy); actions.appendChild(btnOpen);
    meta.appendChild(title); meta.appendChild(extLabel); meta.appendChild(actions);

    card.appendChild(thumb); card.appendChild(meta);
    return card;
  }

  let rendered = files.slice();

  function render(list){ grid.innerHTML = ''; list.forEach(u=> grid.appendChild(makeCard(u))); }

  render(rendered);

  // Filtering
  function applyFilters(){
    const q = (search.value || '').trim().toLowerCase();
    const f = filter.value;
    const out = files.filter(u=>{
      const n = u.split('/').pop().toLowerCase();
      if(f !== 'all' && !n.endsWith('.'+f)) return false;
      if(!q) return true;
      return n.includes(q) || u.toLowerCase().includes(q);
    });
    status.textContent = `${out.length} result${out.length!==1?'s':''}`;
    render(out);
  }

  search.addEventListener('input', applyFilters);
  filter.addEventListener('change', applyFilters);
}

document.addEventListener('DOMContentLoaded', loadAssets);
