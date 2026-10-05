(function(){
'use strict';

/* =========================================================================
   0. CLOUD DATABASE (read-only) — shared Drive file every visitor reads
========================================================================= */
/* PUBLIC SITE — read-only. */
const CLOUD_DB_FILE_ID = '12iedF9XA-M5Vr188iT9AXgkactijkcSZ'; // hardcoded — every visitor now reads this shared Drive database
const CLOUD_API_KEY = 'AIzaSyB5xb8ydiKRv0GCu73Hfyw7hPevmoAfeNs'; // public, read-only Drive API key

/* =========================================================================
   1. STORAGE KEYS & DEFAULTS
========================================================================= */
const DB = { PROJECTS:'mjbw_projects', CATEGORIES:'mjbw_categories', SETTINGS:'mjbw_settings', THEME:'mjbw_theme', LIVE_SITES:'mjbw_live_sites', BANNERS:'mjbw_banners' };

const DEFAULT_CATEGORIES = ['Websites','Web Applications','Mobile Apps','Tools & Scripts','Other Projects'];

const CATEGORY_ICONS = {
  'Websites':'globe','Web Applications':'layout-grid','Mobile Apps':'smartphone','Tools & Scripts':'wrench','Other Projects':'folder'
};
const CATEGORY_GRADIENTS = {
  'Websites':['#3654FF','#5B82FF'], 'Web Applications':['#7C3AED','#A78BFA'], 'Mobile Apps':['#059669','#34D399'],
  'Tools & Scripts':['#B96E00','#FFB020'], 'Other Projects':['#475569','#94A3B8']
};
function categoryGradient(cat){ const g = CATEGORY_GRADIENTS[cat] || ['#475569','#94A3B8']; return `linear-gradient(135deg,${g[0]},${g[1]})`; }
function categoryIcon(cat){ return CATEGORY_ICONS[cat] || 'folder'; }
function driveImageUrl(fileId){ return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`; }

/* Reusable image slider — used on the home page (all-project previews) and on
   the project detail page (per-project screenshots). items: [{url, alt, href?, caption?}] */
function buildSliderHTML(items, opts){
  opts = opts || {};
  const height = opts.height || '320px';
  if(!items.length) return '';
  const slide = (it)=>{
    const img = `<img src="${it.url}" alt="${escapeHtml(it.alt||'')}" loading="lazy">`;
    const caption = it.caption ? `<div class="img-slider-caption">${escapeHtml(it.caption)}</div>` : '';
    const inner = img+caption;
    return `<div class="img-slider-slide">${it.href ? `<a href="${it.href}">${inner}</a>` : inner}</div>`;
  };
  return `<div class="img-slider" style="--slider-h:${height};">
    <div class="img-slider-track">${items.map(slide).join('')}</div>
    ${items.length>1 ? `<button type="button" class="img-slider-nav prev" data-slide-dir="-1" aria-label="Previous image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m15 18-6-6 6-6"/></svg></button>
    <button type="button" class="img-slider-nav next" data-slide-dir="1" aria-label="Next image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 18 6-6-6-6"/></svg></button>
    <div class="img-slider-dots">${items.map((_,i)=>`<button type="button" class="img-slider-dot${i===0?' active':''}" data-slide-go="${i}" aria-label="Go to image ${i+1}"></button>`).join('')}</div>` : ''}
  </div>`;
}
function wireSlider(root, autoplayMs){
  if(!root) return;
  const track = qs('.img-slider-track', root);
  const slides = qsa('.img-slider-slide', root);
  const dots = qsa('.img-slider-dot', root);
  if(!track || slides.length<2) return;
  let idx = 0, timer = null;
  function go(i){ idx = (i+slides.length)%slides.length; track.style.transform = `translateX(-${idx*100}%)`; dots.forEach((d,di)=> d.classList.toggle('active', di===idx)); }
  function restart(){ if(timer) clearInterval(timer); if(autoplayMs) timer = setInterval(()=> go(idx+1), autoplayMs); }
  qsa('[data-slide-dir]', root).forEach(b=> b.onclick = ()=>{ go(idx+Number(b.dataset.slideDir)); restart(); });
  dots.forEach(d=> d.onclick = ()=>{ go(Number(d.dataset.slideGo)); restart(); });
  go(0); restart();
}

function buildBannerSliderHTML(banners){
  const link = (u)=> /^(#|mailto:|tel:|https?:\/\/)/i.test(u) ? u : 'https://'+u;
  const slide = (b)=>{
    const l = b.buttonLink ? link(b.buttonLink) : '';
    const ext = l && !l.startsWith('#');
    return `<div class="img-slider-slide banner-slide"><img src="${b.imageUrl}" alt="${escapeHtml(b.title||'')}">
      <div class="banner-overlay"><div class="banner-content">
        ${b.title ? `<h2>${escapeHtml(b.title)}</h2>` : ''}
        ${b.subtitle ? `<p>${escapeHtml(b.subtitle)}</p>` : ''}
        ${b.buttonText && l ? `<a class="btn btn-primary" href="${escapeHtml(l)}" ${ext?'target="_blank" rel="noopener"':''}>${escapeHtml(b.buttonText)}</a>` : ''}
      </div></div></div>`;
  };
  return `<div class="img-slider banner-slider" style="--slider-h:clamp(240px,42vw,470px);">
    <div class="img-slider-track">${banners.map(slide).join('')}</div>
    ${banners.length>1 ? `<button type="button" class="img-slider-nav prev" data-slide-dir="-1" aria-label="Previous"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m15 18-6-6 6-6"/></svg></button>
    <button type="button" class="img-slider-nav next" data-slide-dir="1" aria-label="Next"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 18 6-6-6-6"/></svg></button>
    <div class="img-slider-dots">${banners.map((_,i)=>`<button type="button" class="img-slider-dot${i===0?' active':''}" data-slide-go="${i}" aria-label="Slide ${i+1}"></button>`).join('')}</div>` : ''}
  </div>`;
}

const DEFAULT_SETTINGS = {
  siteName:'The Mr JB World',
  contactEmail:'mrjbsa.official@outlook.com',
  youtubeUrl:'https://www.youtube.com/@themrjbworld',
  currency:'PKR'
};

function seedIfEmpty(){
  if(!localStorage.getItem(DB.PROJECTS)) localStorage.setItem(DB.PROJECTS, JSON.stringify([]));
  if(!localStorage.getItem(DB.CATEGORIES)) localStorage.setItem(DB.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
  if(!localStorage.getItem(DB.LIVE_SITES)) localStorage.setItem(DB.LIVE_SITES, JSON.stringify([]));
  if(!localStorage.getItem(DB.SETTINGS)) localStorage.setItem(DB.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  else {
    const s = JSON.parse(localStorage.getItem(DB.SETTINGS));
    let changed=false;
    Object.keys(DEFAULT_SETTINGS).forEach(k=>{ if(s[k]===undefined){ s[k]=DEFAULT_SETTINGS[k]; changed=true; } });
    if(changed) localStorage.setItem(DB.SETTINGS, JSON.stringify(s));
  }
}
seedIfEmpty();


/* =========================================================================
   2. DATA STORE
========================================================================= */
const DataStore = {
  getProjects(){ return JSON.parse(localStorage.getItem(DB.PROJECTS)||'[]'); },
  getProjectBySlug(slug){ return this.getProjects().find(p=>p.slug===slug)||null; },
  getProjectById(id){ return this.getProjects().find(p=>p.id===id)||null; },
  incrementDownload(id){ const all=this.getProjects(); const p=all.find(x=>x.id===id); if(p){ p.downloadCount=(p.downloadCount||0)+1; localStorage.setItem(DB.PROJECTS, JSON.stringify(all)); } },
  getCategories(){ return JSON.parse(localStorage.getItem(DB.CATEGORIES)||'[]'); },
  getSettings(){ return JSON.parse(localStorage.getItem(DB.SETTINGS)||'{}'); },
  getBanners(){ return JSON.parse(localStorage.getItem(DB.BANNERS)||'[]'); },
  getLiveSites(){ return JSON.parse(localStorage.getItem(DB.LIVE_SITES)||'[]'); }
};


/* =========================================================================
   2b. CLOUD SYNC — Google Drive as the shared database
   Every visitor's browser PULLS the shared JSON file (public, read-only,
   via CLOUD_API_KEY — no login needed).
========================================================================= */
const CloudSync = {
  getFileId(){ return CLOUD_DB_FILE_ID || ''; },

  async pull(){
    const fileId = this.getFileId();
    if(!fileId || !CLOUD_API_KEY) return false;
    try{
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${CLOUD_API_KEY}`, { cache:'no-store' });
      if(!res.ok) return false;
      const data = await res.json();
      if(Array.isArray(data.projects)) localStorage.setItem(DB.PROJECTS, JSON.stringify(data.projects));
      if(Array.isArray(data.categories) && data.categories.length) localStorage.setItem(DB.CATEGORIES, JSON.stringify(data.categories));
      if(Array.isArray(data.liveSites)) localStorage.setItem(DB.LIVE_SITES, JSON.stringify(data.liveSites));
      if(Array.isArray(data.banners)) localStorage.setItem(DB.BANNERS, JSON.stringify(data.banners));
      return true;
    }catch(e){ console.warn('Cloud pull failed:', e); return false; }
  }
};


