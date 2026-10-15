# The Mr JB World

Ready-to-use websites aur apps ka marketplace. Free projects seedha download hote hain, premium projects email se milte hain.

Live: https://mrjbsa.github.io/themrjbworld/ aur https://themrjbworld.vercel.app/

---

## Is folder mein kya hai

| File | Kaam |
|---|---|
| `index.html`, `style.css`, `script.js` | Public website |
| `sw.js`, `manifest.json`, `icon-*.png`, `favicon-32.png`, `apple-touch-icon.png` | PWA (app banane ke liye) |
| `video-manager.html` | Sirf aapka tool: YouTube links add/edit karne ke liye |
| `CLAUDE.md` | Claude ke liye project ke rules aur context |

Public site sirf **dikhati hai**. Projects upload karne ka kaam aapki alag admin website se hota hai. Data Google Drive ki ek shared JSON file se aata hai.

---

## Naya feature: YouTube videos

1. **Home page par "Watch on YouTube"** section (Latest projects ke neeche): videos ki thumbnails ek 3D gol ring mein ghoomti hain. Kisi par click karein to seedha YouTube khulta hai aur video chalti hai. Hover karne par ring ruk jati hai, left/right buttons se bhi ghuma sakte hain.
2. **Projects aur live websites ke cards par "Watch now"** button, sirf un par jinke saamne aap ne video link lagayi ho.
3. **Detail page par** thumbnail ke sath play button, click karne par YouTube par video chalti hai.

Jin projects/websites mein video link nahi, unmein koi tabdeeli nahi. Purane uploads bilkul waise hi rahte hain.

---

## Pehli dafa setup (sirf ek baar)

**1. Files upload karein** (GitHub aur Vercel dono par, `index.html` ke bilkul sath, root mein):
`index.html`, `script.js`, `style.css`, `sw.js`. Baaki `manifest.json` aur icons pehle se maujood hain.

**2. `video-manager.html` rakhein.** Isay apni admin website ke sath rakh dein (ya kisi bhi jagah). Is page ka address Google Cloud Console mein add hona chahiye:
Credentials → aapka OAuth Client ID → **Authorized JavaScript origins** → page ka origin, jaise `https://aapki-admin-site.vercel.app`.

**3. Tool kholein aur connect karein.**
- "Connect Google" dabayein aur `mrjbsa.313@gmail.com` se login karein. Drive ki ijazat wala checkbox tick karein.
- Agar Client ID alag hai to "Settings" mein sahi Client ID daalein (wahi jo admin panel ki Settings mein hai).

**4. Links daalein** (neeche "Roz ka kaam" dekhein) aur **Save** dabayein.

**5. File ID site mein daalein.** Pehli save ke baad tool ek **File ID** dikhata hai. Isay `script.js` mein is line mein paste karein:
```js
const VIDEOS_FILE_ID = 'yahan-ID-paste-karein';
```
Phir `script.js` dobara upload karein. Cache ke liye `index.html` aur `sw.js` mein `?v=12` ko `?v=13` kar dein (ya sirf mujhe ID bhej dein, main files tayyar kar ke de dunga).

Yeh sirf pehli dafa karna hai. Uske baad jo bhi links tool se badlenge, site par khud nazar aayengi.

---

## Roz ka kaam

`video-manager.html` kholein → Connect Google → ye 4 hisse milte hain:

1. **YouTube channel**: "Visit channel" button ka link.
2. **Home page videos (ring)**: 5 recommended, zyada se zyada 8. Har video ka link daalein, title optional hai. ↑ ↓ se tarteeb badal sakte hain.
3. **Projects ki videos**: har project ke saamne video link. Khali chhorenge to kuch nahi dikhega.
4. **Live websites ki videos**: same.

Phir **"Google Drive mein save karein"**. Site par 1-2 minute baad `Ctrl+Shift+R` karein.

Chalne wale links: `https://youtu.be/...`, `https://www.youtube.com/watch?v=...`, `https://www.youtube.com/shorts/...`.
Channel ka link (`@themrjbworld`) ring ke liye nahi, sirf "Visit channel" button ke liye hai, kyunke channel link se videos khud nahi nikal sakte.

---

## Deploy checklist (har update par)

- [ ] `?v=` ka number `index.html` (style aur script) aur `sw.js` mein badla hua ho.
- [ ] Sab files root mein hon, koi sub-folder nahi.
- [ ] Google API key ke referrers mein dono domains hon: `https://mrjbsa.github.io/*` aur `https://themrjbworld.vercel.app/*`.
- [ ] Site kholkar `Ctrl+Shift+R` karein.

---

## Masail aur hal

| Masla | Wajah / hal |
|---|---|
| Home par "Watch on YouTube" section nazar nahi aata | `VIDEOS_FILE_ID` abhi khali hai, ya tool se koi video save nahi hui. Ek-do minute baad hard refresh karein. |
| Sirf ek domain par videos aati hain | API key ke referrers mein doosra domain add karein. |
| Thumbnail ki jagah sirf play icon | Link YouTube video ka nahi (channel/playlist ka hai). Video ka seedha link lagayein. |
| Tool mein "origin_mismatch" | Is page ka origin Google Cloud Console ke Authorized JavaScript origins mein add karein. |
| Tool mein "Yeh Google account allowed nahi" | Sirf `mrjbsa.313@gmail.com` se connect ho sakta hai. |
| Tool mein "Videos file load nahi hui" | Settings mein sahi Videos file ID daalein. Save is liye band rakhi jati hai ke purani links overwrite na hon. |
| Phone par purani site dikh rahi hai | `?v=` number badlein aur `sw.js` bhi upload karein. |

---

## Technical notes (short)

- Videos ka data admin ke main database mein nahi, alag file `mjbw_videos.json` mein hai, taake admin ki save usay mita na sake.
- Format aur baaki rules `CLAUDE.md` mein hain.
- Site mein koi build step nahi, files seedhi upload hoti hain.
