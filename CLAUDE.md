# CLAUDE.md — The Mr JB World (public site)

Context and rules for any Claude session working on this repo. Read this before editing anything.

## Who / how to talk
- Owner: **Mr JB**. Contact email on the site: `mrjbsa.official@outlook.com`.
- The owner writes in **Roman Urdu**. Reply in Roman Urdu (technical terms stay in English). Keep answers short and practical.
- The owner tests on the live site and sends screenshots. Verify changes yourself before saying they work.

## What this is
A one-person marketplace for ready-to-use websites and apps. **Static HTML + CSS + vanilla JS, no build step.**
- Hash routing: `#/home`, `#/projects`, `#/project/<slug>`, `#/categories`, `#/live-sites`, `#/live/<id>`, `#/about`, `#/contact`, `#/legal/<slug>`.
- Hosted as the **same files** on GitHub Pages (`https://mrjbsa.github.io/themrjbworld/`, a sub-folder) and Vercel (`https://themrjbworld.vercel.app/`). So **every path must be relative** (never start with `/`).
- Installable PWA, packaged with PWABuilder. `manifest.json`, `sw.js` and all icon PNGs live in the **site root** (an `icons/` sub-folder caused PWABuilder 404s — do not move them back).

## Architecture (important)
- **The public site is read-only.** There is no admin / upload code in these files and none must be added. The admin panel is a **separate website**; its files live in `admin/` (`index.html`, `script.js`, `style.css`, `robots.txt`). Keep the two apart: never copy admin code into the public `script.js`, and never edit one when asked about the other.
- Data lives in a **Google Drive JSON file** (`CLOUD_DB_FILE_ID` in `script.js`), public, read with a public API key (`CLOUD_API_KEY`). `CloudSync.pull()` runs at boot, copies the data into `localStorage` (`mjbw_*` keys) and every page renders from `localStorage`.
- The admin saves the **whole snapshot** `{projects, categories, liveSites, banners, videoConfig}` (`CloudSync.push()` in `admin/script.js`). Any top-level key the admin does not write is dropped on its next save, so a new kind of data must be added to **both** `pull()`/`push()` in the admin and `pull()` in the public site.

## Files
| File | Purpose |
|---|---|
| `index.html` | Page shell, all static sections, PWA tags, service-worker registration |
| `style.css` | All styling (light/dark via CSS variables) |
| `script.js` | Router, rendering, CloudSync, YouTube features |
| `sw.js` | Service worker (app-shell cache) |
| `manifest.json` + `icon-*.png`, `favicon-32.png`, `apple-touch-icon.png` | PWA |
| `videos.json` | Optional hand-edited YouTube links (fallback source) |
| `admin/` | The separate admin website (see above) |
| `backend/counter-backend.gs` | Google Apps Script web app that stores visit / download counts (deployed by the owner, not hosted here) |

