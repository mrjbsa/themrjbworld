# The Mr JB World

Ready-to-use websites aur apps ka marketplace. Free projects seedha download hote hain, premium projects email se milte hain.

Live: https://mrjbsa.github.io/themrjbworld/ aur https://themrjbworld.vercel.app/

---

## Teen hisse (files)

| Folder | Kaam |
|---|---|
| **PUBLIC zip** | Sab ko nazar aane wali site. Sirf dikhati hai, kuch edit nahi karti. |
| **ADMIN zip** | Sirf aapki admin website: projects, slider, live websites, videos aur ginti dekhna. |
| **`counter-backend.gs`** (alag file) | Visits aur downloads ginne wala chhota Google Apps Script (neeche setup hai). |

Public: `index.html`, `style.css`, `script.js`, `sw.js`, `manifest.json`, icons, `videos.json` (optional).
Admin: `index.html`, `style.css`, `script.js`, `robots.txt`.

Dono ek hi Google Drive database se baat karte hain: admin likhta hai, public padhta hai.

---

## YouTube videos: kya dikhta hai

1. **Home page par "Watch on YouTube"** (Latest projects ke neeche): videos ki thumbnails ek 3D gol ring mein ghoomti hain. Click karein to seedha YouTube khulta hai aur video chalti hai. Hover par ring ruk jati hai, left/right buttons se bhi ghuma sakte hain.
2. **Project aur live website ke card par "Watch now"** button (sirf unpar jinki video lagayi ho).
3. **Detail page par** thumbnail ke sath play button; click karne par YouTube par video chalti hai.

Jin projects/websites mein video link nahi, unmein koi tabdeeli nahi. Purane uploads waise hi rahte hain.

---

## Admin mein video links kaise add karein

Admin kholein (logo par 5 click ya seedha admin address) aur login karein. Google Drive **connect** rakhein, warna save sirf aapke browser mein rehti hai aur site par nahi dikhti. Save dabane par agar Drive connect nahi to khud Google ka popup aa jata hai.

**Home page ki ring ki videos:** left menu mein **Videos** tab.
- "+ Video add karein", YouTube link paste karein (title optional), 5 recommended, zyada se zyada 8.
- ↑ ↓ se tarteeb badlein, "Hatayen" se nikalein.
- Upar "YouTube channel" link bhi bhar sakte hain ("Visit channel" button ke liye).
- **Save** dabayein.

**Kisi purane project (app/website) ki video:** **Projects** tab mein us project ke saamne **Video** button. Link paste karein, Save. Link lagne ke baad button "Video ✓" ho jata hai. Link khali karke save karein to video hat jati hai. Project ka baaki data (file, images, downloads) nahi chhedta.

**Naya project upload karte waqt:** **Upload project** form mein "Video link (YouTube, optional)" field.

**Live website ki video:** **Live Websites** tab, Edit dabayein, "Video link" field bharein, Save.

Save ke 1-2 minute baad site par `Ctrl+Shift+R` karein.

Chalne wale links: `https://youtu.be/...`, `https://www.youtube.com/watch?v=...`, `https://www.youtube.com/shorts/...`.
Channel ka link (`@themrjbworld`) sirf "Visit channel" button ke liye hai. Channel se videos khud nahi nikalti, har video ka link daalna hota hai.

---

## Visitors aur downloads ki ginti (admin mein)

Pehle downloads sirf us visitor ke apne browser mein gin jate the, aur visits ki ginti thi hi nahi, is liye admin ko kuch sahi nazar nahi aata tha. Ab ek chhota Google Apps Script sab visitors ki ginti ek jagah jama karta hai.

**Admin mein kya dikhta hai** (Overview aur Downloads tab, "Visitors & downloads" panel): total visits, unique visitors, aaj ki visits, pichle 7 din ki visits, total downloads, aaj ke downloads, aur pichle 30 din ka graph. Projects aur Downloads tab mein har project ke asli downloads. Public site ke cards aur detail page par bhi wahi asli downloads nazar aate hain.

**Kaise ginti hoti hai:**
- **Visit** = ek browser session. Refresh karne par dobara nahi ginti. Ek hi banda 30 minute ke andar dobara aaye to bhi ek hi.
- **Unique visitor** = naya browser jo pehli dafa aaya.
- **Download** = Download ya Install par click. Ek hi banda ek hi project par 5 minute ke andar baar baar dabaye to ek hi ginta hai.
- Bots (Google, headless browsers) nahi ginte.
- **Aap ki apni visits na ginein:** har browser mein public site ko ek dafa `...?nostats=1` ke sath kholein (wapis ginwane ke liye `?nostats=0`).

