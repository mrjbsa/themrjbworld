# Mr JB World — Websites & Applications Marketplace

Live site: **https://mrjbsa.github.io/themrjbworld/**
Contact: **mrjbsa.official@outlook.com**
YouTube: **https://www.youtube.com/@themrjbworld**

A single-page, no-backend marketplace where Mr JB uploads ready-to-use websites and
applications. Free projects download instantly; premium projects are bought by email.
Project files live in Google Drive, project information lives in `projects.json`.

---

## Files in this repository

| File | What it is |
|---|---|
| `index.html` | The whole site (home, projects, categories, project detail, about, contact, legal, admin). |
| `style.css` | All styling, light + dark theme. |
| `script.js` | Routing, rendering, Google Drive upload, admin panel, publishing. |
| `projects.json` | **The public database.** Everything visitors see comes from this file. |
| `README.md` | This file. |

---

## How the site works (important)

The admin panel saves your work in **localStorage**, which only exists inside *your own
browser*. That is why, before this update, nobody else could see your uploads.

Now there are two layers:

- **Draft** — what you build in the admin panel (stored in your browser).
- **Live** — `projects.json` in this repository. Every visitor reads this file.

So the rule is simple:

> Upload → Save → **Publish to site** → upload `projects.json` to GitHub.

Until you upload `projects.json`, your change exists only on your device. While you are
signed in as admin, the site shows your draft and warns you if it hasn't been published.

---

## Publishing a change (1 minute)

1. Admin panel → **Publish to site**.
2. Click **Download projects.json**.
3. Open `github.com/mrjbsa/themrjbworld` → **Add file → Upload files**.
4. Drop `projects.json` in the root folder (next to `index.html`) — GitHub will replace the old one.
5. **Commit changes**, wait ~1 minute for GitHub Pages to rebuild.
6. Open the site in a private/incognito window to confirm it is visible to everyone.

There is also **Load live file into draft**, which pulls the published file back into your
browser — use it when you switch device or clear your browser data.

---

## Uploading a project

Admin panel → **Upload project**:

- **Project name, category, descriptions** — shown on the card and the detail page.
- **What's included** — one feature per line (optional).
- **Preview image / screenshot** — *optional*. Picked images are compressed
  (max 900 px wide, JPEG) and stored inside `projects.json`.
  If you don't add one, the site generates a clean device mock-up with the project's
  initials instead of a plain icon.
- **This is a mobile/desktop app** — shows the animated **Install** button instead of **Download**.
- **Free project** — off means premium, so the card shows **Contact to buy** and opens a
  pre-filled email to `mrjbsa.official@outlook.com`.
- **Project file** — `.zip`, `.rar`, `.apk`, `.7z`. It is uploaded to *your* Google Drive,
  into `Mr JB World Uploads / <category>`, made shareable, and the download link is saved.

### Editing a project
Admin → **Projects** → **Edit** on any row. Everything is editable, including the image
(change or remove it). Leave the file box empty to keep the current file, or pick a new one
to replace it — the old Drive file is deleted automatically.

---

## Admin access

There is no public sign-up and no visible link to the admin area.

- Open `https://mrjbsa.github.io/themrjbworld/#/admin-login`, or
- click the footer copyright text **5 times quickly**.

Default login: `mrjb` / `ChangeMe#2026` — change it immediately in
**Settings → Admin access**. Credentials are stored as a SHA-256 hash in your browser only.

> This is a static site, so admin login protects the panel from casual visitors, not from
> someone reading the source. Never keep anything secret in the panel.

---

## Google Drive setup (one time)

1. Google Cloud Console → create a project → **APIs & Services → Enable APIs → Google Drive API**.
2. **OAuth consent screen** → External → add your own Gmail under **Test users**.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. Under **Authorised JavaScript origins** add:
   - `https://mrjbsa.github.io`
   - `http://localhost:8000` (for local testing)
5. Copy the Client ID into Admin → **Settings → Google Drive connection**.

The site requests the `drive.file` scope only, so it can see just the files it creates —
never the rest of your Drive. The connection lasts one browser session; you reconnect each
time you come back to upload.

**"access_denied" when connecting?** Your Google Cloud project is still in *Testing* mode,
so only accounts listed under **Test users** may connect. Add your account there and retry.

---

## Running locally

`fetch('projects.json')` does not work from `file://`, so use a tiny local server:

```bash
cd themrjbworld
python3 -m http.server 8000
# open http://localhost:8000
```

---

## Known limits

- **Download counts** are counted per visitor's browser and only become permanent numbers
  when you publish a new `projects.json`. They are an indicator, not analytics.
- **Image size**: each screenshot adds roughly 40–90 KB to `projects.json`. That is fine for
  dozens of projects; if the file ever grows past a few MB, host the images in Drive instead.
- **Large Drive files** (over ~100 MB) can still show Google's virus-scan warning page before
  downloading. This is Google's behaviour, not the site's.
- There is no server, so there is no payment automation — premium sales stay on email by design.

---

## Changelog — what this update fixed

1. **Projects are now visible to everyone.** The site reads a shared `projects.json`
   instead of only the admin's localStorage, with a new **Publish to site** tab.
2. **Optional preview image** per project, with compression, live preview and remove.
3. **Better empty-state artwork** — auto-generated phone/browser mock-up with the project's
   initials instead of a bare icon.
4. **Full edit support** — edit or delete any project, including replacing its file or image.
5. **Footer icons centred** — `.footer-grid a { display:block }` was overriding `.icon-link`.
6. **More reliable Drive links** via `drive.usercontent.google.com`, which skips the old
   interstitial for large `.zip` / `.apk` files.
7. Admin gets a clear warning whenever the draft has not been published yet.

---

© Mr JB World. Projects are provided as-is; please don't resell or redistribute without permission.
