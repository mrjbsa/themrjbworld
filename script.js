(function(){
'use strict';

/* =========================================================================
   1. STORAGE KEYS & DEFAULTS
========================================================================= */
const DB = { PROJECTS:'mjbw_projects', CATEGORIES:'mjbw_categories', SETTINGS:'mjbw_settings', ADMIN:'mjbw_admin_session', ADMIN_CREDS:'mjbw_admin_creds', DRIVE_FOLDERS:'mjbw_drive_folders', THEME:'mjbw_theme' };

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
  siteUrl:'https://mrjbsa.github.io/themrjbworld/',
  contactEmail:'mrjbsa.official@outlook.com',
  youtubeUrl:'https://www.youtube.com/@themrjbworld',
  currency:'PKR',
  driveClientId:'669688636685-lm6fntdu1cm5h1r0adat5acfes2sm0gr.apps.googleusercontent.com',
  driveRootFolderId:''
};

function seedIfEmpty(){
  if(!localStorage.getItem(DB.PROJECTS)) localStorage.setItem(DB.PROJECTS, JSON.stringify([]));
  if(!localStorage.getItem(DB.CATEGORIES)) localStorage.setItem(DB.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
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
/* -------------------------------------------------------------------------
   LIVE (PUBLIC) DATA  —  projects.json
   This is the fix for "only I can see my uploads".
   localStorage lives inside ONE browser, so nothing saved there can ever be
   seen by a visitor. Every visitor now reads projects.json, which sits next
   to index.html on the server (GitHub Pages). The admin works on a local
   draft copy and publishes it from Admin -> "Publish to site".
------------------------------------------------------------------------- */
const PUBLIC_DATA_FILE = 'projects.json';
const LiveData = { loaded:false, error:'', projects:[], categories:[], settings:null, generatedAt:'' };

async function loadLiveData(){
  try{
    const res = await fetch(PUBLIC_DATA_FILE + '?v=' + Date.now(), { cache:'no-store' });
    if(!res.ok) throw new Error('projects.json not found (HTTP '+res.status+')');
    const data = await res.json();
    LiveData.projects   = Array.isArray(data.projects) ? data.projects : [];
    LiveData.categories = (Array.isArray(data.categories) && data.categories.length) ? data.categories : DEFAULT_CATEGORIES.slice();
    LiveData.settings   = data.settings || null;
    LiveData.generatedAt = data.generatedAt || '';
    LiveData.loaded = true; LiveData.error = '';
  }catch(e){
    LiveData.loaded = false;
    LiveData.error = e.message || String(e);
  }
}

/* Visitors always see the published file. The admin (while signed in) sees
   the local draft, so unpublished work is visible only to him. */
function useLive(){ return LiveData.loaded && !AuthService.isLoggedIn(); }

const DataStore = {
  /* ---- raw local draft (admin working copy) ---- */
  rawProjects(){ return JSON.parse(localStorage.getItem(DB.PROJECTS)||'[]'); },
  rawCategories(){ return JSON.parse(localStorage.getItem(DB.CATEGORIES)||'[]'); },
  rawSettings(){ return JSON.parse(localStorage.getItem(DB.SETTINGS)||'{}'); },
  getLocalProjectById(id){ return this.rawProjects().find(p=>p.id===id)||null; },

  /* ---- what the current viewer should see ---- */
  getProjects(){ return useLive() ? LiveData.projects.slice() : this.rawProjects(); },
  getProjectBySlug(slug){ return this.getProjects().find(p=>p.slug===slug)||null; },
  getProjectById(id){ return this.getProjects().find(p=>p.id===id)||null; },
  getCategories(){ return useLive() ? LiveData.categories.slice() : this.rawCategories(); },
  getSettings(){
    const local = this.rawSettings();
    if(useLive() && LiveData.settings) return Object.assign({}, local, LiveData.settings);
    return local;
  },

  /* ---- writes always go to the local draft ---- */
  saveProject(project){ const all=this.rawProjects(); const idx=all.findIndex(p=>p.id===project.id); if(idx>-1) all[idx]=project; else all.unshift(project); localStorage.setItem(DB.PROJECTS, JSON.stringify(all)); return project; },
  deleteProject(id){ localStorage.setItem(DB.PROJECTS, JSON.stringify(this.rawProjects().filter(p=>p.id!==id))); },
  incrementDownload(id){
    if(useLive()){ const p = LiveData.projects.find(x=>x.id===id); if(p) p.downloadCount=(p.downloadCount||0)+1; return; }
    const all=this.rawProjects(); const p=all.find(x=>x.id===id);
    if(p){ p.downloadCount=(p.downloadCount||0)+1; localStorage.setItem(DB.PROJECTS, JSON.stringify(all)); }
  },
  saveCategories(cats){ localStorage.setItem(DB.CATEGORIES, JSON.stringify(cats)); },
  saveSettings(s){ localStorage.setItem(DB.SETTINGS, JSON.stringify(s)); },
  getDriveFolders(){ return JSON.parse(localStorage.getItem(DB.DRIVE_FOLDERS)||'{}'); },
  saveDriveFolders(map){ localStorage.setItem(DB.DRIVE_FOLDERS, JSON.stringify(map)); },

  /* ---- publishing ---- */
  buildPublishJson(){
    const s = this.rawSettings();
    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      settings: { siteName:s.siteName, contactEmail:s.contactEmail, youtubeUrl:s.youtubeUrl, siteUrl:s.siteUrl },
      categories: this.rawCategories(),
      projects: this.rawProjects()
    }, null, 2);
  },
  hasUnpublishedChanges(){
    if(!LiveData.loaded) return this.rawProjects().length > 0;
    const norm = (arr)=> JSON.stringify((arr||[]).map(p=>[p.id,p.name,p.category,p.slug,p.shortDesc,p.fullDesc,p.price,p.isFree,p.type,p.downloadUrl,p.image?1:0,p.version,p.requirements,p.technology,(p.features||[]).join('|')]));
    return norm(this.rawProjects()) !== norm(LiveData.projects);
  },
  pullFromLive(){
    if(!LiveData.loaded) return false;
    localStorage.setItem(DB.PROJECTS, JSON.stringify(LiveData.projects));
    const merged = Array.from(new Set(LiveData.categories.concat(this.rawCategories())));
    localStorage.setItem(DB.CATEGORIES, JSON.stringify(merged));
    return true;
  }
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
    // drive.usercontent.google.com skips the "can't scan this file" interstitial
    // that the old uc?export=download link shows for big .zip / .apk files.
    return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
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
/* Shrink a picked screenshot so it can live inside projects.json
   (max 900px wide, JPEG ~72% -> usually 40-90 KB). */
function compressImage(file, maxW, quality){
  maxW = maxW || 900; quality = quality || 0.72;
  return new Promise((resolve, reject)=>{
    if(!file.type || !file.type.startsWith('image/')){ reject(new Error('That file is not an image.')); return; }
    const reader = new FileReader();
    reader.onerror = ()=> reject(new Error('Could not read the image.'));
    reader.onload = ()=>{
      const img = new Image();
      img.onerror = ()=> reject(new Error('Could not open the image.'));
      img.onload = ()=>{
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width*scale), h = Math.round(img.height*scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,w,h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function downloadTextFile(filename, text, mime){
  const blob = new Blob([text], { type: mime || 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 2000);
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
/* Initials used by the auto-generated preview */
function projectInitials(name){
  const words = String(name||'?').trim().split(/\s+/).filter(Boolean);
  if(!words.length) return '?';
  if(words.length===1) return words[0].slice(0,2).toUpperCase();
  return (words[0][0]+words[1][0]).toUpperCase();
}

/* Thumbnail body: the admin's screenshot if there is one, otherwise a
   device mock-up with the project's initials — much better than a bare icon. */
function thumbInnerHtml(p){
  if(p.image){
    return `<img class="thumb-img" src="${p.image}" alt="${escapeHtml(p.name)} preview" loading="lazy">`;
  }
  const grad = categoryGradient(p.category);
  const isApp = p.type==='app';
  return `<div class="thumb-mock ${isApp?'mock-phone':'mock-browser'}">
    <div class="mock-frame">
      <div class="mock-bar"><i></i><i></i><i></i></div>
      <div class="mock-body">
        <span class="mock-initials" style="background:${grad}">${escapeHtml(projectInitials(p.name))}</span>
        <span class="mock-name">${escapeHtml(p.name)}</span>
        <span class="mock-lines"><span></span><span></span></span>
      </div>
    </div>
  </div>`;
}

function projectCardHtml(p){
  const grad = categoryGradient(p.category);
  return `<div class="project-card">
    <div class="project-thumb" style="background:${grad};">
      ${thumbInnerHtml(p)}
      <span class="badge">${escapeHtml(p.category)}</span>
      <span class="badge-price ${p.isFree?'badge-free':'badge-paid'}">${p.isFree?'Free':formatPrice(p.price)}</span>
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
    toast('Download started — open the file on your device to finish installing.', 'success');
    setTimeout(()=>{ btn.disabled=false; btn.dataset.busy=''; bar.style.width='0%'; label.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v13m0 0 4-4m-4 4-4-4M4 20h16"/></svg> Install'; }, 2600);
  }, 1500);
}

/* =========================================================================
   8. PUBLIC PAGE RENDERERS
========================================================================= */
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
  maybeShowDraftBanner();
  refreshIcons();
  wireActionButtons(qs('#home-projects'));
  applyBrandingLinks();
}

/* Reminder for the admin only: his draft is not the published file yet. */
function maybeShowDraftBanner(){
  const host = qs('#home-projects'); if(!host) return;
  if(!AuthService.isLoggedIn() || !DataStore.hasUnpublishedChanges()) return;
  const div = document.createElement('div');
  div.className = 'draft-banner';
  div.style.gridColumn = '1/-1';
  div.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M12 2 2 20h20Z"/></svg><span>You are seeing your local draft. Visitors still see the published <b>projects.json</b> — open <a href="#/admin/publish" style="text-decoration:underline;">Publish to site</a> to make these changes public.</span>';
  host.prepend(div);
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

/* =========================================================================
   MARKDOWN  —  turns the "Full description" text into a professional,
   README-style page (headings, bold, lists, tables, links, code, quotes).
   Everything is HTML-escaped FIRST, so pasted text can never inject scripts.
========================================================================= */
function mdInline(text){
  const stash = [];
  const keep = (html)=>{ stash.push(html); return '\u0001'+(stash.length-1)+'\u0001'; };
  let s = escapeHtml(text);

  s = s.replace(/`([^`\n]+)`/g, (m,c)=> keep('<code>'+c+'</code>'));
  s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (m,alt,url)=> keep('<img class="md-img" src="'+url+'" alt="'+alt+'" loading="lazy">'));
  s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g, (m,label,url)=> keep('<a href="'+url+'" target="_blank" rel="noopener noreferrer">'+label+'</a>'));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, (m,pre,url)=>{
    let trail = ''; const t = url.match(/[.,;:!?)]+$/);
    if(t){ trail = t[0]; url = url.slice(0, -trail.length); }
    return pre + keep('<a href="'+url+'" target="_blank" rel="noopener noreferrer">'+url+'</a>') + trail;
  });

  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\w])__([^_\n]+)__(?!\w)/g, '$1<strong>$2</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

  return s.replace(/\u0001(\d+)\u0001/g, (m,i)=> stash[Number(i)]);
}

function mdSplitRow(line){
  let t = line.trim();
  if(t.startsWith('|')) t = t.slice(1);
  if(t.endsWith('|')) t = t.slice(0,-1);
  return t.split('|').map(c=>c.trim());
}

function mdListHtml(items){
  let html = ''; const stack = [];
  for(const it of items){
    while(stack.length && it.indent < stack[stack.length-1].indent){ html += '</li></'+stack.pop().tag+'>'; }
    const tag = it.ordered ? 'ol' : 'ul';
    let top = stack[stack.length-1];
    if(top && it.indent === top.indent){
      html += '</li>';
      if(top.tag !== tag){ html += '</'+stack.pop().tag+'>'; top = null; }
    }
    if(!top || it.indent > top.indent){ stack.push({ indent:it.indent, tag }); html += '<'+tag+'>'; }
    let body = it.text; let cls = '';
    const task = body.match(/^\[( |x|X)\]\s+(.*)$/);
    if(task){ cls = ' class="md-task"'; body = (task[1]===' ' ? '<span class="md-box"></span>' : '<span class="md-box done">✓</span>') + mdInline(task[2]); }
    else body = mdInline(body);
    html += '<li'+cls+'>'+body;
  }
  while(stack.length) html += '</li></'+stack.pop().tag+'>';
  return html;
}

function renderMarkdown(src, opts){
  opts = opts || {};
  src = String(src||'').replace(/\r\n?/g, '\n').replace(/\t/g, '  ');

  if(opts.skipLeadingH1){
    const norm = (x)=> String(x).toLowerCase().replace(/[^a-z0-9]+/g, '');
    const m = src.match(/^\s*#\s+(.+?)\s*#*\s*(\n|$)/);
    if(m && norm(m[1]).includes(norm(opts.skipLeadingH1))) src = src.slice(m[0].length);
  }

  const codeBlocks = [];
  src = src.replace(/```[\w-]*\n([\s\S]*?)```/g, (m,code)=>{
    codeBlocks.push('<pre class="md-pre"><code>'+escapeHtml(code.replace(/\n$/,''))+'</code></pre>');
    return '\n\u0002'+(codeBlocks.length-1)+'\u0002\n';
  });

  const lines = src.split('\n');
  const isHr = (l)=> /^\s*([-*_])(\s*\1){2,}\s*$/.test(l);
  const isHeading = (l)=> /^#{1,6}\s+\S/.test(l);
  const isQuote = (l)=> /^\s*>/.test(l);
  const isList = (l)=> /^\s*([-*+]|\d+[.)])\s+\S/.test(l);
  const isCode = (l)=> /^\u0002\d+\u0002$/.test(l.trim());
  const isTableSep = (l)=> /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l) && l.includes('-');
  const startsBlock = (l, next)=> isHr(l) || isHeading(l) || isQuote(l) || isList(l) || isCode(l) || (l.includes('|') && next !== undefined && isTableSep(next));

  const out = []; let i = 0;
  while(i < lines.length){
    const line = lines[i];
    if(!line.trim()){ i++; continue; }

    if(isCode(line)){ out.push(codeBlocks[Number(line.trim().replace(/\u0002/g,''))]); i++; continue; }

    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if(h){ const n = h[1].length; out.push('<h'+n+'>'+mdInline(h[2])+'</h'+n+'>'); i++; continue; }

    if(isHr(line)){ out.push('<hr>'); i++; continue; }

    if(isQuote(line)){
      const buf = [];
      while(i < lines.length && isQuote(lines[i])){ buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push('<blockquote>'+renderMarkdown(buf.join('\n'))+'</blockquote>');
      continue;
    }

    if(line.includes('|') && i+1 < lines.length && isTableSep(lines[i+1])){
      const head = mdSplitRow(line);
      const aligns = mdSplitRow(lines[i+1]).map(c=> c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : '');
      i += 2; const rows = [];
      while(i < lines.length && lines[i].trim() && lines[i].includes('|')){ rows.push(mdSplitRow(lines[i])); i++; }
      const al = (k)=> aligns[k] ? ' style="text-align:'+aligns[k]+'"' : '';
      out.push('<div class="md-table-wrap"><table><thead><tr>'+head.map((c,k)=>'<th'+al(k)+'>'+mdInline(c)+'</th>').join('')+'</tr></thead><tbody>'+
        rows.map(r=>'<tr>'+head.map((_,k)=>'<td'+al(k)+'>'+mdInline(r[k]||'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');
      continue;
    }

    if(isList(line)){
      const items = [];
      while(i < lines.length){
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if(m){ items.push({ indent:m[1].length, ordered:/\d/.test(m[2]), text:m[3] }); i++; }
        else if(lines[i].trim() && /^\s+\S/.test(lines[i]) && items.length && !startsBlock(lines[i])){ items[items.length-1].text += ' '+lines[i].trim(); i++; }
        else break;
      }
      out.push(mdListHtml(items));
      continue;
    }

    const buf = [line]; i++;
    while(i < lines.length && lines[i].trim() && !startsBlock(lines[i], lines[i+1])){ buf.push(lines[i]); i++; }
    out.push('<p>'+buf.map(mdInline).join('<br>')+'</p>');
  }
  return out.join('\n');
}

/* A ready-made structure so a description looks professional from the first upload. */
const DESCRIPTION_TEMPLATE = `## 🚀 About this project
Write two or three lines here explaining what the project is and who it is for.

## ✨ Key features
- **Feature one** — a short explanation
- **Feature two** — a short explanation
- **Feature three** — a short explanation

## 📱 Requirements
| Item | Details |
|---|---|
| Platform | Android 7.0+ / Any modern browser |
| Version | 1.0.0 |

## 📥 How to install
1. Download the file from this page
2. Extract it (for ZIP files) or open it (for APK files)
3. Follow the setup steps and enjoy

> **Note:** Add any important tip or warning here.

## 📩 Support
Questions or feedback? Use the Contact page.`;

function renderProjectDetail(slug){
  const p = DataStore.getProjectBySlug(slug);
  const content = qs('#project-detail-content');
  if(!p){ content.innerHTML = emptyStateHtml('Project not found', 'It may have been removed.'); document.title='Not found'; return; }
  document.title = p.name+' — '+DataStore.getSettings().siteName;
  content.innerHTML = `
    <a href="#/projects" class="btn btn-ghost btn-sm" style="margin-bottom:20px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5m7-7-7 7 7 7"/></svg> Back to projects</a>
    <div class="detail-grid">
      <div>
        <div class="detail-hero" style="background:${categoryGradient(p.category)}">${thumbInnerHtml(p)}</div>
        <div class="eyebrow-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> ${escapeHtml(p.category)}</div>
        <h1 style="font-size:1.9rem;">${escapeHtml(p.name)}</h1>
        ${p.fullDesc
          ? `<article class="md-card"><div class="md-card-head"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM4 19a2 2 0 0 1 2-2h12"/></svg> About this project</div><div class="md-body">${renderMarkdown(p.fullDesc, { skipLeadingH1: p.name })}</div></article>`
          : `<p class="md-plain">${escapeHtml(p.shortDesc||'')}</p>`}
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
const adminState = { tab:'overview', arg:null };

function setActiveAdminNav(){
  const highlight = adminState.tab==='edit' ? 'projects' : adminState.tab;
  qsa('#admin-sidebar a[data-tab]').forEach(a=> a.classList.toggle('active', a.dataset.tab===highlight));
}

function renderAdminDashboard(){
  document.title = 'Admin — '+DataStore.getSettings().siteName;
  renderAdminTab(adminState.tab, adminState.arg);
  setActiveAdminNav();
}

function renderAdminTab(tab, arg){
  const content = qs('#admin-main-content');
  if(tab==='overview') renderAdminOverview(content);
  else if(tab==='projects') renderAdminProjects(content);
  else if(tab==='add-project') renderAdminAddProject(content);
  else if(tab==='edit') renderAdminAddProject(content, arg);
  else if(tab==='publish') renderAdminPublish(content);
  else if(tab==='categories') renderAdminCategories(content);
  else if(tab==='downloads') renderAdminDownloads(content);
  else if(tab==='settings') renderAdminSettings(content);
  else renderAdminOverview(content);
}

function renderAdminOverview(content){
  const projects = DataStore.rawProjects();
  const totalDownloads = projects.reduce((s,p)=>s+(p.downloadCount||0),0);
  const paid = projects.filter(p=>!p.isFree).length;
  const driveConnected = DriveAPI.isConnected();
  content.innerHTML = `
    <div class="admin-topline"><h2>Overview</h2><a href="#/admin/add-project" class="btn btn-primary btn-sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg> Upload project</a></div>
    ${DataStore.hasUnpublishedChanges() ? `<div class="draft-banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M12 2 2 20h20Z"/></svg><span>You have changes that visitors cannot see yet. Open <a href="#/admin/publish" style="text-decoration:underline;">Publish to site</a> and upload the new <b>projects.json</b>.</span></div>` : ''}
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
  const projects = DataStore.rawProjects();
  content.innerHTML = `
    <div class="admin-topline"><h2>Projects</h2><a href="#/admin/add-project" class="btn btn-primary btn-sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg> Upload project</a></div>
    <div class="admin-panel"><div class="admin-panel-body">
      ${projects.length ? `<div class="responsive-table"><table class="admin-table"><thead><tr><th>Project</th><th>Category</th><th>Price</th><th>Downloads</th><th></th></tr></thead><tbody>
        ${projects.map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category)}</td><td>${p.isFree?'Free':formatPrice(p.price)}</td><td>${(p.downloadCount||0).toLocaleString()}</td>
        <td class="row-actions"><a class="btn btn-primary btn-sm" href="#/admin/edit/${p.id}">Edit</a><button class="btn btn-secondary btn-sm" data-view="${p.id}">View</button><button class="btn btn-danger btn-sm" data-del="${p.id}">Delete</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="admin-cards-mobile">${projects.map(p=>`<div class="admin-mobile-card"><div class="amc-row"><b>${escapeHtml(p.name)}</b><span>${p.isFree?'Free':formatPrice(p.price)}</span></div><div class="amc-row"><span>${escapeHtml(p.category)}</span><span>${(p.downloadCount||0)} dl</span></div><div class="row-actions" style="margin-top:8px;"><a class="btn btn-primary btn-sm" href="#/admin/edit/${p.id}">Edit</a><button class="btn btn-secondary btn-sm" data-view="${p.id}">View</button><button class="btn btn-danger btn-sm" data-del="${p.id}">Delete</button></div></div>`).join('')}</div>`
      : emptyStateHtml('No projects yet', 'Upload your first project to see it here.')}
    </div></div>`;
  refreshIcons();
  qsa('[data-view]', content).forEach(b=> b.onclick = ()=>{ const p=DataStore.getLocalProjectById(b.dataset.view); if(p) window.open('#/project/'+p.slug,'_blank'); });
  qsa('[data-del]', content).forEach(b=> b.onclick = ()=>{
    const p = DataStore.getLocalProjectById(b.dataset.del);
    confirmDialog(`Delete "${p.name}"? This removes it from the site (the file stays in your Google Drive).`, ()=>{
      DataStore.deleteProject(p.id); toast('Project deleted.', 'success'); renderAdminTab('projects');
    }, 'Delete');
  });
}

function renderAdminAddProject(content, editId){
  const cats = DataStore.rawCategories();
  const editing = editId ? DataStore.getLocalProjectById(editId) : null;
  if(editId && !editing){
    content.innerHTML = `<div class="admin-topline"><h2>Edit project</h2></div>` + emptyStateHtml('Project not found', 'It may have been deleted already.');
    return;
  }
  const v = editing || {};
  const sel = (c)=> (v.category===c ? ' selected' : '');

  content.innerHTML = `
    <div class="admin-topline"><h2>${editing ? 'Edit project' : 'Upload a new project'}</h2>${editing ? '<a href="#/admin/projects" class="btn btn-ghost btn-sm">Back to projects</a>' : ''}</div>
    <div class="info-banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M12 2 2 20h20Z"/></svg> ${editing ? 'Change anything you like. Leave the file box empty to keep the current file, or pick a new one to replace it.' : 'The file uploads straight to your own Google Drive (into a folder named after the category). This website only remembers the download link.'} After saving, go to <b>Publish to site</b> so visitors can see it.</div>
    <div class="admin-panel"><div class="admin-panel-body">
      <div class="form-row">
        <div class="form-group"><label for="ap-name">Project name</label><input class="form-control" id="ap-name" placeholder="e.g. Portfolio Website" value="${escapeHtml(v.name||'')}"></div>
        <div class="form-group"><label for="ap-category">Category</label>
          <select class="form-control" id="ap-category">${cats.map(c=>`<option value="${escapeHtml(c)}"${sel(c)}>${escapeHtml(c)}</option>`).join('')}<option value="__new__">+ New category…</option></select>
        </div>
      </div>
      <div class="form-group" id="ap-new-cat-wrap" style="display:none;"><label for="ap-new-cat">New category name</label><input class="form-control" id="ap-new-cat" placeholder="e.g. WordPress Themes"></div>
      <div class="form-group"><label for="ap-short">Short description</label><input class="form-control" id="ap-short" placeholder="One line shown on the project card" value="${escapeHtml(v.shortDesc||'')}"></div>
      <div class="form-group">
        <div class="md-editor-top">
          <label for="ap-full" style="margin:0;">Full description <span class="optional-tag">supports formatting</span></label>
          <div class="md-tabs">
            <button type="button" id="ap-tab-write" class="active">Write</button>
            <button type="button" id="ap-tab-preview">Preview</button>
            <button type="button" id="ap-template" title="Insert a ready-made professional layout">Use template</button>
          </div>
        </div>
        <textarea class="form-control md-editor" id="ap-full" placeholder="## About this project&#10;Explain what it does…&#10;&#10;## Key features&#10;- **Fast** — loads instantly&#10;- **Simple** — easy to use">${escapeHtml(v.fullDesc||'')}</textarea>
        <div class="md-body md-preview hidden" id="ap-full-preview"></div>
        <div class="md-hint"><code># Heading</code> <code>## Subheading</code> <code>**bold**</code> <code>*italic*</code> <code>- list item</code> <code>1. numbered</code> <code>[text](https://link)</code> <code>&gt; note</code> <code>---</code></div>
      </div>
      <div class="form-group"><label for="ap-features">What's included <span class="optional-tag">optional — one line per feature</span></label><textarea class="form-control" id="ap-features" placeholder="Full source code&#10;Setup instructions&#10;Free updates">${escapeHtml((v.features||[]).join('\n'))}</textarea></div>

      <div class="form-group">
        <label>Preview image / screenshot <span class="optional-tag">optional — a nice mock-up is generated if you skip it</span></label>
        <div class="image-picker">
          <div class="dropzone" id="ap-img-dropzone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5h18v14H3z"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="8.5" cy="9.5" r="1.5"/></svg>
            <div id="ap-img-label">Click to choose an image (PNG / JPG), or drag it here</div>
          </div>
          <input type="file" id="ap-img-input" class="hidden" accept="image/*">
          <div class="image-preview${v.image?' show':''}" id="ap-img-preview">
            <img id="ap-img-preview-el" src="${v.image||''}" alt="Preview">
            <button type="button" id="ap-img-remove" title="Remove image">×</button>
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group"><label for="ap-tech">Technology</label><input class="form-control" id="ap-tech" placeholder="e.g. React, Node.js" value="${escapeHtml(v.technology||'')}"></div>
        <div class="form-group"><label for="ap-version">Version</label><input class="form-control" id="ap-version" value="${escapeHtml(v.version||'1.0.0')}"></div>
      </div>
      <div class="form-group"><label for="ap-requirements">Requirements</label><input class="form-control" id="ap-requirements" placeholder="e.g. Android 7+, PHP 8" value="${escapeHtml(v.requirements||'')}"></div>
      <div class="toggle-row"><div><b>This is a mobile/desktop app</b><div style="font-size:.78rem;color:var(--text-muted);">Shows an Install-style button instead of a plain Download button</div></div><button type="button" class="switch${v.type==='app'?' on':''}" id="ap-is-app"><span class="knob"></span></button></div>
      <div class="toggle-row"><div><b>Free project</b><div style="font-size:.78rem;color:var(--text-muted);">Off = premium (shows a Contact to Buy button instead of Download)</div></div><button type="button" class="switch${(editing && !v.isFree)?'':' on'}" id="ap-is-free"><span class="knob"></span></button></div>
      <div class="form-group${(editing && !v.isFree)?'':' hidden'}" id="ap-price-wrap"><label for="ap-price">Price (PKR)</label><input class="form-control" id="ap-price" type="number" min="0" placeholder="e.g. 2500" value="${v.price||''}"></div>

      <div class="form-group">
        <label>Project file (.zip, .rar or .apk)${editing?' <span class="optional-tag">optional — only if you want to replace the current file</span>':''}</label>
        <div class="dropzone" id="ap-dropzone">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
          <div id="ap-file-label">${editing ? 'Current file: '+escapeHtml(v.fileSize||'—')+' — click to replace' : 'Click to choose a file, or drag it here'}</div>
        </div>
        <input type="file" id="ap-file-input" class="hidden" accept=".zip,.rar,.apk,.7z">
        <div class="upload-progress-track hidden" id="ap-progress-track"><div class="upload-progress-fill" id="ap-progress-fill"></div></div>
        <div id="ap-progress-text" style="font-size:.78rem;color:var(--text-muted);margin-top:6px;"></div>
      </div>

      <button class="btn btn-secondary" id="ap-connect-drive" type="button" style="margin-bottom:14px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        ${DriveAPI.isConnected() ? 'Google Drive connected ✓' : 'Connect Google Drive'}
      </button>
      <div class="btn-row">
        <button class="btn btn-primary" id="ap-submit" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg> ${editing ? 'Save changes' : 'Upload & save'}</button>
        ${editing ? `<button class="btn btn-danger" id="ap-delete" type="button">Delete project</button>` : ''}
      </div>
    </div></div>`;
  refreshIcons();

  /* ---- description editor: Write / Preview / Template ---- */
  const fullBox = qs('#ap-full'), fullPrev = qs('#ap-full-preview');
  const tabWrite = qs('#ap-tab-write'), tabPrev = qs('#ap-tab-preview');
  function showDescTab(preview){
    tabWrite.classList.toggle('active', !preview); tabPrev.classList.toggle('active', preview);
    fullBox.classList.toggle('hidden', preview); fullPrev.classList.toggle('hidden', !preview);
    if(preview){
      const html = renderMarkdown(fullBox.value, { skipLeadingH1: qs('#ap-name').value.trim() });
      fullPrev.innerHTML = html || '<p style="color:var(--text-muted)">Nothing to preview yet.</p>';
    }
  }
  tabWrite.onclick = ()=> showDescTab(false);
  tabPrev.onclick = ()=> showDescTab(true);
  qs('#ap-template').onclick = ()=>{
    const apply = ()=>{ fullBox.value = DESCRIPTION_TEMPLATE; showDescTab(false); fullBox.focus(); };
    if(fullBox.value.trim()) confirmDialog('Replace the current description with the ready-made template?', apply, 'Replace');
    else apply();
  };

  const catSelect = qs('#ap-category');
  catSelect.onchange = ()=> qs('#ap-new-cat-wrap').style.display = catSelect.value==='__new__' ? 'flex' : 'none';

  const isAppSwitch = qs('#ap-is-app'); isAppSwitch.onclick = ()=> isAppSwitch.classList.toggle('on');
  const isFreeSwitch = qs('#ap-is-free'); isFreeSwitch.onclick = ()=>{ isFreeSwitch.classList.toggle('on'); qs('#ap-price-wrap').classList.toggle('hidden', isFreeSwitch.classList.contains('on')); };

  /* ---- project file ---- */
  let selectedFile = null;
  const dz = qs('#ap-dropzone'); const fileInput = qs('#ap-file-input');
  const setFile = (f)=>{ selectedFile = f; qs('#ap-file-label').textContent = f.name+' ('+(f.size/1048576).toFixed(1)+' MB)'; };
  dz.onclick = ()=> fileInput.click();
  fileInput.onchange = ()=>{ if(fileInput.files[0]) setFile(fileInput.files[0]); };
  ['dragover','dragleave','drop'].forEach(evt=> dz.addEventListener(evt, e=>{ e.preventDefault(); dz.classList.toggle('drag', evt==='dragover'); }));
  dz.addEventListener('drop', e=>{ if(e.dataTransfer.files[0]){ fileInput.files = e.dataTransfer.files; setFile(e.dataTransfer.files[0]); } });

  /* ---- optional preview image ---- */
  let imageData = v.image || '';
  const imgDz = qs('#ap-img-dropzone'); const imgInput = qs('#ap-img-input');
  const imgPreview = qs('#ap-img-preview'); const imgEl = qs('#ap-img-preview-el');
  async function useImage(file){
    try{
      qs('#ap-img-label').textContent = 'Processing image…';
      imageData = await compressImage(file);
      imgEl.src = imageData; imgPreview.classList.add('show');
      const kb = Math.round(imageData.length*0.75/1024);
      qs('#ap-img-label').textContent = file.name+' — added ('+kb+' KB after compression)';
    }catch(err){ toast(err.message, 'error'); qs('#ap-img-label').textContent = 'Click to choose an image (PNG / JPG), or drag it here'; }
  }
  imgDz.onclick = ()=> imgInput.click();
  imgInput.onchange = ()=>{ if(imgInput.files[0]) useImage(imgInput.files[0]); };
  ['dragover','dragleave','drop'].forEach(evt=> imgDz.addEventListener(evt, e=>{ e.preventDefault(); imgDz.classList.toggle('drag', evt==='dragover'); }));
  imgDz.addEventListener('drop', e=>{ if(e.dataTransfer.files[0]) useImage(e.dataTransfer.files[0]); });
  qs('#ap-img-remove').onclick = ()=>{
    imageData = ''; imgEl.src=''; imgPreview.classList.remove('show');
    qs('#ap-img-label').textContent = 'Click to choose an image (PNG / JPG), or drag it here';
    toast('Image removed — an auto preview will be used.', 'info');
  };

  qs('#ap-connect-drive').onclick = async (e)=>{
    const btn = e.currentTarget; btn.disabled=true; btn.innerHTML='<span class="spinner dark-sp"></span> Connecting…';
    try{ await DriveAPI.connect(); toast('Google Drive connected.', 'success'); btn.innerHTML='Google Drive connected ✓'; }
    catch(err){ toast(err.message, 'error'); btn.innerHTML='Connect Google Drive'; }
    btn.disabled=false;
  };

  if(editing){
    qs('#ap-delete').onclick = ()=> confirmDialog(`Delete "${editing.name}"? The file stays in your Google Drive.`, ()=>{
      DataStore.deleteProject(editing.id); toast('Project deleted — remember to publish.', 'success'); location.hash = '#/admin/projects';
    }, 'Delete');
  }

  qs('#ap-submit').onclick = async ()=>{
    const name = qs('#ap-name').value.trim();
    let category = catSelect.value;
    const newCat = qs('#ap-new-cat').value.trim();
    if(category==='__new__'){ if(!newCat){ toast('Enter a name for the new category.', 'error'); return; } category = newCat; }
    if(!name){ toast('Enter a project name.', 'error'); return; }
    if(!editing && !selectedFile){ toast('Choose a file to upload.', 'error'); return; }

    const isApp = isAppSwitch.classList.contains('on');
    const isFree = isFreeSwitch.classList.contains('on');
    const price = isFree ? 0 : Number(qs('#ap-price').value||0);
    const features = qs('#ap-features').value.split('\n').map(s=>s.trim()).filter(Boolean);

    const submitBtn = qs('#ap-submit'); const originalLabel = submitBtn.innerHTML;
    submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner"></span> Working…';
    const progressTrack = qs('#ap-progress-track'); const progressFill = qs('#ap-progress-fill'); const progressText = qs('#ap-progress-text');

    try{
      if(!DataStore.rawCategories().includes(category)){
        const cats2 = DataStore.rawCategories(); cats2.push(category); DataStore.saveCategories(cats2);
      }

      let downloadUrl = v.downloadUrl || '';
      let driveFileId = v.driveFileId || '';
      let fileSize = v.fileSize || '—';

      if(selectedFile){
        progressTrack.classList.remove('hidden');
        progressText.textContent = 'Connecting to Google Drive…';
        await DriveAPI.ensureToken();
        progressText.textContent = 'Preparing category folder…';
        const folderId = await DriveAPI.ensureCategoryFolder(category);
        progressText.textContent = 'Uploading file…';
        const uploaded = await DriveAPI.uploadFile(selectedFile, folderId, (pct)=>{ progressFill.style.width = pct+'%'; progressText.textContent = 'Uploading… '+pct+'%'; });
        progressText.textContent = 'Finalizing download link…';
        downloadUrl = await DriveAPI.makePublic(uploaded.id);
        if(editing && driveFileId && driveFileId!==uploaded.id) await DriveAPI.deleteFile(driveFileId);
        driveFileId = uploaded.id;
        fileSize = (selectedFile.size/1048576).toFixed(1)+' MB';
      }

      const project = {
        id: editing ? editing.id : uid(),
        slug: editing ? editing.slug : slugify(name)+'-'+Date.now().toString(36).slice(-4),
        name, category,
        shortDesc: qs('#ap-short').value.trim(), fullDesc: qs('#ap-full').value.trim(),
        technology: qs('#ap-tech').value.trim(), version: qs('#ap-version').value.trim()||'1.0.0',
        requirements: qs('#ap-requirements').value.trim(), features,
        image: imageData,
        isFree, price, type: isApp?'app':'website',
        fileSize, driveFileId, downloadUrl,
        createdAt: editing ? (editing.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        downloadCount: editing ? (editing.downloadCount||0) : 0
      };
      DataStore.saveProject(project);
      toast(editing ? 'Changes saved — now publish to make them live.' : 'Project saved — now publish to make it live.', 'success');
      location.hash = '#/admin/publish';
    }catch(err){
      toast(err.message || 'Something went wrong.', 'error');
      submitBtn.disabled=false; submitBtn.innerHTML = originalLabel;
    }
  };
}

/* =========================================================================
   PUBLISH TO SITE  —  turns the local draft into projects.json
========================================================================= */
function renderAdminPublish(content){
  const localCount = DataStore.rawProjects().length;
  const liveCount = LiveData.loaded ? LiveData.projects.length : 0;
  const dirty = DataStore.hasUnpublishedChanges();
  const s = DataStore.rawSettings();

  content.innerHTML = `
    <div class="admin-topline"><h2>Publish to site</h2></div>
    <div class="info-banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4m0 4h.01M12 2 2 20h20Z"/></svg>
      Everything you upload is saved in this browser first. Visitors can only see what is inside <code>projects.json</code> on the server — so after every change, download the file here and upload it to your GitHub repository.</div>

    <div class="admin-panel"><div class="admin-panel-header"><h3>Status</h3></div>
      <div class="admin-panel-body">
        <div class="status-row">
          <span class="provider-chip"><span class="dot ${LiveData.loaded?'active':'inactive'}"></span>${LiveData.loaded ? 'Live file found — '+liveCount+' project'+(liveCount===1?'':'s')+' public' : 'No projects.json on the server yet'}</span>
          <span class="provider-chip"><span class="dot ${dirty?'inactive':'active'}"></span>${dirty ? 'You have unpublished changes' : 'Draft matches the live file'}</span>
        </div>
        <p style="font-size:.85rem;color:var(--text-muted);line-height:1.6;">Local draft: <b>${localCount}</b> project${localCount===1?'':'s'}${LiveData.loaded && LiveData.generatedAt ? ` · Live file published on <b>${formatDate(LiveData.generatedAt)}</b>` : ''}${LiveData.error ? ` · <span style="color:var(--danger)">${escapeHtml(LiveData.error)}</span>` : ''}</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="pub-download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v13m0 0 4-4m-4 4-4-4M4 20h16"/></svg> Download projects.json</button>
          <button class="btn btn-secondary" id="pub-copy">Copy JSON</button>
          <button class="btn btn-ghost" id="pub-pull">Load live file into draft</button>
        </div>
      </div>
    </div>

    <div class="admin-panel"><div class="admin-panel-header"><h3>How to publish (one minute)</h3></div>
      <div class="admin-panel-body">
        <ol class="publish-steps">
          <li>Click <b>Download projects.json</b> above.</li>
          <li>Open your repository: <code>github.com/mrjbsa/themrjbworld</code>.</li>
          <li>Click <b>Add file → Upload files</b> and drop <code>projects.json</code> in (same folder as <code>index.html</code>). If it already exists, GitHub replaces it.</li>
          <li>Click <b>Commit changes</b>, wait about a minute for GitHub Pages to rebuild.</li>
          <li>Open <a href="${escapeHtml(s.siteUrl||'https://mrjbsa.github.io/themrjbworld/')}" target="_blank" rel="noopener" style="text-decoration:underline;">your site</a> in a private window — the projects are now visible to everyone.</li>
        </ol>
      </div>
    </div>

    <div class="admin-panel"><div class="admin-panel-header"><h3>File preview</h3></div>
      <div class="admin-panel-body">
        <textarea class="json-box" id="pub-json" readonly spellcheck="false"></textarea>
      </div>
    </div>`;
  refreshIcons();

  const json = DataStore.buildPublishJson();
  qs('#pub-json').value = json;
  qs('#pub-download').onclick = ()=>{ downloadTextFile('projects.json', json); toast('projects.json downloaded — upload it to GitHub now.', 'success'); };
  qs('#pub-copy').onclick = async ()=>{
    try{ await navigator.clipboard.writeText(json); toast('JSON copied to clipboard.', 'success'); }
    catch(e){ const box = qs('#pub-json'); box.select(); document.execCommand('copy'); toast('JSON copied.', 'success'); }
  };
  qs('#pub-pull').onclick = ()=>{
    if(!LiveData.loaded){ toast('No live projects.json to load yet.', 'error'); return; }
    confirmDialog('Replace your local draft with the published file? Any unpublished change will be lost.', ()=>{
      DataStore.pullFromLive(); toast('Draft synced with the live file.', 'success'); renderAdminTab('publish');
    }, 'Replace draft');
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

function renderAdminDownloads(content){
  const sorted = [...DataStore.rawProjects()].sort((a,b)=>(b.downloadCount||0)-(a.downloadCount||0));
  content.innerHTML = `<div class="admin-topline"><h2>Downloads</h2></div>
    <div class="admin-panel"><div class="admin-panel-body">
      ${sorted.length ? `<div class="responsive-table"><table class="admin-table"><thead><tr><th>Project</th><th>Type</th><th>Downloads</th></tr></thead><tbody>
        ${sorted.map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${p.isFree?'Free':'Paid'}</td><td><b>${(p.downloadCount||0).toLocaleString()}</b></td></tr>`).join('')}
      </tbody></table></div>` : emptyStateHtml('No data yet', 'Download counts will show up here once projects are live.')}
    </div></div>`;
}

function renderAdminSettings(content){
  const settings = DataStore.rawSettings();
  content.innerHTML = `
    <div class="admin-topline"><h2>Settings</h2></div>
    <div class="admin-panel"><div class="admin-panel-header"><h3>Site details</h3></div>
      <div class="admin-panel-body">
        <div class="settings-grid">
          <div class="form-group"><label for="s-name">Website name</label><input class="form-control" id="s-name" value="${escapeHtml(settings.siteName)}"></div>
          <div class="form-group"><label for="s-email">Contact email</label><input class="form-control" id="s-email" value="${escapeHtml(settings.contactEmail)}"></div>
          <div class="form-group"><label for="s-youtube">YouTube channel URL</label><input class="form-control" id="s-youtube" value="${escapeHtml(settings.youtubeUrl)}"></div>
          <div class="form-group"><label for="s-siteurl">Live website URL</label><input class="form-control" id="s-siteurl" value="${escapeHtml(settings.siteUrl||'')}"></div>
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
    s.siteUrl = qs('#s-siteurl').value.trim()||s.siteUrl;
    DataStore.saveSettings(s); toast('Saved — publish again so visitors get the new details.', 'success'); applyBrandingLinks();
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
const PAGE_IDS = ['home','projects','categories','project-detail','about','contact','legal','admin-login','admin'];
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
  else if(parts[0]==='project' && parts[1]){ showPage('project-detail'); renderProjectDetail(parts[1]); }
  else if(parts[0]==='about'){ showPage('about'); document.title='About — '+DataStore.getSettings().siteName; renderAboutStats(); }
  else if(parts[0]==='contact'){ showPage('contact'); document.title='Contact — '+DataStore.getSettings().siteName; initContactPage(); }
  else if(parts[0]==='legal'){ showPage('legal'); renderLegalPage(parts[1]||'privacy'); }
  else if(parts[0]==='admin-login'){ showPage('admin-login'); document.title='Admin — '+DataStore.getSettings().siteName; renderAdminLoginPage(); }
  else if(parts[0]==='admin'){
    if(!AuthService.isLoggedIn()){ location.hash='#/admin-login'; return; }
    showPage('admin'); adminState.tab = parts[1]||'overview'; adminState.arg = parts[2]||null; renderAdminDashboard();
  }
  else { showPage('home'); renderHome(); }
  applyBrandingLinks();
}
window.addEventListener('hashchange', router);

let booted = false;
async function boot(){
  if(booted) return; booted = true;
  const yearEl = qs('#footer-year'); if(yearEl) yearEl.textContent = new Date().getFullYear();

  await loadLiveData();

  if(LiveData.loaded){
    // First time this browser opens the admin: start the draft from the live file.
    if(DataStore.rawProjects().length === 0 && LiveData.projects.length) {
      localStorage.setItem(DB.PROJECTS, JSON.stringify(LiveData.projects));
    }
    // Keep every category that exists either live or locally.
    const merged = Array.from(new Set(LiveData.categories.concat(DataStore.rawCategories())));
    DataStore.saveCategories(merged);
  }

  refreshIcons();
  router();
}

if(document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
else boot();

})();