**Setup (sirf ek baar, 3 minute):**
1. https://script.google.com kholein, **New project** banayein. Purana code mita kar `counter-backend.gs` ka poora code paste karein, Save.
2. **Deploy → New deployment →** gear icon **→ Web app**. "Execute as: **Me**", "Who has access: **Anyone**". Deploy dabayein aur ijazat dein. Agar Google "unverified app" kahe: Advanced → Go to (project ka naam) → Allow.
3. Jo **Web app URL** milega (aakhir mein `/exec`), usay **dono** `script.js` mein `STATS_URL` ke saamne paste karein (public wali aur admin wali):
   ```js
   const STATS_URL = 'https://script.google.com/macros/s/....../exec';
   ```
4. Browser mein `<wo URL>?action=stats` kholkar dekhein, `{"ok":true,...}` aana chahiye.
5. Dono sites upload karein (`?v=` number badla hua), `Ctrl+Shift+R`.

Jab tak `STATS_URL` khali hai, site pehle jaisi chalti hai aur admin mein setup ka paigham nazar aata hai.

**Yaad rakhein:**
- Pehli ginti us din se shuru hogi jab setup ho. Purane downloads ke numbers (jo database mein hain) tab tak dikhte rahenge jab tak kisi project ka naya asli count nahi aata.
- Agar baad mein `counter-backend.gs` ka code badlein to Deploy → Manage deployments → edit → **New version** karna zaroori hai, warna purana code chalta rahta hai.
- Yeh ginti andaza hai, bilkul secure nahi: jis ke paas URL ho wo ginti badha sakta hai.

---

## Upload / deploy

**Public site** (GitHub aur Vercel dono): PUBLIC zip ki saari files replace karein (`index.html`, `script.js`, `style.css`, `sw.js`, `videos.json`; `manifest.json` aur icons pehle jaise).
**Admin site**: ADMIN zip ki `index.html`, `script.js`, `style.css` replace karein.

Phir dono par `Ctrl+Shift+R`. Phone par purani site dikhe to browser ka cache clear karein.

**Pehle dekhna ho feature kaisa lagta hai** (videos lagane se pehle): public site ke address ke aakhir mein `?videodemo=1` laga kar kholein, jaise `https://mrjbsa.github.io/themrjbworld/?videodemo=1`. Sample ring aur buttons sirf aap ki screen par nazar aayenge.

---

## Backup tareeqe (zaroorat nahi, sirf agar admin istemal na karna ho)

- **`videos.json`** (public site ke folder mein): GitHub par kholkar links paste karein. Format:
  ```json
  { "channelUrl": "https://www.youtube.com/@themrjbworld",
    "videos": [ { "url": "https://youtu.be/ID", "title": "Pehli video" } ],
    "projectVideos": { "Qaza Namaz Tracker": "https://youtu.be/ID" },
    "siteVideos": { "Mister JB School Manager": "https://youtu.be/ID" } }
  ```
  Admin ki Videos tab mein agar kuch save ho to wo isse pehle istemal hoti hai.

---

## Masail aur hal

| Masla | Wajah / hal |
|---|---|
| Admin mein save kiya lekin site par nazar nahi aata | Drive connect nahi tha. Admin mein Connect Google Drive karke dobara Save dabayein. 1-2 minute baad `Ctrl+Shift+R`. |
| Sirf ek domain par videos aati hain | Google API key ke referrers mein doosra domain add karein. |
| Thumbnail ki jagah sirf play icon | Link YouTube video ka nahi (channel ya playlist ka hai). Video ka seedha link lagayein. |
| Phone par purani site dikh rahi hai | `?v=` number badlein (`index.html` aur `sw.js` dono mein) aur dobara upload karein. |
| URL kholne par "Script function not found: doGet" aata hai | Deploy mein counter ka code nahi hai. Code paste karke Save karein, phir Deploy → Manage deployments → edit (pencil) → Version: **New version** → Deploy. URL wahi rehta hai. |
| Admin mein ginti nahi aa rahi | `STATS_URL` dono `script.js` mein daalein, Apps Script "Anyone" access ke sath deploy ho, aur `?action=stats` wala test chale. |
| Home par "Watch on YouTube" section nazar nahi aata | Videos tab mein koi video save nahi hui, ya abhi Drive tak nahi pahunchi. |

---

## Technical notes (short)

- Admin ki Videos tab ka data main database file mein `videoConfig` ke naam se jata hai, aur project/live website ka link unke apne `videoUrl` field mein.
- Format, rules aur baaki tafseel `CLAUDE.md` mein hain.
- Dono sites mein koi build step nahi, files seedhi upload hoti hain.