## Data shapes (as the public site reads them)
- **Project**: `id, slug, name, category, type ('app'|'website'), shortDesc, fullDesc, isFree, price, downloadUrl, driveFileId, coverImage {id,url}, screenshots [{id,url}], fileSize, downloadCount, createdAt, updatedAt`, optional `videoUrl`.
- **Live site**: `id, name, url, description, coverImage, screenshots`, optional `videoUrl`.
- **Banner**: `id, imageUrl, title, subtitle, buttonText, buttonLink`.
- **videoConfig** (top-level key of the main database, written by the admin's **Videos** tab; same shape as the optional `videos.json` / Drive videos file):
  ```json
  { "version": 1, "channelUrl": "https://www.youtube.com/@…",
    "videos": [ { "url": "https://youtu.be/…", "title": "optional" } ],
    "projectVideos": { "<projectId>": "https://youtu.be/…" },
    "siteVideos":    { "<liveSiteId>": "https://youtu.be/…" } }
  ```
  The admin writes a per-project / per-live-site link as `videoUrl` **on the item itself** (Projects tab → *Video* button, Upload-project form, Live Websites form). `projectVideos` / `siteVideos` maps (keyed by id, slug or name) are only used by the optional `videos.json` / Drive-file fallbacks and win over `videoUrl` if both exist.

## YouTube feature (how it works)
- **Home ring**: section `#home-videos-section` (below "Latest projects"), built by `renderVideoRing()`. 3D CSS ring (`perspective`, `rotateY`, `translateZ`), rotated by a `requestAnimationFrame` loop. Pauses on hover/touch and when off-screen; respects `prefers-reduced-motion`. Fewer than 8 videos are repeated around the ring (repeats are `aria-hidden`) so side cards are not edge-on. Fewer than 3 videos → flat row. Clicking a card opens the YouTube link in a new tab.
- **"Watch now"** button: on project cards (real `<a>`) and live-site cards (a `<span data-watch>` handled by a delegated click handler, because the card itself is an `<a>` and links cannot be nested).
- **Detail pages**: `videoDetailHtml()` shows a thumbnail with a play button above the description; click opens YouTube.
- Thumbnails come from `https://i.ytimg.com/vi/<id>/maxresdefault.jpg`, falling back to `hqdefault.jpg`. Non-YouTube links still work but show a plain placeholder.
- Sources, in order: `videoConfig` inside the main database (admin Videos tab) → Drive videos file (`VIDEOS_FILE_ID`, usually empty) → `videos.json` next to `index.html` (matched by project/site id, slug or **name**, case-insensitive) → cached copy. `sw.js` never caches `videos.json`. `?videodemo=1` shows sample items without touching storage.
- Nothing renders when there are no videos, so existing pages are unchanged.

## Visit & download counter
- **Backend**: `backend/counter-backend.gs` (Apps Script, counts kept in Script Properties). Actions: `hit` (`type=visit|download`, `vid`, `id`, `new`), `downloads` (public map), `stats` (full totals + 30 days). Light de-duplication via CacheService (visit 30 min per visitor, download 5 min per visitor+project).
- **Public** (`Stats` in `script.js`, constant `STATS_URL`): one visit ping per browser session (`sessionStorage`), a random visitor id in `localStorage` (`mjbw_vid`), download ping from `DataStore.incrementDownload()`. Per-project totals are fetched (`action=downloads`), cached in `localStorage` (`mjbw_stats`) and copied onto this browser's `downloadCount` values (`Stats.apply()`), so cards, detail pages and the About totals show real numbers. Bots and `?nostats=1` browsers are skipped. Hits use `fetch(..., {mode:'no-cors', keepalive:true})`.
- **Admin** (`Stats` in `admin/script.js`, same `STATS_URL`): Overview and Downloads tabs show totals, a 30-day chart and per-project numbers. The admin never writes server counts back into the database.
- `STATS_URL` must be the **same** in both `script.js` files; when empty everything behaves as before and the admin shows a setup hint.
- After changing the `.gs` file the owner must create a **new version** of the deployment, otherwise the old code keeps running.

## Rules for editing
1. **Work from the owner's latest uploaded files**, never from an older copy. (A stale copy containing admin code once overwrote the live public files and broke the site.)
2. **Do not change existing behaviour or looks** unless asked. Prefer additive changes; say exactly which existing lines you touched.
3. **Never add admin / Drive-write code to the public `script.js`.**
4. **Every deploy: bump the cache version** — `?v=` on `style.css` and `script.js` in `index.html` (public and admin each), and for the public site the same `?v=` entries plus `CACHE_NAME` in `sw.js`. Without this, phones keep the old files.
5. **Admin saves must reach Drive.** Anything the admin changes only becomes visible to visitors after `CloudSync.push()` succeeds, which needs Drive connected. New admin save paths should call `ensureDriveForSave()` first (the Videos tab, the project Video dialog and the live-site form do).
6. Escape all dynamic text with `escapeHtml()`; descriptions go through `mdLite()` (it escapes first); every URL goes through `safeUrl()`.
7. Keep paths relative. Keep PWA files in the root.
8. Don't invent facts about the owner's data. Ask for the live file or a screenshot when unsure.

## Look & feel (keep)
Light background `#F6F7FB`, blue accent `#3654FF`, fonts Space Grotesk (headings) + Inter (body), dark terminal hero, rounded cards. YouTube red `#e62117` is used only for video buttons/play icons. Hero terminal text: "The Mr JB World get portfolio-website" / "…get School Management System".

## Google Cloud settings the site depends on
- **API key** (`CLOUD_API_KEY`): Drive API only; HTTP referrers must include **both** `https://mrjbsa.github.io/*` and `https://themrjbworld.vercel.app/*` (a missing domain = empty site on that domain).
- **OAuth client** (used by the admin site): the admin page's origin must be in *Authorized JavaScript origins*. Scope used: `drive.file`.

## Checklist before handing files back
- `node --check script.js` and `node --check sw.js`.
- Open the page in a real browser with seeded `localStorage` (projects, live sites, `mjbw_videos`) and check: home ring, a project card, a live-site card, both detail pages, and the case where there are **no** videos (section hidden, nothing else changes).
- Confirm the `?v=` numbers match in `index.html` and `sw.js`.