/* =========================================================================
   5. UTILITIES
========================================================================= */
function qs(s,ctx){ return (ctx||document).querySelector(s); }
function qsa(s,ctx){ return Array.from((ctx||document).querySelectorAll(s)); }
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* Lightweight, safe markdown → clean HTML for project/live-site descriptions.
   Input is escaped first, so this only ever turns plain # / ** / - markers
   into real headings, bold text and lists — nothing else can slip through. */
function mdLite(raw){
  if(!raw) return '';
  const lines = escapeHtml(raw).replace(/\r\n/g,'\n').split('\n');
  let html = '', inList = false;
  const closeList = ()=>{ if(inList){ html += '</ul>'; inList = false; } };
  const inline = (t)=> t.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<em>$1</em>');
  lines.forEach(line=>{
    const t = line.trim();
    if(!t){ closeList(); return; }
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if(h){ closeList(); const lvl = h[1].length+2; html += `<h${lvl}>${inline(h[2])}</h${lvl}>`; return; }
    const li = t.match(/^[-*•]\s+(.*)$/);
    if(li){ if(!inList){ html += '<ul>'; inList = true; } html += `<li>${inline(li[1])}</li>`; return; }
    closeList();
    html += `<p>${inline(t)}</p>`;
  });
  closeList();
  return html;
}
function slugify(s){ return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function uid(){ return 'p_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function formatPrice(n){ return '₨' + Number(n||0).toLocaleString('en-PK'); }
function formatDate(d){ const date=new Date(d); if(isNaN(date)) return d; return date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }
function refreshIcons(){ if(window.lucide) lucide.createIcons(); }
function toast(msg, type){
  const el = document.createElement('div');
  el.className = 'toast '+(type||'info');
  const iconMap = { success:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>', error:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>', info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>' };
  el.innerHTML = (iconMap[type]||iconMap.info) + '<span>'+escapeHtml(msg)+'</span>';
  qs('#toast-stack').appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .3s'; el.style.opacity='0'; setTimeout(()=>el.remove(), 300); }, 3400);
}
function confirmDialog(message, onConfirm, confirmLabel){
  const root = qs('#modal-root');
  root.innerHTML = `<div class="modal-overlay"><div class="modal-box"><h3>Please confirm</h3><p>${escapeHtml(message)}</p>
    <div class="modal-actions"><button class="btn btn-secondary" id="modal-cancel">Cancel</button><button class="btn btn-danger" id="modal-confirm">${escapeHtml(confirmLabel||'Confirm')}</button></div></div></div>`;
  qs('#modal-cancel').onclick = ()=> root.innerHTML='';
  qs('#modal-confirm').onclick = ()=>{ root.innerHTML=''; onConfirm(); };
}
function mailtoLink(project){
  const settings = DataStore.getSettings();
  const subject = encodeURIComponent('Purchase request: '+project.name);
  const body = encodeURIComponent(`Hi,\n\nI'd like to purchase "${project.name}" (${formatPrice(project.price)}).\n\nPlease send me the payment details.\n\nThanks!`);
  return `mailto:${settings.contactEmail}?subject=${subject}&body=${body}`;
}


/* =========================================================================
   6. THEME
========================================================================= */
function applyTheme(t){ document.documentElement.setAttribute('data-theme', t); localStorage.setItem(DB.THEME, t);
  qs('#theme-icon').innerHTML = t==='dark' ? '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>' : '<circle cx="12" cy="12" r="5"/>';
}
applyTheme(localStorage.getItem(DB.THEME) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light'));
qs('#theme-toggle').onclick = ()=> applyTheme(document.documentElement.getAttribute('data-theme')==='dark' ? 'light':'dark');

/* Mobile menu */
function openMobileMenu(){ qs('#mobile-menu').setAttribute('aria-hidden','false'); qs('#hamburger-btn').setAttribute('aria-expanded','true'); }
function closeMobileMenu(){ qs('#mobile-menu').setAttribute('aria-hidden','true'); qs('#hamburger-btn').setAttribute('aria-expanded','false'); }
qs('#hamburger-btn').onclick = openMobileMenu;
qsa('[data-close-menu]').forEach(el=> el.addEventListener('click', closeMobileMenu));

/* Search */
function wireSearch(input){ input.addEventListener('keydown', e=>{ if(e.key==='Enter' && input.value.trim()){ location.hash = '#/projects?q='+encodeURIComponent(input.value.trim()); closeMobileMenu(); } }); }
wireSearch(qs('#header-search-input')); wireSearch(qs('#mobile-search-input'));



/* Branding + contact links applied everywhere */
function applyBrandingLinks(){
  const s = DataStore.getSettings();
  document.title = document.title; // no-op, per-page titles set in router
  ['header-youtube-link','footer-youtube-link'].forEach(id=>{ const el=qs('#'+id); if(el) el.href = s.youtubeUrl; });
  const footerMail = qs('#footer-mail-link'); if(footerMail) footerMail.href = 'mailto:'+s.contactEmail;
  const footerEmailText = qs('#footer-email-text'); if(footerEmailText) footerEmailText.innerHTML = `<a href="mailto:${escapeHtml(s.contactEmail)}">${escapeHtml(s.contactEmail)}</a>`;
  const contactEmailLink = qs('#contact-email-link'); if(contactEmailLink){ contactEmailLink.href='mailto:'+s.contactEmail; contactEmailLink.textContent = s.contactEmail; }
  const contactYoutubeLink = qs('#contact-youtube-link'); if(contactYoutubeLink) contactYoutubeLink.href = s.youtubeUrl;
}


/* =========================================================================
   7. PROJECT CARD RENDERING (with Download / Contact / Install logic)
========================================================================= */
function projectCardHtml(p){
  const grad = categoryGradient(p.category);
  const cover = p.coverImage || (p.screenshots && p.screenshots[0]) || null;

  if(p.type==='app'){
    // Play Store style: square app icon + name/category beside it, rating-style meta row below.
    return `<div class="project-card app-card">
      <a href="#/project/${p.slug}" class="app-card-head">
        <div class="app-icon" style="background:${grad};">${cover ? `<img src="${cover.url}" alt="${escapeHtml(p.name)}" loading="lazy">` : `<svg data-lucide="smartphone"></svg>`}</div>
        <div class="app-card-titles">
          <h3>${escapeHtml(p.name)}</h3>
          <span class="app-card-cat">${escapeHtml(p.category)}</span>
        </div>
        <span class="badge-price ${p.isFree?'badge-free':'badge-paid'}">${p.isFree?'Free':formatPrice(p.price)}</span>
      </a>
      <div class="project-body">
        <p style="font-size:.83rem;color:var(--text-muted);line-height:1.5;">${escapeHtml(p.shortDesc||'')}</p>
        <div class="project-meta-row"><svg data-lucide="download"></svg> ${(p.downloadCount||0).toLocaleString()} downloads <svg data-lucide="hard-drive" style="margin-left:6px;"></svg> ${escapeHtml(p.fileSize||'—')}</div>
        <div class="project-card-footer">
          <a href="#/project/${p.slug}" class="btn btn-secondary btn-sm">Details</a>
          ${actionButtonHtml(p, 'sm')}
        </div>
      </div>
    </div>`;
  }

  // Websites / other types: movie-poster style — cover image with name+blurb overlaid.
  return `<div class="project-card">
    <a href="#/project/${p.slug}" class="project-thumb" style="background:${grad};">
      <span class="badge">${escapeHtml(p.category)}</span>
      <span class="badge-price ${p.isFree?'badge-free':'badge-paid'}">${p.isFree?'Free':formatPrice(p.price)}</span>
      ${cover ? `<img src="${cover.url}" alt="${escapeHtml(p.name)}" loading="lazy" class="project-thumb-img">` : `<svg data-lucide="${categoryIcon(p.category)}"></svg>`}
      <div class="project-thumb-caption">
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.shortDesc||'')}</p>
      </div>
    </a>
    <div class="project-body">
      <div class="project-meta-row"><svg data-lucide="download"></svg> ${(p.downloadCount||0).toLocaleString()} downloads <svg data-lucide="hard-drive" style="margin-left:6px;"></svg> ${escapeHtml(p.fileSize||'—')}</div>
      <div class="project-card-footer">
        <a href="#/project/${p.slug}" class="btn btn-secondary btn-sm">Details</a>
        ${actionButtonHtml(p, 'sm')}
      </div>
    </div>
  </div>`;
}

function actionButtonHtml(p, size){
  const sizeClass = size==='sm' ? 'btn-sm' : '';
  if(!p.isFree){
    return `<a href="${mailtoLink(p)}" class="btn btn-amber ${sizeClass}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="m4 4 8 8 8-8"/></svg> Contact to buy</a>`;
  }
  if(p.type==='app'){
    return `<button class="btn btn-primary install-btn ${sizeClass}" data-install="${p.id}"><span class="btn-bar" style="width:0%"></span><span class="install-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v13m0 0 4-4m-4 4-4-4M4 20h16"/></svg> Install</span></button>`;
  }
  return `<button class="btn btn-success ${sizeClass}" data-download="${p.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v13m0 0 4-4m-4 4-4-4M4 20h16"/></svg> Download</button>`;
}

function wireActionButtons(root){
  qsa('[data-download]', root).forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const p = DataStore.getProjectById(btn.dataset.download);
      if(!p || !p.downloadUrl){ toast('This project has no file attached yet.', 'error'); return; }
      DataStore.incrementDownload(p.id);
      const a = document.createElement('a'); a.href = p.downloadUrl; a.rel='noopener'; a.target='_blank'; document.body.appendChild(a); a.click(); a.remove();
      toast('Download started.', 'success');
    });
  });
  qsa('[data-install]', root).forEach(btn=>{
    btn.addEventListener('click', ()=> runInstallAnimation(btn));
  });
}

