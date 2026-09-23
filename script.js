(function(){
'use strict';

/* =========================================================================
   1. STORAGE KEYS & DEFAULTS
========================================================================= */
const DB = { PROJECTS:'mjbw_projects', CATEGORIES:'mjbw_categories', SETTINGS:'mjbw_settings', ADMIN:'mjbw_admin_session', ADMIN_CREDS:'mjbw_admin_creds', DRIVE_FOLDERS:'mjbw_drive_folders', THEME:'mjbw_theme', LIVE_SITES:'mjbw_live_sites' };

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

const DEFAULT_SETTINGS = {
  siteName:'Mr JB World',
  contactEmail:'mrjbsa.official@outlook.com',
  youtubeUrl:'https://www.youtube.com/@themrjbworld',
  currency:'PKR',
  driveClientId:'669688636685-lm6fntdu1cm5h1r0adat5acfes2sm0gr.apps.googleusercontent.com',
  driveRootFolderId:''
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
  // Single fixed admin identity — seeded once, no public "create account" form ever exists.
  // Default login: username "mrjb", password "ChangeMe#2026" — change it from
  // Admin → Settings → Change Password the first time you sign in.
  if(!localStorage.getItem(DB.ADMIN_CREDS)){
    localStorage.setItem(DB.ADMIN_CREDS, JSON.stringify({ username:'mrjb', hash:'2e91ff8277625ff6780200952ef5609536d38e53a7016641958ac9873417fd83' }));
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
  saveProject(project){ const all=this.getProjects(); const idx=all.findIndex(p=>p.id===project.id); if(idx>-1) all[idx]=project; else all.unshift(project); localStorage.setItem(DB.PROJECTS, JSON.stringify(all)); return project; },
  deleteProject(id){ localStorage.setItem(DB.PROJECTS, JSON.stringify(this.getProjects().filter(p=>p.id!==id))); },
  incrementDownload(id){ const all=this.getProjects(); const p=all.find(x=>x.id===id); if(p){ p.downloadCount=(p.downloadCount||0)+1; localStorage.setItem(DB.PROJECTS, JSON.stringify(all)); } },
  getCategories(){ return JSON.parse(localStorage.getItem(DB.CATEGORIES)||'[]'); },
  saveCategories(cats){ localStorage.setItem(DB.CATEGORIES, JSON.stringify(cats)); },
  getSettings(){ return JSON.parse(localStorage.getItem(DB.SETTINGS)||'{}'); },
  saveSettings(s){ localStorage.setItem(DB.SETTINGS, JSON.stringify(s)); },
  getDriveFolders(){ return JSON.parse(localStorage.getItem(DB.DRIVE_FOLDERS)||'{}'); },
  saveDriveFolders(map){ localStorage.setItem(DB.DRIVE_FOLDERS, JSON.stringify(map)); },
  getLiveSites(){ return JSON.parse(localStorage.getItem(DB.LIVE_SITES)||'[]'); },
  saveLiveSite(site){ const all=this.getLiveSites(); const idx=all.findIndex(s=>s.id===site.id); if(idx>-1) all[idx]=site; else all.unshift(site); localStorage.setItem(DB.LIVE_SITES, JSON.stringify(all)); return site; },
  deleteLiveSite(id){ localStorage.setItem(DB.LIVE_SITES, JSON.stringify(this.getLiveSites().filter(s=>s.id!==id))); }
};

/* =========================================================================
   3. GOOGLE DRIVE INTEGRATION (admin-only)
   Uses Google Identity Services (token flow) + Drive v3 REST API directly
   from the browser. Scope is drive.file — the app can only see/manage
   files and folders that it itself creates, never the admin's whole Drive.
========================================================================= */
const DriveAPI = {
  tokenClient:null,
  accessToken:null,
  tokenExpiry:0,

  isReady(){ return typeof google !== 'undefined' && google.accounts && google.accounts.oauth2; },
  isConnected(){ return !!this.accessToken && Date.now() < this.tokenExpiry; },

  connect(){
    return new Promise((resolve, reject)=>{
      if(!this.isReady()){ reject(new Error('Google sign-in script has not loaded yet. Check your internet connection and try again.')); return; }
      const settings = DataStore.getSettings();
      if(!settings.driveClientId){ reject(new Error('No Google Drive Client ID is set in Settings yet.')); return; }
      try{
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: settings.driveClientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback:(resp)=>{
            if(resp && resp.access_token){
              this.accessToken = resp.access_token;
              this.tokenExpiry = Date.now() + ((resp.expires_in||3300)*1000);
              resolve(resp);
            } else { reject(new Error('Google did not return an access token.')); }
          },
          error_callback:(err)=>{ reject(new Error(err && err.message ? err.message : 'Google sign-in was cancelled or blocked.')); }
        });
        this.tokenClient.requestAccessToken({ prompt: this.accessToken ? '' : 'consent' });
      }catch(e){ reject(e); }
    });
  },

  async ensureToken(){
    if(this.isConnected()) return this.accessToken;
    await this.connect();
    return this.accessToken;
  },

  async apiFetch(url, options){
    const token = await this.ensureToken();
    const res = await fetch(url, Object.assign({}, options, { headers: Object.assign({ Authorization:'Bearer '+token }, (options&&options.headers)||{}) }));
    if(!res.ok){ const t = await res.text(); throw new Error('Google Drive error: '+res.status+' — '+t.slice(0,200)); }
    return res.status===204 ? null : res.json();
  },

  async findFolder(name, parentId){
    const q = encodeURIComponent(`name='${name.replace(/'/g,"\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false` + (parentId?` and '${parentId}' in parents`:''));
    const data = await this.apiFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
    return (data.files && data.files[0]) || null;
  },

  async createFolder(name, parentId){
    const metadata = { name, mimeType:'application/vnd.google-apps.folder' };
    if(parentId) metadata.parents = [parentId];
    return this.apiFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(metadata) });
  },

  async ensureRootFolder(){
    const settings = DataStore.getSettings();
    if(settings.driveRootFolderId){
      try{ await this.apiFetch(`https://www.googleapis.com/drive/v3/files/${settings.driveRootFolderId}?fields=id`); return settings.driveRootFolderId; }
      catch(e){ /* fall through and recreate */ }
    }
    let folder = await this.findFolder('Mr JB World Uploads', null);
    if(!folder) folder = await this.createFolder('Mr JB World Uploads', null);
    settings.driveRootFolderId = folder.id;
    DataStore.saveSettings(settings);
    return folder.id;
  },

  async ensureCategoryFolder(categoryName){
    const map = DataStore.getDriveFolders();
    if(map[categoryName]) return map[categoryName];
    const rootId = await this.ensureRootFolder();
    let folder = await this.findFolder(categoryName, rootId);
    if(!folder) folder = await this.createFolder(categoryName, rootId);
    map[categoryName] = folder.id;
    DataStore.saveDriveFolders(map);
    return folder.id;
  },

  async uploadFile(file, folderId, onProgress){
    const token = await this.ensureToken();
    const metadata = { name: file.name, parents:[folderId] };
    const boundary = 'mjbw-'+Math.random().toString(36).slice(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;
    const metaPart = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata);
    const fileHeader = delimiter + `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;

    const bodyBlob = new Blob([metaPart, fileHeader, file, closeDelim]);

    return new Promise((resolve, reject)=>{
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size');
      xhr.setRequestHeader('Authorization', 'Bearer '+token);
      xhr.setRequestHeader('Content-Type', 'multipart/related; boundary='+boundary);
      xhr.upload.onprogress = (e)=>{ if(e.lengthComputable && onProgress) onProgress(Math.round((e.loaded/e.total)*100)); };
      xhr.onload = ()=>{
        if(xhr.status>=200 && xhr.status<300){ resolve(JSON.parse(xhr.responseText)); }
        else reject(new Error('Upload failed ('+xhr.status+'): '+xhr.responseText.slice(0,200)));
      };
      xhr.onerror = ()=> reject(new Error('Network error during upload.'));
      xhr.send(bodyBlob);
    });
  },

  async makePublic(fileId){
    await this.apiFetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ role:'reader', type:'anyone' }) });
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  },

  async deleteFile(fileId){
    try{ await this.apiFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method:'DELETE' }); }catch(e){ /* ignore */ }
  }
};

/* =========================================================================
   4. ADMIN AUTH (local to this browser — see Settings for details)
========================================================================= */
async function sha256(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
const AuthService = {
  async changePassword(currentPassword, newUsername, newPassword){
    const creds = JSON.parse(localStorage.getItem(DB.ADMIN_CREDS)||'null');
    if(!creds) throw new Error('No admin account found.');
    const currentHash = await sha256(currentPassword+'::'+creds.username.toLowerCase());
    if(currentHash!==creds.hash) throw new Error('Current password is incorrect.');
    const username = (newUsername||creds.username).trim() || creds.username;
    const hash = await sha256(newPassword+'::'+username.toLowerCase());
    localStorage.setItem(DB.ADMIN_CREDS, JSON.stringify({ username, hash }));
  },
  async login(username, password){
    const creds = JSON.parse(localStorage.getItem(DB.ADMIN_CREDS)||'null');
    if(!creds) return false;
    const hash = await sha256(password+'::'+username.toLowerCase());
    if(creds.username.toLowerCase()===username.toLowerCase() && creds.hash===hash){ sessionStorage.setItem(DB.ADMIN,'1'); return true; }
    return false;
  },
  isLoggedIn(){ return sessionStorage.getItem(DB.ADMIN)==='1'; },
  logout(){ sessionStorage.removeItem(DB.ADMIN); }
};

/* =========================================================================
   5. UTILITIES
========================================================================= */
function qs(s,ctx){ return (ctx||document).querySelector(s); }
function qsa(s,ctx){ return Array.from((ctx||document).querySelectorAll(s)); }
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
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

/* Secret admin access: click the footer copyright text 5 times within 2.5s */
(function(){
  let clicks=0, timer=null;
  qs('#secret-trigger').addEventListener('click', ()=>{
    clicks++;
    clearTimeout(timer);
    timer = setTimeout(()=>{ clicks=0; }, 2500);
    if(clicks>=5){ clicks=0; location.hash = AuthService.isLoggedIn() ? '#/admin/overview' : '#/admin-login'; }
  });
})();

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
  const icon = p.type==='app' ? 'smartphone' : categoryIcon(p.category);
  return `<div class="project-card">
    <div class="project-thumb" style="background:${grad};">
      <span class="badge">${escapeHtml(p.category)}</span>
      <span class="badge-price ${p.isFree?'badge-free':'badge-paid'}">${p.isFree?'Free':formatPrice(p.price)}</span>
      <svg data-lucide="${icon}"></svg>
    </div>
    <div class="project-body">
      <h3><a href="#/project/${p.slug}">${escapeHtml(p.name)}</a></h3>
      <p>${escapeHtml(p.shortDesc||'')}</p>
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
function livesiteCardHtml(s){
  const fav = faviconUrl(s.url);
  return `<a class="livesite-card" href="${escapeHtml(s.url)}" target="_blank" rel="noopener">
    <div class="livesite-icon">${fav ? `<img src="${fav}" alt="" style="width:26px;height:26px;border-radius:6px;" onerror="this.remove()">` : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z"/></svg>'}</div>
    <h3>${escapeHtml(s.name)}</h3>
    <p>${escapeHtml(s.description||'')}</p>
    <div class="livesite-url"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg> ${escapeHtml(s.url.replace(/^https?:\/\//,''))}</div>
    <span class="livesite-visit">Visit website <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17 17 7M7 7h10v10"/></svg></span>
  </a>`;
}
function renderLiveSitesSection(containerId, limit){
  const sites = DataStore.getLiveSites();
  const list = limit ? sites.slice(0, limit) : sites;
  const el = qs('#'+containerId);
  if(!el) return;
  const section = el.closest('#home-live-sites-section');
  if(section) section.classList.toggle('hidden', sites.length===0);
  el.innerHTML = list.length ? list.map(livesiteCardHtml).join('') : emptyStateHtml('No live websites added yet', 'They will appear here as soon as they are added from the admin panel.');
  refreshIcons();
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

function renderCategoriesPage(){
  document.title = 'Categories — '+DataStore.getSettings().siteName;
  const projects = DataStore.getProjects(); const cats = DataStore.getCategories();
  qs('#categories-grid').innerHTML = cats.length ? cats.map(c=>{
    const count = projects.filter(p=>p.category===c).length;
    return `<a href="#/projects?category=${encodeURIComponent(c)}" class="folder-card">
      <div class="folder-icon" style="background:${categoryGradient(c)}"><svg data-lucide="${categoryIcon(c)}"></svg></div>
      <b>${escapeHtml(c)}</b><span>${count} project${count===1?'':'s'}</span></a>`;
  }).join('') : emptyStateHtml('No categories yet','Categories are created automatically when the admin uploads a project.');
  refreshIcons();
}

function renderProjectDetail(slug){
  const p = DataStore.getProjectBySlug(slug);
  const content = qs('#project-detail-content');
  if(!p){ content.innerHTML = emptyStateHtml('Project not found', 'It may have been removed.'); document.title='Not found'; return; }
  document.title = p.name+' — '+DataStore.getSettings().siteName;
  content.innerHTML = `
    <a href="#/projects" class="btn btn-ghost btn-sm" style="margin-bottom:20px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5m7-7-7 7 7 7"/></svg> Back to projects</a>
    <div class="detail-grid">
      <div>
        <div class="detail-hero" style="background:${categoryGradient(p.category)}"><svg data-lucide="${p.type==='app'?'smartphone':categoryIcon(p.category)}"></svg></div>
        <div class="eyebrow-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> ${escapeHtml(p.category)}</div>
        <h1 style="font-size:1.9rem;">${escapeHtml(p.name)}</h1>
        <p style="color:var(--text-muted);margin-top:12px;line-height:1.7;max-width:65ch;">${escapeHtml(p.fullDesc||p.shortDesc||'')}</p>
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
    <h2>What we store</h2><p>Mr JB World stores project listings and your download counts locally in your browser. No customer account or personal profile is created for browsing or downloading free projects.</p>
    <h2>Premium projects</h2><p>Buying a premium project happens by email. Any information you share (name, contact details, payment proof) is used only to process that purchase and is not sold or shared with third parties.</p>
    <h2>Downloads</h2><p>Free projects can be downloaded immediately with no account or payment. Files are hosted on Google Drive; downloading a file is subject to Google's own terms of service.</p>` },
  terms: { title:'Terms of Use', body:`
    <h2>Using the projects</h2><p>Projects downloaded from Mr JB World are provided as-is. You're responsible for testing and adapting any project before using it in production.</p>
    <h2>Premium purchases</h2><p>Premium projects are sold directly by Mr JB over email. Payment methods and confirmation are arranged individually with the buyer.</p>
    <h2>Fair use</h2><p>Please don't redistribute or resell downloaded projects without permission.</p>` }
};
function renderLegalPage(slug){
  const page = LEGAL_PAGES[slug] || LEGAL_PAGES.privacy;
  document.title = page.title+' — '+DataStore.getSettings().siteName;
  qs('#legal-content').innerHTML = `<h1 style="margin-bottom:20px;">${page.title}</h1><div style="color:var(--text-muted);line-height:1.7;display:flex;flex-direction:column;gap:14px;">${page.body}</div>`;
}

/* =========================================================================
   9. ADMIN LOGIN / SETUP
========================================================================= */
function renderAdminLoginPage(){
  qs('#admin-login-error').style.display='none';
  qs('#login-user').value=''; qs('#login-pass').value='';
}
qs('#admin-login-form').addEventListener('submit', async e=>{
  e.preventDefault();
  const btn = qs('#admin-login-btn'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Signing in…';
  const ok = await AuthService.login(qs('#login-user').value.trim(), qs('#login-pass').value);
  btn.disabled=false; btn.innerHTML='Sign in';
  if(ok){ location.hash = '#/admin/overview'; } else { qs('#admin-login-error').style.display='block'; }
});
qs('#admin-logout-link').addEventListener('click', e=>{ e.preventDefault(); AuthService.logout(); location.hash='#/home'; });

/* =========================================================================
   10. ADMIN DASHBOARD
========================================================================= */
const adminState = { tab:'overview' };

function setActiveAdminNav(){ qsa('#admin-sidebar a[data-tab]').forEach(a=> a.classList.toggle('active', a.dataset.tab===adminState.tab)); }

function renderAdminDashboard(){
  document.title = 'Admin — '+DataStore.getSettings().siteName;
  renderAdminTab(adminState.tab);
  setActiveAdminNav();
}

function renderAdminTab(tab){
  const content = qs('#admin-main-content');
  if(tab==='overview') renderAdminOverview(content);
  else if(tab==='projects') renderAdminProjects(content);
  else if(tab==='add-project') renderAdminAddProject(content);
  else if(tab==='categories') renderAdminCategories(content);
  else if(tab==='live-sites') renderAdminLiveSites(content);
  else if(tab==='downloads') renderAdminDownloads(content);
  else if(tab==='settings') renderAdminSettings(content);
  else renderAdminOverview(content);
}

function renderAdminOverview(content){
  const projects = DataStore.getProjects();
  const totalDownloads = projects.reduce((s,p)=>s+(p.downloadCount||0),0);
  const paid = projects.filter(p=>!p.isFree).length;
  const driveConnected = DriveAPI.isConnected();
  content.innerHTML = `
    <div class="admin-topline"><h2>Overview</h2><a href="#/admin/add-project" class="btn btn-primary btn-sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg> Upload project</a></div>
    ${driveConnected ? '' : `<div class="warn-banner info-banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M12 2 2 20h20Z"/></svg> Google Drive isn't connected yet this session. Connect it from <a href="#/admin/settings" style="text-decoration:underline;">Settings</a> before uploading a new project.</div>`}
    <div class="kpi-grid">
      <div class="kpi-card"><svg data-lucide="folder"></svg><b>${projects.length}</b><span>Total projects</span></div>
      <div class="kpi-card"><svg data-lucide="gift"></svg><b>${projects.filter(p=>p.isFree).length}</b><span>Free projects</span></div>
      <div class="kpi-card"><svg data-lucide="badge-dollar-sign"></svg><b>${paid}</b><span>Premium projects</span></div>
      <div class="kpi-card"><svg data-lucide="download"></svg><b>${totalDownloads.toLocaleString()}</b><span>Total downloads</span></div>
    </div>
    <div class="admin-panel"><div class="admin-panel-header"><h3>Recent uploads</h3></div>
      <div class="admin-panel-body">${projects.length ? projects.slice(0,5).map(p=>`<div class="amc-row" style="border-bottom:1px solid var(--border);padding:10px 0;"><span>${escapeHtml(p.name)}</span><b>${formatDate(p.createdAt)}</b></div>`).join('') : '<p style="color:var(--text-muted);">No projects yet — upload your first one.</p>'}</div>
    </div>`;
  refreshIcons();
}

function renderAdminProjects(content){
  const projects = DataStore.getProjects();
  content.innerHTML = `
    <div class="admin-topline"><h2>Projects</h2><a href="#/admin/add-project" class="btn btn-primary btn-sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg> Upload project</a></div>
    <div class="admin-panel"><div class="admin-panel-body">
      ${projects.length ? `<div class="responsive-table"><table class="admin-table"><thead><tr><th>Project</th><th>Category</th><th>Price</th><th>Downloads</th><th></th></tr></thead><tbody>
        ${projects.map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category)}</td><td>${p.isFree?'Free':formatPrice(p.price)}</td><td>${(p.downloadCount||0).toLocaleString()}</td>
        <td class="row-actions"><button class="btn btn-secondary btn-sm" data-view="${p.id}">View</button><button class="btn btn-danger btn-sm" data-del="${p.id}">Delete</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="admin-cards-mobile">${projects.map(p=>`<div class="admin-mobile-card"><div class="amc-row"><b>${escapeHtml(p.name)}</b><span>${p.isFree?'Free':formatPrice(p.price)}</span></div><div class="amc-row"><span>${escapeHtml(p.category)}</span><span>${(p.downloadCount||0)} dl</span></div><div class="row-actions" style="margin-top:8px;"><button class="btn btn-secondary btn-sm" data-view="${p.id}">View</button><button class="btn btn-danger btn-sm" data-del="${p.id}">Delete</button></div></div>`).join('')}</div>`
      : emptyStateHtml('No projects yet', 'Upload your first project to see it here.')}
    </div></div>`;
  refreshIcons();
  qsa('[data-view]', content).forEach(b=> b.onclick = ()=>{ const p=DataStore.getProjectById(b.dataset.view); if(p) window.open('#/project/'+p.slug,'_blank'); });
  qsa('[data-del]', content).forEach(b=> b.onclick = ()=>{
    const p = DataStore.getProjectById(b.dataset.del);
    confirmDialog(`Delete "${p.name}"? This removes it from the site (the file stays in your Google Drive).`, ()=>{
      DataStore.deleteProject(p.id); toast('Project deleted.', 'success'); renderAdminTab('projects');
    }, 'Delete');
  });
}

function renderAdminAddProject(content){
  const cats = DataStore.getCategories();
  content.innerHTML = `
    <div class="admin-topline"><h2>Upload a new project</h2></div>
    <div class="info-banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M12 2 2 20h20Z"/></svg> The file you pick below uploads straight to your own Google Drive (into a folder named after the category). Nothing is stored on this website itself — it only remembers the download link.</div>
    <div class="admin-panel"><div class="admin-panel-body">
      <div class="form-row">
        <div class="form-group"><label for="ap-name">Project name</label><input class="form-control" id="ap-name" placeholder="e.g. Portfolio Website"></div>
        <div class="form-group"><label for="ap-category">Category</label>
          <select class="form-control" id="ap-category">${cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}<option value="__new__">+ New category…</option></select>
        </div>
      </div>
      <div class="form-group" id="ap-new-cat-wrap" style="display:none;"><label for="ap-new-cat">New category name</label><input class="form-control" id="ap-new-cat" placeholder="e.g. WordPress Themes"></div>
      <div class="form-group"><label for="ap-short">Short description</label><input class="form-control" id="ap-short" placeholder="One line shown on the project card"></div>
      <div class="form-group"><label for="ap-full">Full description</label><textarea class="form-control" id="ap-full" placeholder="Longer description shown on the project page"></textarea></div>
      <div class="form-row">
        <div class="form-group"><label for="ap-tech">Technology</label><input class="form-control" id="ap-tech" placeholder="e.g. React, Node.js"></div>
        <div class="form-group"><label for="ap-version">Version</label><input class="form-control" id="ap-version" value="1.0.0"></div>
      </div>
      <div class="form-group"><label for="ap-requirements">Requirements</label><input class="form-control" id="ap-requirements" placeholder="e.g. PHP 8+, MySQL"></div>
      <div class="toggle-row"><div><b>This is a mobile/desktop app</b><div style="font-size:.78rem;color:var(--text-muted);">Shows an Install-style button instead of a plain Download button</div></div><button type="button" class="switch" id="ap-is-app"><span class="knob"></span></button></div>
      <div class="toggle-row"><div><b>Free project</b><div style="font-size:.78rem;color:var(--text-muted);">Off = premium (shows a Contact to Buy button instead of Download)</div></div><button type="button" class="switch on" id="ap-is-free"><span class="knob"></span></button></div>
      <div class="form-group hidden" id="ap-price-wrap"><label for="ap-price">Price (PKR)</label><input class="form-control" id="ap-price" type="number" min="0" placeholder="e.g. 2500"></div>

      <div class="form-group">
        <label>Project file (.zip, .rar or .apk)</label>
        <div class="dropzone" id="ap-dropzone">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
          <div id="ap-file-label">Click to choose a file, or drag it here</div>
        </div>
        <input type="file" id="ap-file-input" class="hidden" accept=".zip,.rar,.apk,.7z">
        <div class="upload-progress-track hidden" id="ap-progress-track"><div class="upload-progress-fill" id="ap-progress-fill"></div></div>
        <div id="ap-progress-text" style="font-size:.78rem;color:var(--text-muted);margin-top:6px;"></div>
      </div>

      <button class="btn btn-secondary" id="ap-connect-drive" type="button" style="margin-bottom:14px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        ${DriveAPI.isConnected() ? 'Google Drive connected ✓' : 'Connect Google Drive'}
      </button>
      <div>
        <button class="btn btn-primary" id="ap-submit" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg> Upload & publish</button>
      </div>
    </div></div>`;
  refreshIcons();

  const catSelect = qs('#ap-category');
  catSelect.onchange = ()=> qs('#ap-new-cat-wrap').style.display = catSelect.value==='__new__' ? 'flex' : 'none';

  const isAppSwitch = qs('#ap-is-app'); isAppSwitch.onclick = ()=> isAppSwitch.classList.toggle('on');
  const isFreeSwitch = qs('#ap-is-free'); isFreeSwitch.onclick = ()=>{ isFreeSwitch.classList.toggle('on'); qs('#ap-price-wrap').classList.toggle('hidden', isFreeSwitch.classList.contains('on')); };

  let selectedFile = null;
  const dz = qs('#ap-dropzone'); const fileInput = qs('#ap-file-input');
  dz.onclick = ()=> fileInput.click();
  fileInput.onchange = ()=>{ if(fileInput.files[0]){ selectedFile = fileInput.files[0]; qs('#ap-file-label').textContent = selectedFile.name+' ('+(selectedFile.size/1048576).toFixed(1)+' MB)'; } };
  ['dragover','dragleave','drop'].forEach(evt=> dz.addEventListener(evt, e=>{ e.preventDefault(); dz.classList.toggle('drag', evt==='dragover'); }));
  dz.addEventListener('drop', e=>{ if(e.dataTransfer.files[0]){ selectedFile = e.dataTransfer.files[0]; fileInput.files = e.dataTransfer.files; qs('#ap-file-label').textContent = selectedFile.name+' ('+(selectedFile.size/1048576).toFixed(1)+' MB)'; } });

  qs('#ap-connect-drive').onclick = async (e)=>{
    const btn = e.currentTarget; btn.disabled=true; btn.innerHTML='<span class="spinner dark-sp"></span> Connecting…';
    try{ await DriveAPI.connect(); toast('Google Drive connected.', 'success'); btn.innerHTML='Google Drive connected ✓'; }
    catch(err){ toast(err.message, 'error'); btn.innerHTML='Connect Google Drive'; }
    btn.disabled=false;
  };

  qs('#ap-submit').onclick = async ()=>{
    const name = qs('#ap-name').value.trim();
    let category = catSelect.value;
    const newCat = qs('#ap-new-cat').value.trim();
    if(category==='__new__'){ if(!newCat){ toast('Enter a name for the new category.', 'error'); return; } category = newCat; }
    if(!name){ toast('Enter a project name.', 'error'); return; }
    if(!selectedFile){ toast('Choose a file to upload.', 'error'); return; }

    const isApp = isAppSwitch.classList.contains('on');
    const isFree = isFreeSwitch.classList.contains('on');
    const price = isFree ? 0 : Number(qs('#ap-price').value||0);

    const submitBtn = qs('#ap-submit'); submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner"></span> Working…';
    const progressTrack = qs('#ap-progress-track'); const progressFill = qs('#ap-progress-fill'); const progressText = qs('#ap-progress-text');
    progressTrack.classList.remove('hidden');

    try{
      if(!DataStore.getCategories().includes(category)){
        const cats2 = DataStore.getCategories(); cats2.push(category); DataStore.saveCategories(cats2);
      }
      progressText.textContent = 'Connecting to Google Drive…';
      await DriveAPI.ensureToken();
      progressText.textContent = 'Preparing category folder…';
      const folderId = await DriveAPI.ensureCategoryFolder(category);
      progressText.textContent = 'Uploading file…';
      const uploaded = await DriveAPI.uploadFile(selectedFile, folderId, (pct)=>{ progressFill.style.width = pct+'%'; progressText.textContent = 'Uploading… '+pct+'%'; });
      progressText.textContent = 'Finalizing download link…';
      const downloadUrl = await DriveAPI.makePublic(uploaded.id);

      const project = {
        id: uid(), slug: slugify(name)+'-'+Date.now().toString(36).slice(-4), name, category,
        shortDesc: qs('#ap-short').value.trim(), fullDesc: qs('#ap-full').value.trim(),
        technology: qs('#ap-tech').value.trim(), version: qs('#ap-version').value.trim()||'1.0.0',
        requirements: qs('#ap-requirements').value.trim(), features:[],
        isFree, price, type: isApp?'app':'website',
        fileSize: (selectedFile.size/1048576).toFixed(1)+' MB',
        driveFileId: uploaded.id, downloadUrl,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), downloadCount:0
      };
      DataStore.saveProject(project);
      toast('Project uploaded and published.', 'success');
      location.hash = '#/admin/projects';
    }catch(err){
      toast(err.message || 'Upload failed.', 'error');
      submitBtn.disabled=false; submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg> Upload & publish';
    }
  };
}

function renderAdminCategories(content){
  const cats = DataStore.getCategories(); const projects = DataStore.getProjects();
  content.innerHTML = `
    <div class="admin-topline"><h2>Categories</h2></div>
    <div class="admin-panel"><div class="admin-panel-body">
      <div class="form-row" style="align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;"><label for="new-cat-input">New category name</label><input class="form-control" id="new-cat-input" placeholder="e.g. WordPress Themes"></div>
        <button class="btn btn-primary" id="add-cat-btn" style="height:44px;">Add</button>
      </div>
    </div></div>
    <div class="admin-panel"><div class="admin-panel-body">
      ${cats.map(c=>{ const count = projects.filter(p=>p.category===c).length; return `<div class="amc-row" style="border-bottom:1px solid var(--border);padding:12px 0;">
        <span style="display:flex;align-items:center;gap:8px;"><svg data-lucide="${categoryIcon(c)}" style="width:16px;height:16px;"></svg> ${escapeHtml(c)} <span style="color:var(--text-muted);font-size:.78rem;">(${count})</span></span>
        <button class="btn btn-danger btn-sm" data-del-cat="${escapeHtml(c)}" ${count>0?'disabled title="Move or delete its projects first"':''}>Delete</button></div>`; }).join('')}
    </div></div>`;
  refreshIcons();
  qs('#add-cat-btn').onclick = ()=>{
    const val = qs('#new-cat-input').value.trim();
    if(!val){ toast('Enter a category name.', 'error'); return; }
    const cats2 = DataStore.getCategories();
    if(cats2.includes(val)){ toast('That category already exists.', 'error'); return; }
    cats2.push(val); DataStore.saveCategories(cats2);
    toast('Category added.', 'success'); renderAdminTab('categories');
  };
  qsa('[data-del-cat]', content).forEach(b=> b.onclick = ()=>{
    confirmDialog(`Delete category "${b.dataset.delCat}"?`, ()=>{
      DataStore.saveCategories(DataStore.getCategories().filter(c=>c!==b.dataset.delCat));
      toast('Category deleted.', 'success'); renderAdminTab('categories');
    }, 'Delete');
  });
}

let liveSiteEditingId = null;
function renderAdminLiveSites(content){
  const sites = DataStore.getLiveSites();
  content.innerHTML = `
    <div class="admin-topline"><h2>Live Websites</h2><p style="color:var(--text-muted);font-size:.85rem;">These show up on your homepage and on the public "Live Sites" page for every visitor.</p></div>
    <div class="admin-panel"><div class="admin-panel-header"><h3 id="ls-form-title">Add a live website</h3></div>
      <div class="admin-panel-body">
        <input type="hidden" id="ls-id">
        <div class="form-row">
          <div class="form-group"><label for="ls-name">Website name</label><input class="form-control" id="ls-name" placeholder="e.g. My Portfolio"></div>
          <div class="form-group"><label for="ls-url">Website URL</label><input class="form-control" id="ls-url" placeholder="https://example.com"></div>
        </div>
        <div class="form-group"><label for="ls-desc">Short description</label><textarea class="form-control" id="ls-desc" placeholder="One or two lines about this website"></textarea></div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-primary" id="ls-save-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg> Add website</button>
          <button class="btn btn-secondary hidden" id="ls-cancel-btn" type="button">Cancel edit</button>
        </div>
      </div>
    </div>
    <div class="admin-panel"><div class="admin-panel-body">
      ${sites.length ? `<div class="responsive-table"><table class="admin-table"><thead><tr><th>Name</th><th>URL</th><th></th></tr></thead><tbody>
        ${sites.map(s=>`<tr><td>${escapeHtml(s.name)}</td><td><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener" style="color:var(--accent);">${escapeHtml(s.url.replace(/^https?:\/\//,''))}</a></td>
        <td class="row-actions"><button class="btn btn-secondary btn-sm" data-edit-ls="${s.id}">Edit</button><button class="btn btn-danger btn-sm" data-del-ls="${s.id}">Delete</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="admin-cards-mobile">${sites.map(s=>`<div class="admin-mobile-card"><b>${escapeHtml(s.name)}</b><div class="amc-row"><span style="word-break:break-all;">${escapeHtml(s.url)}</span></div><div class="row-actions" style="margin-top:8px;"><button class="btn btn-secondary btn-sm" data-edit-ls="${s.id}">Edit</button><button class="btn btn-danger btn-sm" data-del-ls="${s.id}">Delete</button></div></div>`).join('')}</div>`
      : emptyStateHtml('No live websites yet', 'Add your first one using the form above.')}
    </div></div>`;
  refreshIcons();
  liveSiteEditingId = null;

  function resetForm(){
    liveSiteEditingId = null;
    qs('#ls-id').value=''; qs('#ls-name').value=''; qs('#ls-url').value=''; qs('#ls-desc').value='';
    qs('#ls-form-title').textContent='Add a live website';
    qs('#ls-save-btn').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg> Add website';
    qs('#ls-cancel-btn').classList.add('hidden');
    refreshIcons();
  }

  qs('#ls-save-btn').onclick = ()=>{
    const name = qs('#ls-name').value.trim();
    let url = qs('#ls-url').value.trim();
    const description = qs('#ls-desc').value.trim();
    if(!name){ toast('Enter a website name.', 'error'); return; }
    if(!url){ toast('Enter a website URL.', 'error'); return; }
    if(!/^https?:\/\//i.test(url)) url = 'https://'+url;
    try{ new URL(url); }catch(e){ toast('That URL doesn\'t look valid.', 'error'); return; }

    const site = { id: liveSiteEditingId || uid(), name, url, description, createdAt: liveSiteEditingId ? (sites.find(s=>s.id===liveSiteEditingId)||{}).createdAt || new Date().toISOString() : new Date().toISOString() };
    DataStore.saveLiveSite(site);
    toast(liveSiteEditingId ? 'Website updated.' : 'Website added.', 'success');
    renderAdminTab('live-sites');
  };
  qs('#ls-cancel-btn').onclick = resetForm;
  qsa('[data-edit-ls]', content).forEach(b=> b.onclick = ()=>{
    const s = sites.find(x=>x.id===b.dataset.editLs); if(!s) return;
    liveSiteEditingId = s.id;
    qs('#ls-id').value = s.id; qs('#ls-name').value = s.name; qs('#ls-url').value = s.url; qs('#ls-desc').value = s.description||'';
    qs('#ls-form-title').textContent = 'Edit live website';
    qs('#ls-save-btn').innerHTML = 'Save changes';
    qs('#ls-cancel-btn').classList.remove('hidden');
    qs('#ls-name').scrollIntoView({behavior:'smooth', block:'center'});
  });
  qsa('[data-del-ls]', content).forEach(b=> b.onclick = ()=>{
    const s = sites.find(x=>x.id===b.dataset.delLs);
    confirmDialog(`Remove "${s.name}" from your live websites?`, ()=>{
      DataStore.deleteLiveSite(s.id); toast('Removed.', 'success'); renderAdminTab('live-sites');
    }, 'Remove');
  });
}

function renderAdminDownloads(content){
  const sorted = [...DataStore.getProjects()].sort((a,b)=>(b.downloadCount||0)-(a.downloadCount||0));
  content.innerHTML = `<div class="admin-topline"><h2>Downloads</h2></div>
    <div class="admin-panel"><div class="admin-panel-body">
      ${sorted.length ? `<div class="responsive-table"><table class="admin-table"><thead><tr><th>Project</th><th>Type</th><th>Downloads</th></tr></thead><tbody>
        ${sorted.map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${p.isFree?'Free':'Paid'}</td><td><b>${(p.downloadCount||0).toLocaleString()}</b></td></tr>`).join('')}
      </tbody></table></div>` : emptyStateHtml('No data yet', 'Download counts will show up here once projects are live.')}
    </div></div>`;
}

function renderAdminSettings(content){
  const settings = DataStore.getSettings();
  content.innerHTML = `
    <div class="admin-topline"><h2>Settings</h2></div>
    <div class="admin-panel"><div class="admin-panel-header"><h3>Site details</h3></div>
      <div class="admin-panel-body">
        <div class="settings-grid">
          <div class="form-group"><label for="s-name">Website name</label><input class="form-control" id="s-name" value="${escapeHtml(settings.siteName)}"></div>
          <div class="form-group"><label for="s-email">Contact email</label><input class="form-control" id="s-email" value="${escapeHtml(settings.contactEmail)}"></div>
          <div class="form-group"><label for="s-youtube">YouTube channel URL</label><input class="form-control" id="s-youtube" value="${escapeHtml(settings.youtubeUrl)}"></div>
        </div>
        <button class="btn btn-primary" id="save-basic-settings">Save</button>
      </div>
    </div>
    <div class="admin-panel"><div class="admin-panel-header"><h3>Google Drive connection</h3></div>
      <div class="admin-panel-body">
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:14px;">Uploaded files are saved into a folder called <b>Mr JB World Uploads</b> in your own Google Drive, with one sub-folder per category. The app can only see files it creates itself — never your other Drive files.</p>
        <div class="form-group"><label for="s-client-id">Google OAuth Client ID</label><input class="form-control" id="s-client-id" value="${escapeHtml(settings.driveClientId)}"></div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span class="provider-chip"><span class="dot ${DriveAPI.isConnected()?'active':'inactive'}"></span>${DriveAPI.isConnected()?'Connected for this session':'Not connected yet'}</span>
          <button class="btn btn-secondary btn-sm" id="s-connect-drive">Connect Google Drive</button>
        </div>
        <div class="info-banner" style="margin-top:16px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M12 2 2 20h20Z"/></svg> The connection is per-browser-session — you'll reconnect once each time you come back to upload (this keeps your Drive access from being stored permanently anywhere).</div>
        <button class="btn btn-primary" id="save-drive-settings" style="margin-top:14px;">Save Client ID</button>
      </div>
    </div>
    <div class="admin-panel"><div class="admin-panel-header"><h3>Admin access</h3></div>
      <div class="admin-panel-body">
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:16px;">The "Admin" area has no visible link on the site. Reach it by opening <code>#/admin-login</code> directly, or by clicking the copyright text in the footer 5 times quickly. There is no public sign-up — only this one account can ever log in.</p>
        <div class="form-row">
          <div class="form-group"><label for="s-new-username">Username</label><input class="form-control" id="s-new-username" value="${escapeHtml(JSON.parse(localStorage.getItem(DB.ADMIN_CREDS)||'{}').username||'')}"></div>
          <div class="form-group"><label for="s-current-pass">Current password</label><input class="form-control" id="s-current-pass" type="password" autocomplete="current-password"></div>
        </div>
        <div class="form-group"><label for="s-new-pass">New password (leave blank to keep current)</label><input class="form-control" id="s-new-pass" type="password" autocomplete="new-password"></div>
        <button class="btn btn-primary" id="s-change-pass-btn">Update admin login</button>
      </div>
    </div>
    <div class="admin-panel"><div class="admin-panel-header"><h3>Troubleshooting Google Drive "access_denied"</h3></div>
      <div class="admin-panel-body">
        <p style="font-size:.85rem;color:var(--text-muted);line-height:1.6;">This Google Cloud project is still in <b>Testing</b> mode, so Google only allows Google accounts that are explicitly added as test users to connect — that's expected, not a bug. One-time fix in Google Cloud Console:</p>
        <ol style="font-size:.85rem;color:var(--text-muted);line-height:1.9;padding-left:18px;margin-top:8px;">
          <li>Open <b>APIs & Services → OAuth consent screen</b>.</li>
          <li>Scroll to <b>Test users</b> → Add users → enter your own Google account email.</li>
          <li>Save, then try "Connect Google Drive" again with that same Google account.</li>
        </ol>
        <p style="font-size:.85rem;color:var(--text-muted);margin-top:10px;">(Publishing the app to "Production" later removes this limit, but requires Google's verification review — not needed for personal use.)</p>
      </div>
    </div>`;
  refreshIcons();
  qs('#s-change-pass-btn').onclick = async ()=>{
    const btn = qs('#s-change-pass-btn'); const newUser = qs('#s-new-username').value.trim(); const curPass = qs('#s-current-pass').value; const newPass = qs('#s-new-pass').value;
    if(!curPass){ toast('Enter your current password.', 'error'); return; }
    btn.disabled = true;
    try{
      const creds = JSON.parse(localStorage.getItem(DB.ADMIN_CREDS)||'{}');
      await AuthService.changePassword(curPass, newUser, newPass || curPass);
      toast('Admin login updated.', 'success');
      qs('#s-current-pass').value=''; qs('#s-new-pass').value='';
    }catch(err){ toast(err.message, 'error'); }
    btn.disabled = false;
  };
  qs('#save-basic-settings').onclick = ()=>{
    const s = DataStore.getSettings();
    s.siteName = qs('#s-name').value.trim()||s.siteName;
    s.contactEmail = qs('#s-email').value.trim()||s.contactEmail;
    s.youtubeUrl = qs('#s-youtube').value.trim()||s.youtubeUrl;
    DataStore.saveSettings(s); toast('Saved.', 'success'); applyBrandingLinks();
  };
  qs('#save-drive-settings').onclick = ()=>{
    const s = DataStore.getSettings();
    s.driveClientId = qs('#s-client-id').value.trim();
    DataStore.saveSettings(s); toast('Client ID saved.', 'success');
  };
  qs('#s-connect-drive').onclick = async (e)=>{
    const btn = e.currentTarget; btn.disabled=true; btn.textContent='Connecting…';
    try{ await DriveAPI.connect(); toast('Google Drive connected.', 'success'); renderAdminTab('settings'); }
    catch(err){ toast(err.message, 'error'); btn.disabled=false; btn.textContent='Connect Google Drive'; }
  };
}

/* =========================================================================
   11. ROUTER
========================================================================= */
const PAGE_IDS = ['home','projects','categories','live-sites','project-detail','about','contact','legal','admin-login','admin'];
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
  else if(parts[0]==='about'){ showPage('about'); document.title='About — '+DataStore.getSettings().siteName; renderAboutStats(); }
  else if(parts[0]==='contact'){ showPage('contact'); document.title='Contact — '+DataStore.getSettings().siteName; initContactPage(); }
  else if(parts[0]==='legal'){ showPage('legal'); renderLegalPage(parts[1]||'privacy'); }
  else if(parts[0]==='admin-login'){ showPage('admin-login'); document.title='Admin — '+DataStore.getSettings().siteName; renderAdminLoginPage(); }
  else if(parts[0]==='admin'){
    if(!AuthService.isLoggedIn()){ location.hash='#/admin-login'; return; }
    showPage('admin'); adminState.tab = parts[1]||'overview'; renderAdminDashboard();
  }
  else { showPage('home'); renderHome(); }
  applyBrandingLinks();
}
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', ()=>{ qs('#footer-year').textContent = new Date().getFullYear(); refreshIcons(); router(); });
if(document.readyState !== 'loading'){ qs('#footer-year').textContent = new Date().getFullYear(); router(); }

})();