import { useEffect, useState } from 'react'

export default function Home(){
  const [files, setFiles] = useState([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(()=>{
    fetch('/api/assets').then(r=>r.json()).then(data=> setFiles(data || []));
  },[]);

  const visible = files.filter(f=>{
    if(filter !== 'all' && f.ext !== filter) return false;
    if(!q) return true;
    return f.name.toLowerCase().includes(q.toLowerCase()) || f.url.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div>
      <header className="topbar">
        <div className="brand">
          <h1>TechForge</h1>
          <p className="muted">Team asset library</p>
        </div>
        <div className="controls">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search assets (name or extension)" />
          <select value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">All types</option>
            <option value="svg">SVG</option>
            <option value="png">PNG</option>
            <option value="jpg">JPG/JPEG</option>
            <option value="webp">WEBP</option>
          </select>
        </div>
      </header>

      <main className="main">
        <section className="content" style={{width: '100%'}}>
          <div className="status">{visible.length} result{visible.length!==1?'s':''}</div>
          <div className="grid">
            {visible.map(f=> (
              <Tile key={f.url} file={f} />
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">TechForge · Next.js asset viewer</footer>
    </div>
  )
}

function Tile({file}){
  const { url, name, ext } = file;
  const copy = async ()=>{ await navigator.clipboard.writeText(location.origin + url); alert('Copied'); }
  const open = ()=> window.open(url, '_blank');

  return (
    <div className="card" role="listitem">
      <div className="thumb">
        {ext === 'svg' ? <InlineSVG src={url} /> : (ext.match(/png|jpe?g|gif|webp/) ? <img src={url} alt={name} loading="lazy"/> : <div className="file-icon">{ext.toUpperCase()||'FILE'}</div>)}
      </div>
      <div className="meta">
        <div className="name" title={name}>{name}</div>
        <div className="ext">{ext.toUpperCase()}</div>
        <div className="actions">
          <button className="btn" onClick={copy}>Copy Link</button>
          <button className="btn" onClick={open}>Open</button>
        </div>
      </div>
    </div>
  )
}

function InlineSVG({src}){
  const [svg, setSvg] = useState(null);
  useEffect(()=>{ fetch(src).then(r=>r.text()).then(t=> setSvg(t)).catch(()=>setSvg(null)); },[src]);
  if(!svg) return <div className="file-icon">SVG</div>;
  return <div className="inline-svg" dangerouslySetInnerHTML={{__html: svg}} />
}