function runInstallAnimation(btn){
  if(btn.dataset.busy) return;
  btn.dataset.busy='1';
  const id = btn.dataset.install;
  const p = DataStore.getProjectById(id);
  if(!p || !p.downloadUrl){ toast('This app has no file attached yet.', 'error'); btn.dataset.busy=''; return; }
  const bar = qs('.btn-bar', btn); const label = qs('.install-label', btn);
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span> Preparing…';
  let pct = 0;
  const timer = setInterval(()=>{
    pct = Math.min(pct + (6+Math.random()*10), 96);
    bar.style.width = pct+'%';
    label.innerHTML = '<span class="install-progress-label">Downloading '+Math.round(pct)+'%</span>';
  }, 140);
  setTimeout(()=>{
    clearInterval(timer);
    bar.style.width='100%';
    label.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg> Installed';
    DataStore.incrementDownload(p.id);
    const a = document.createElement('a'); a.href = p.downloadUrl; a.rel='noopener'; a.target='_blank'; document.body.appendChild(a); a.click(); a.remove();
    toast('Downloaded — open the file on your device to finish installing.', 'success');
    setTimeout(()=>{ btn.disabled=false; btn.dataset.busy=''; bar.style.width='0%'; label.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v13m0 0 4-4m-4 4-4-4M4 20h16"/></svg> Install'; }, 2600);
  }, 1500);
}


/* =========================================================================
   8. PUBLIC PAGE RENDERERS
========================================================================= */
function faviconUrl(url){
  try{ const u = new URL(url); return `https://www.google.com/s2/favicons?sz=64&domain=${u.hostname}`; }catch(e){ return ''; }
}
const LIVESITE_PALETTE = [ ['#FF5C7A','#FF9A76'], ['#6C5CE7','#A78BFA'], ['#00B4D8','#48CAE4'], ['#00C875','#5EEAD4'], ['#FFB020','#FFD166'], ['#FF6FB5','#FF9ECF'] ];
function livesiteImages(s){
  const list = [];
  if(s.coverImage && s.coverImage.url) list.push(s.coverImage);
  (s.screenshots||[]).forEach(x=>{ if(x && x.url && !list.some(y=>y.id===x.id)) list.push(x); });
  return list;
}
function injectLiveShowcaseStyles(){
  if(document.getElementById('ls-showcase-css')) return;
  const st = document.createElement('style'); st.id = 'ls-showcase-css';
  st.textContent = `
  .livesite-card-img{overflow:hidden;--box:230px;}
  .ls-bar{display:flex;align-items:center;gap:6px;padding:8px 12px;font-size:11.5px;color:var(--text-muted,#667085);border:1px solid var(--border,#e4e7ef);border-bottom:0;border-radius:12px 12px 0 0;background:var(--bg-soft,rgba(127,127,127,.06));}
  .ls-bar i{width:8px;height:8px;border-radius:50%;background:#ff5f57;flex:none}
  .ls-bar i:nth-child(2){background:#febc2e}.ls-bar i:nth-child(3){background:#28c840}
  .ls-bar span{margin-left:6px;flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;background:rgba(127,127,127,.12);border-radius:6px;padding:2px 8px}
  .ls-shot{position:relative;height:var(--box);overflow:hidden;border:1px solid var(--border,#e4e7ef);border-radius:0 0 12px 12px;margin-bottom:14px;background:rgba(127,127,127,.08)}
  /* tall full-page screenshot(s) stacked in one strip; the strip scrolls inside the box */
  .ls-strip{transform:translateY(0);transition:transform calc(var(--dur,6s) * .6) ease-in-out;will-change:transform}
  .ls-strip img{display:block;width:100%;height:auto}
  @media (hover:hover){
    .livesite-card-img:hover .ls-strip{transform:translateY(calc(-100% + var(--box)));transition-duration:var(--dur,6s)}
    .livesite-card-img:hover .ls-badge{opacity:0}
  }
  .livesite-card-img:focus-visible .ls-strip,.livesite-card-img.is-playing .ls-strip{transform:translateY(calc(-100% + var(--box)));transition-duration:var(--dur,6s)}
  .livesite-card-img.is-playing .ls-badge{opacity:0}
  .livesite-card-img.no-scroll .ls-strip{transform:none !important}
  .ls-badge{position:absolute;left:10px;bottom:10px;z-index:2;pointer-events:none;font-size:11px;font-weight:600;padding:5px 10px;border-radius:99px;color:#fff;background:rgba(11,14,20,.72);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.14);transition:opacity .3s ease}
  @media (prefers-reduced-motion:reduce){.ls-shot{overflow-y:auto}.ls-strip{transition:none !important;transform:none !important}.ls-badge{display:none}}`;
  document.head.appendChild(st);
}
function livesiteCardHtml(s, i){
  const fav = faviconUrl(s.url);
  const [c1,c2] = LIVESITE_PALETTE[i % LIVESITE_PALETTE.length];
  const imgs = livesiteImages(s);
  if(imgs.length){
    const host = escapeHtml(s.url.replace(/^https?:\/\//,'').replace(/\/$/,''));
    const touch = window.matchMedia && matchMedia('(hover: none)').matches;
    return `<a class="livesite-card livesite-card-img" href="#/live/${s.id}">
      <div class="ls-bar"><i></i><i></i><i></i><span>${host}</span></div>
      <div class="ls-shot"><div class="ls-strip">${imgs.map(im=>`<img src="${im.url}" alt="${escapeHtml(s.name)} preview" loading="lazy">`).join('')}</div>
        <span class="ls-badge">${touch ? 'Tap to preview' : 'Hover to preview'}</span></div>
      <h3>${escapeHtml(s.name)}</h3>
      <p>${escapeHtml((s.description||'').split('\n')[0])}</p>
      <span class="livesite-visit">View details <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17 17 7M7 7h10v10"/></svg></span>
    </a>`;
  }
  return `<a class="livesite-card" href="#/live/${s.id}">
    <div class="livesite-icon" style="background:linear-gradient(135deg,${c1},${c2});box-shadow:0 10px 22px -8px ${c1}99;">
      <span class="livesite-icon-inner">${fav ? `<img src="${fav}" alt="" style="width:26px;height:26px;border-radius:7px;" onerror="this.remove()">` : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z"/></svg>'}</span>
    </div>
    <h3>${escapeHtml(s.name)}</h3>
    <p>${escapeHtml(s.description||'')}</p>
    <div class="livesite-url"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg> ${escapeHtml(s.url.replace(/^https?:\/\//,''))}</div>
    <span class="livesite-visit">Visit website <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17 17 7M7 7h10v10"/></svg></span>
  </a>`;
}
/* Preview scroll speed: duration is calculated from the screenshot height, so tall and
   short pages scroll at a similar speed. Change these 3 numbers to tune it. */
const LS_PX_PER_SECOND = 150, LS_MIN_SECONDS = 3, LS_MAX_SECONDS = 20;
function attachLiveSlideshow(container){
  injectLiveShowcaseStyles();
  const touch = window.matchMedia && matchMedia('(hover: none)').matches;
  qsa('.livesite-card-img', container).forEach(card=>{
    const strip = qs('.ls-strip', card), box = qs('.ls-shot', card);
    if(!strip || !box) return;
    const update = ()=>{
      if(!strip.offsetHeight) return;
      const distance = strip.offsetHeight - box.clientHeight;
      if(distance <= 0){ card.classList.add('no-scroll'); return; }
      card.classList.remove('no-scroll');
      const sec = Math.min(LS_MAX_SECONDS, Math.max(LS_MIN_SECONDS, distance / LS_PX_PER_SECOND));
      card.style.setProperty('--dur', sec.toFixed(2)+'s');
    };
    qsa('img', strip).forEach(im=>{ im.addEventListener('load', update); });
    update();
    if('ResizeObserver' in window){ const ro = new ResizeObserver(update); ro.observe(strip); ro.observe(box); }
    if(touch && 'IntersectionObserver' in window){
      new IntersectionObserver(es=> es.forEach(e=> card.classList.toggle('is-playing', e.isIntersecting)), {threshold:.65}).observe(card);
    }
  });
}
function attachTiltEffect(container){
  qsa('.livesite-card', container).forEach(card=>{
    card.addEventListener('mousemove', e=>{
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left)/r.width - 0.5;
      const py = (e.clientY - r.top)/r.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${px*14}deg) rotateX(${-py*14}deg) translateY(-6px) scale(1.015)`;
    });
    card.addEventListener('mouseleave', ()=>{ card.style.transform=''; });
  });
}
function renderLiveSitesSection(containerId, limit){
  const sites = DataStore.getLiveSites();
  const list = limit ? sites.slice(0, limit) : sites;
  const el = qs('#'+containerId);
  if(!el) return;
  const section = el.closest('#home-live-sites-section');
  if(section) section.classList.toggle('hidden', sites.length===0);
  el.innerHTML = list.length ? list.map((s,i)=>livesiteCardHtml(s,i)).join('') : emptyStateHtml('No live websites added yet', 'They will appear here soon.');
  refreshIcons();
  attachTiltEffect(el);
  attachLiveSlideshow(el);
}

function renderHome(){
  const settings = DataStore.getSettings();
  document.title = settings.siteName+' — Websites & Applications Marketplace';
  qs('#hero-lead').textContent = `${settings.siteName} is a growing library of complete websites and applications — free ones download instantly, premium ones are one email away.`;
  const projects = DataStore.getProjects();
  const cats = DataStore.getCategories();
  const freeCount = projects.filter(p=>p.isFree).length;
  qs('#hero-stats').innerHTML = `
    <div><b>${projects.length}</b><span>Projects listed</span></div>
    <div><b>${freeCount}</b><span>Free to download</span></div>
    <div><b>${cats.length}</b><span>Categories</span></div>`;

  qs('#home-categories').innerHTML = cats.slice(0,5).map(c=>{
    const count = projects.filter(p=>p.category===c).length;
    return `<a href="#/projects?category=${encodeURIComponent(c)}" class="folder-card">
      <div class="folder-icon" style="background:${categoryGradient(c)}"><svg data-lucide="${categoryIcon(c)}"></svg></div>
      <b>${escapeHtml(c)}</b><span>${count} project${count===1?'':'s'}</span></a>`;
  }).join('') || `<p style="color:var(--text-muted)">No categories yet.</p>`;

  const latest = [...projects].sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt)).slice(0,6);
  qs('#home-projects').innerHTML = latest.length ? latest.map(projectCardHtml).join('') : emptyStateHtml('No projects yet', 'New projects will appear here as soon as they are uploaded.');
  renderLiveSitesSection('home-live-sites', 3);

  const banners = DataStore.getBanners();
  const bannerSection = qs('#home-banner-section');
  if(bannerSection){
    bannerSection.classList.toggle('hidden', banners.length===0);
    if(banners.length){
      qs('#home-banner-slider').innerHTML = buildBannerSliderHTML(banners);
      wireSlider(qs('#home-banner-slider .img-slider'), 5500);
    }
  }

  const previewItems = [];
  [...projects].sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt)).forEach(p=>{
    (p.screenshots||[]).forEach(s=> previewItems.push({ url:s.url, alt:p.name, href:'#/project/'+p.slug, caption:p.name }));
  });
  const previewSection = qs('#home-preview-section');
  if(previewSection) previewSection.classList.toggle('hidden', previewItems.length===0);
  if(previewItems.length){
    qs('#home-preview-slider').innerHTML = buildSliderHTML(previewItems.slice(0,14), {height:'380px'});
    wireSlider(qs('#home-preview-slider .img-slider'), 4000);
  }

  refreshIcons();
  wireActionButtons(qs('#home-projects'));
  applyBrandingLinks();
}

function emptyStateHtml(title, sub){
  return `<div class="empty-state" style="grid-column:1/-1;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><h3>${escapeHtml(title)}</h3><p>${escapeHtml(sub)}</p></div>`;
}

function renderProjectsPage(params){
  document.title = 'All Projects — '+DataStore.getSettings().siteName;
  let projects = DataStore.getProjects();
  const cats = DataStore.getCategories();
  const activeCategory = params.get('category')||'';
  const q = (params.get('q')||'').toLowerCase();

  qs('#projects-filters').innerHTML = ['All',...cats].map(c=>{
    const val = c==='All' ? '' : c;
    const active = activeCategory===val;
    return `<button class="chip ${active?'active':''}" data-cat="${escapeHtml(val)}">${escapeHtml(c)}</button>`;
  }).join('');
  qsa('#projects-filters .chip').forEach(chip=>{
    chip.onclick = ()=>{ const c = chip.dataset.cat; location.hash = c ? '#/projects?category='+encodeURIComponent(c) : '#/projects'; };
  });

  if(activeCategory) projects = projects.filter(p=>p.category===activeCategory);
  if(q) projects = projects.filter(p=> (p.name+' '+p.shortDesc+' '+p.category).toLowerCase().includes(q));

  qs('#projects-title').textContent = activeCategory ? activeCategory : (q ? `Results for "${q}"` : 'All projects');
  qs('#projects-count').textContent = projects.length+' project'+(projects.length===1?'':'s');
  qs('#projects-grid').innerHTML = projects.length ? projects.map(projectCardHtml).join('') : emptyStateHtml('Nothing here yet', 'Try a different category or check back soon.');
  refreshIcons();
  wireActionButtons(qs('#projects-grid'));
}

function renderLiveSitesPage(){
  document.title = 'Live Websites — '+DataStore.getSettings().siteName;
  renderLiveSitesSection('live-sites-grid', 0);
}

function renderLiveSiteDetail(id){
  const s = DataStore.getLiveSites().find(x=>x.id===id);
  const content = qs('#live-detail-content');
  if(!s){ content.innerHTML = emptyStateHtml('Website not found', 'It may have been removed.'); return; }
  document.title = s.name+' — '+DataStore.getSettings().siteName;
  const lsImgs = livesiteImages(s);
  const heroHtml = lsImgs.length
    ? buildSliderHTML(lsImgs.map(x=>({ url:x.url, alt:s.name })), { height:'340px' })
    : `<div class="detail-hero" style="background:linear-gradient(135deg,#3654FF,#5B82FF)"><svg data-lucide="globe"></svg></div>`;
  content.innerHTML = `
    <a href="#/live-sites" class="btn btn-ghost btn-sm" style="margin-bottom:20px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5m7-7-7 7 7 7"/></svg> Back to live websites</a>
    <div class="detail-grid">
      <div>
        ${heroHtml}
        <div class="eyebrow-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg> Live website</div>
        <h1 style="font-size:1.9rem;">${escapeHtml(s.name)}</h1>
        <div class="rich-text" style="margin-top:12px;max-width:65ch;">${mdLite(s.description||'')}</div>
      </div>
      <div class="sidebar-card">
        <div style="margin-bottom:14px;word-break:break-all;color:var(--text-muted);font-size:.85rem;">${escapeHtml(s.url.replace(/^https?:\/\//,''))}</div>
        <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener" class="btn btn-primary" style="width:100%;">Visit website <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" style="width:16px;height:16px;margin-left:4px;"><path d="M7 17 17 7M7 7h10v10"/></svg></a>
      </div>
    </div>`;
  refreshIcons();
  wireSlider(qs('#live-detail-content .img-slider'), 4000);
}

function renderCategoriesPage(){
  document.title = 'Categories — '+DataStore.getSettings().siteName;
  const projects = DataStore.getProjects(); const cats = DataStore.getCategories();
  qs('#categories-grid').innerHTML = cats.length ? cats.map(c=>{
    const count = projects.filter(p=>p.category===c).length;
    return `<a href="#/projects?category=${encodeURIComponent(c)}" class="folder-card">
      <div class="folder-icon" style="background:${categoryGradient(c)}"><svg data-lucide="${categoryIcon(c)}"></svg></div>
      <b>${escapeHtml(c)}</b><span>${count} project${count===1?'':'s'}</span></a>`;
  }).join('') : emptyStateHtml('No categories yet','Categories will appear here soon.');
  refreshIcons();
}

function renderProjectDetail(slug){
  const p = DataStore.getProjectBySlug(slug);
  const content = qs('#project-detail-content');
  if(!p){ content.innerHTML = emptyStateHtml('Project not found', 'It may have been removed.'); document.title='Not found'; return; }
  document.title = p.name+' — '+DataStore.getSettings().siteName;
  const galleryImages = [...(p.coverImage ? [p.coverImage] : []), ...(p.screenshots||[]).filter(s=> !p.coverImage || s.id!==p.coverImage.id)];
  const hasShots = galleryImages.length>0;
  const heroHtml = hasShots
    ? buildSliderHTML(galleryImages.map(s=>({ url:s.url, alt:p.name })), { height:'340px' })
    : `<div class="detail-hero" style="background:${categoryGradient(p.category)}"><svg data-lucide="${p.type==='app'?'smartphone':categoryIcon(p.category)}"></svg></div>`;
  content.innerHTML = `
    <a href="#/projects" class="btn btn-ghost btn-sm" style="margin-bottom:20px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5m7-7-7 7 7 7"/></svg> Back to projects</a>
    <div class="detail-grid">
      <div>
        ${heroHtml}
        <div class="eyebrow-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> ${escapeHtml(p.category)}</div>
        ${p.type==='app' ? `<div style="display:flex;align-items:center;gap:14px;">
          <div class="app-icon" style="width:56px;height:56px;border-radius:14px;background:${categoryGradient(p.category)};flex-shrink:0;">${p.coverImage ? `<img src="${p.coverImage.url}" alt="">` : `<svg data-lucide="smartphone"></svg>`}</div>
          <h1 style="font-size:1.7rem;">${escapeHtml(p.name)}</h1>
        </div>` : `<h1 style="font-size:1.9rem;">${escapeHtml(p.name)}</h1>`}
        <div class="rich-text" style="margin-top:12px;max-width:65ch;">${mdLite(p.fullDesc||p.shortDesc||'')}</div>
        ${p.features && p.features.length ? `<h3 style="margin-top:28px;margin-bottom:6px;font-size:1.05rem;">What's included</h3><ul class="feature-list">${p.features.map(f=>`<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg> ${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
      </div>
      <div class="sidebar-card">
        ${p.isFree ? `<div class="badge-price badge-free" style="position:static;display:inline-block;margin-bottom:10px;">Free</div>` : `<div class="price-tag">${formatPrice(p.price)}</div>`}
        <div style="margin:14px 0;">${actionButtonHtml(p)}</div>
        <div class="spec-row"><span>Technology</span><b>${escapeHtml(p.technology||'—')}</b></div>
        <div class="spec-row"><span>Version</span><b>${escapeHtml(p.version||'1.0.0')}</b></div>
        <div class="spec-row"><span>File size</span><b>${escapeHtml(p.fileSize||'—')}</b></div>
        <div class="spec-row"><span>Requirements</span><b>${escapeHtml(p.requirements||'—')}</b></div>
        <div class="spec-row"><span>Downloads</span><b>${(p.downloadCount||0).toLocaleString()}</b></div>
        <div class="spec-row"><span>Updated</span><b>${formatDate(p.updatedAt||p.createdAt)}</b></div>
      </div>
    </div>`;
  refreshIcons();
  wireActionButtons(content);
  if(hasShots) wireSlider(qs('.img-slider', content), 4500);
}

function renderAboutStats(){
  const projects = DataStore.getProjects();
  const totalDownloads = projects.reduce((s,p)=>s+(p.downloadCount||0),0);
  qs('#about-stats').innerHTML = `
    <div class="kpi-card"><svg data-lucide="folder"></svg><b>${projects.length}</b><span>Projects listed</span></div>
    <div class="kpi-card"><svg data-lucide="download"></svg><b>${totalDownloads.toLocaleString()}</b><span>Total downloads</span></div>
    <div class="kpi-card"><svg data-lucide="grid"></svg><b>${DataStore.getCategories().length}</b><span>Categories</span></div>
    <div class="kpi-card"><svg data-lucide="gift"></svg><b>${projects.filter(p=>p.isFree).length}</b><span>Free projects</span></div>`;
  refreshIcons();
}

function initContactPage(){ applyBrandingLinks(); }

const LEGAL_PAGES = {
  privacy: { title:'Privacy Policy', body:`
    <h2>What we store</h2><p>The Mr JB World stores project listings and your download counts locally in your browser. No customer account or personal profile is created for browsing or downloading free projects.</p>
    <h2>Premium projects</h2><p>Buying a premium project happens by email. Any information you share (name, contact details, payment proof) is used only to process that purchase and is not sold or shared with third parties.</p>
    <h2>Downloads</h2><p>Free projects can be downloaded immediately with no account or payment. Files are hosted on Google Drive; downloading a file is subject to Google's own terms of service.</p>` },
  terms: { title:'Terms of Use', body:`
    <h2>Using the projects</h2><p>Projects downloaded from The Mr JB World are provided as-is. You're responsible for testing and adapting any project before using it in production.</p>
    <h2>Premium purchases</h2><p>Premium projects are sold directly by Mr JB over email. Payment methods and confirmation are arranged individually with the buyer.</p>
    <h2>Fair use</h2><p>Please don't redistribute or resell downloaded projects without permission.</p>` }
};
function renderLegalPage(slug){
  const page = LEGAL_PAGES[slug] || LEGAL_PAGES.privacy;
  document.title = page.title+' — '+DataStore.getSettings().siteName;
  qs('#legal-content').innerHTML = `<h1 style="margin-bottom:20px;">${page.title}</h1><div style="color:var(--text-muted);line-height:1.7;display:flex;flex-direction:column;gap:14px;">${page.body}</div>`;
}


/* =========================================================================
   11. ROUTER
========================================================================= */
const PAGE_IDS = ['home','projects','categories','live-sites','project-detail','live-detail','about','contact','legal'];
function showPage(id){
  PAGE_IDS.forEach(p=>{ const node = qs('#page-'+p); if(!node) return; node.classList.toggle('hidden', p!==id); });
  const active = qs('#page-'+id);
  if(active){ active.classList.remove('fade-page'); void active.offsetWidth; active.classList.add('fade-page'); }
  window.scrollTo({ top:0, behavior:'auto' });
  qsa('.main-nav a').forEach(a=> a.classList.toggle('active', a.dataset.route===id));
}
function router(){
  closeMobileMenu();
  const hash = location.hash || '#/home';
  const [pathPart, queryPart] = hash.replace('#/','').split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const params = new URLSearchParams(queryPart||'');

  if(parts[0]==='' || parts[0]===undefined || parts[0]==='home'){ showPage('home'); renderHome(); }
  else if(parts[0]==='projects'){ showPage('projects'); renderProjectsPage(params); }
  else if(parts[0]==='categories'){ showPage('categories'); renderCategoriesPage(); }
  else if(parts[0]==='live-sites'){ showPage('live-sites'); renderLiveSitesPage(); }
  else if(parts[0]==='project' && parts[1]){ showPage('project-detail'); renderProjectDetail(parts[1]); }
  else if(parts[0]==='live' && parts[1]){ showPage('live-detail'); renderLiveSiteDetail(parts[1]); }
  else if(parts[0]==='about'){ showPage('about'); document.title='About — '+DataStore.getSettings().siteName; renderAboutStats(); }
  else if(parts[0]==='contact'){ showPage('contact'); document.title='Contact — '+DataStore.getSettings().siteName; initContactPage(); }
  else if(parts[0]==='legal'){ showPage('legal'); renderLegalPage(parts[1]||'privacy'); }
  else { showPage('home'); renderHome(); }
  applyBrandingLinks();
}
window.addEventListener('hashchange', router);
let booted = false;
async function boot(){
  if(booted) return; booted = true;
  const y = qs('#footer-year'); if(y) y.textContent = new Date().getFullYear();
  refreshIcons();
  await CloudSync.pull(); // fetch the shared Drive database before first render
  router();
}
window.addEventListener('DOMContentLoaded', boot);
if(document.readyState !== 'loading'){ boot(); }

})();
