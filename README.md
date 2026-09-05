# Cape Town Christian Tabernacle - Website

A static, Cloudflare Pages-ready church website: home, sermon library,
announcements, events, leadership, contact/prayer requests, giving, and a
live radio page. No backend or database required - content lives in small
JSON files you edit directly.

## What's here

```
index.html            Home page
live.html               Watch Live (streams when you go live)
sermons.html            Sermon library (search, filter, series grouping)
announcements.html      Announcements + pinned notices + bulletin download
events.html              Events calendar
leadership.html          Leadership & ministries
contact.html             Contact info + prayer request form (demo)
give.html                Giving info (placeholders - see give.html itself)
radio.html                Live radio player
404.html                  Custom not-found page
manifest.json              PWA manifest for the radio page
admin/
  index.html                  Admin CMS entry point (visit /admin)
  config.yml                   Maps the CMS to data/*.json - see section 3
functions/
  latest-video.js             Cloudflare Pages Function - auto preacher-of-week
  api/
    auth.js                     GitHub OAuth step 1 (admin login)
    callback.js                 GitHub OAuth step 2 (admin login)
scripts/
  generate_bulletin.py       Rebuilds assets/bulletin.pdf from current data
assets/
  css/styles.css              All styling (royal blue + cardinal red theme)
  js/main.js                   Nav, ticker, gallery, and all page rendering
  js/radio.js                   Radio player, Icecast polling, quality switch
  logo-white.png                 Header/footer logo (light, for blue backgrounds)
  logo.png                       Original logo (dark text, for light backgrounds)
  favicon.ico / favicon-*.png      Browser tab icon, generated from the logo
  og-share.jpg                    Social link-preview image (WhatsApp/Facebook/etc.)
  bulletin.pdf                    This week's downloadable bulletin
  leaders/                        Leadership team photos
  gallery/                        Homepage photo slideshow images
  icons/                          PWA icons
data/
  sermons.json              One entry per sermon, with its audioUrl and series
  announcements.json        Announcements + "Preacher of the week" ticker
  events.json                Events calendar entries
  leadership.json            Leadership team entries
  schedule.json               Radio program schedule
```

## 1. Your logo

Every page points its logo `<img>` at `assets/logo-white.png` (light text,
for the blue header/footer) - replace that file to update the logo
everywhere at once. If you ever add a white/light-background section,
`assets/logo.png` (dark text) is there for that.

## 2. Editing content (no code required)

Prefer a web form over editing JSON directly? See the **Admin portal**
section right below - it edits these same files for you. Editing by hand
still works fine too:

**Add a sermon** - append an object to the `sermons` array in
`data/sermons.json` (the file is `{"sermons": [ ... ]}`) with `title`,
`preacher`, `series`, `date`, and `audioUrl` (a working link to the actual
audio file - see the note on hosting below).

**Post an announcement / update the preacher of the week** - edit
`data/announcements.json`. Set `"pinned": true` to keep something at the
top. The `preacherOfTheWeek` object drives the scrolling red ticker on
every page - see the auto-pull section below for leaving it blank instead.

**Add an event** - append to the `events` array in `data/events.json`
with `title`, `date`, `time`, `location`, and `body`.

**Update leadership** - edit the `leaders` array in `data/leadership.json`.
Each entry's `photo` field must match the real, exact filename in
`assets/leaders/` - **including capitalization**. Web hosting is
case-sensitive, so `photo.jpg` and `photo.JPG` are different files as far
as the site is concerned; a mismatch silently falls back to a gray
placeholder instead of erroring loudly.

**Update the radio schedule** - edit the `schedule` array in
`data/schedule.json`.

**Homepage photo slideshow** - auto-fills from `assets/gallery/`. Just
drop in files named `slide-1.jpg`, `slide-2.jpg`, `slide-3.jpg`, etc.
(jpg/jpeg/png/webp, upper or lower case extension all work) - no JSON
editing needed. It stops at the first missing number, so keep the
numbering contiguous.

## 3. Admin portal (edit content from a web UI, no GitHub editing needed)

`/admin` is a content editor (Decap CMS) for announcements, the preacher
of the week, sermons, events, and leadership - forms instead of hand-
editing JSON. It commits changes directly to your GitHub repo, so nothing
else about the site changes; Cloudflare redeploys automatically exactly
like a normal push.

**This needs one-time setup only you can do** (it involves creating
credentials tied to your GitHub account, which I can't do on your
behalf):

1. **Confirm two values in `admin/config.yml`:**
   - `repo:` - the exact `owner/repo-name` Cloudflare Pages deploys from
   - `base_url:` - your real live domain, no trailing slash

2. **Create a GitHub OAuth App:** GitHub -> Settings -> Developer settings
   -> OAuth Apps -> New OAuth App.
   - Homepage URL: your site's URL
   - Authorization callback URL: `https://YOUR-DOMAIN/api/callback`
   - Generate a **Client Secret** on the app's page after creating it.

3. **Add both as environment variables in Cloudflare Pages** (dashboard ->
   your project -> Settings -> Environment variables) - **not** in the
   repo, for security:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`

4. Redeploy once after adding the variables (Cloudflare only picks up new
   environment variables on the next deployment).

5. Visit `/admin` on your live site and log in with GitHub. Only accounts
   with write access to the repo can actually save changes - GitHub
   enforces that, not this site.

Leadership photos can be uploaded directly through the CMS. Sermon audio
still needs to be a link (GitHub raw or R2 URL, per the audio hosting
section below) - large audio files aren't a good fit for the CMS's
upload flow.

## 4. Hosting your sermon audio

The site just plays whatever URL is in `audioUrl` - where that file
actually lives is up to you. A few options, in order of how well they fit
this project:

- **GitHub** (what's likely already in use): upload via **GitHub Desktop**
  (not the website's drag-and-drop uploader, which caps at 25MB) to get the
  full 100MB git limit. Use the file's "Raw" link as `audioUrl`. Keep the
  repo **public**, and don't let GitHub upload it via Git LFS - LFS-tracked
  files serve a tiny pointer file instead of real audio through raw links.
- **Cloudflare R2**: free for the first 10GB storage / 10M downloads a
  month, zero bandwidth cost ever, and lives right next to this Cloudflare
  Pages site. Bind a custom domain to the bucket and just swap `audioUrl`
  values over - nothing else about the site changes.
- Compressing audio to 64-96kbps mono before uploading (sermons are spoken
  word, not music) typically shrinks files 60-75% with no real quality
  loss, and sidesteps size limits on any host.

## 5. The radio page - architecture

```
Internet
   |
   v
Nginx / Apache            (TLS termination, reverse proxy, CORS headers)
   |
   +--> Your Website  (this repo, served as static files via Cloudflare Pages)
   |
   +--> Icecast Server (port 8000, streaming audio + /status-json.xsl metadata)
```

`radio.html` streams directly from your Icecast mount(s) and polls
`/status-json.xsl` every 15s for now-playing info. Current live setup, in
`assets/js/radio.js`:

```js
const RADIO_CONFIG = {
  icecastBase: "https://radio.christiantabernacle.co.za",
  streams: { "320": "/stream", "128": "/stream", "64": "/stream" },
  statusPath: "/status-json.xsl",
};
```

There's currently only one real mount (`/stream`), so all three quality
buttons point at it and the quality selector is hidden in `radio.html`
(`style="display:none"` on `.quality-row`) rather than showing options
that don't actually change anything. To offer real quality tiers later:
add extra `<mount>` blocks to `icecast.xml` for higher/lower bitrate
versions of the same source, point each `streams` entry at its own mount,
then remove the `display:none`.

Because the website (Cloudflare) and Icecast (your own server) are
different origins, your Nginx in front of Icecast needs CORS headers for
the status endpoint to be readable by the page:

```nginx
location / {
    proxy_pass http://127.0.0.1:8000/;
    proxy_set_header Host $host;
    add_header Access-Control-Allow-Origin "https://YOUR-CLOUDFLARE-DOMAIN" always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
}
```

## 6. YouTube feed on the homepage

The "Latest from our YouTube channel" section embeds your channel's
uploads automatically (no API key, no manual updates) using a playlist-ID
trick: your channel ID with its `UC` prefix swapped for `UU`. This has
gotten unreliable in some browsers due to Google's cookie policy changes -
if it stops working, the fallback is to embed one specific video manually
and swap the link whenever you want to feature a new one.

## 7. Preacher of the week - manual or auto

By default, `preacherOfTheWeek` in `data/announcements.json` drives the
scrolling ticker on every page, exactly as you set it:

```json
"preacherOfTheWeek": { "name": "Brother Jacques Tshinyoka", "topic": "The Harvest", "date": "Sun 2 Aug - 11:00" }
```

**Auto mode:** leave `"name": ""` blank, and the ticker automatically
pulls your channel's most recent YouTube upload instead - title and
publish date, no editing needed week to week. It's labelled "Latest
message" rather than "Preacher of the week" in this mode, since a video
title alone can't reliably be split into a preacher's name - if your
video titles always follow one consistent pattern (e.g. always
"Preacher Name - Topic"), tell me the exact pattern and I can make it
parse the name out specifically.

This runs through a small Cloudflare Pages Function at
`functions/latest-video.js`, which reads your channel's public YouTube
RSS feed server-side (no API key, nothing to renew) and hands back just
the newest video's title and date. It deploys automatically with the rest
of the site - no separate setup.

## 8. Sermon series grouping

The sermons page groups sermons by their `series` field automatically -
there's nothing to configure beyond setting `series` on each entry in
`data/sermons.json` like you already do. A "By series" / "By date" toggle
at the top lets visitors switch views, and a series dropdown next to the
preacher filter jumps straight to one. Sermons without a `series` value
get grouped under "Other sermons."

## 9. Weekly bulletin (PDF)

`assets/bulletin.pdf` is linked from the Announcements page and the
homepage. Two ways to keep it current:

- **Regenerate it from your existing content** (recommended - zero manual
  formatting): run `python3 scripts/generate_bulletin.py` any time your
  announcements/events are up to date. It pulls straight from
  `data/announcements.json`, `data/events.json`, and `data/schedule.json`
  and rebuilds the PDF to match. One-time setup: `pip install reportlab
  --break-system-packages`.
- **Build it by hand instead** - Word, Google Docs, Canva, whatever you
  like - and export as PDF, then overwrite `assets/bulletin.pdf` directly.
  The script is a convenience, not a requirement.

Either way, just push the updated file like any other change.

## 10. Custom 404 page

`404.html` at the site root matches the rest of the site's design instead
of a generic error page. Cloudflare Pages automatically serves this file
for any URL that doesn't match a real page - no configuration needed,
it's picked up purely by being named `404.html` in the root.

## 11. Deploying to Cloudflare Pages

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to
   Git**, pick the repo.
3. Build settings: **Framework preset: None**, no build command, **Build
   output directory: /**.
4. Deploy. Attach your own domain under **Custom domains** once ready.
5. Every push to `main` redeploys automatically.

**After deploying, hard-refresh (or use a private/incognito tab) before
assuming a change didn't work** - browsers and Cloudflare's edge cache
`styles.css`/`main.js` aggressively since the filenames don't change
between deploys. Each is loaded with a version tag (e.g. `styles.css?v=4`)
specifically to force a fresh fetch after real changes - bump that number
any time you edit CSS/JS directly and want to guarantee visitors get the
new version immediately rather than waiting out the cache.

## 12. Color system

| Token | Hex | Use |
|---|---|---|
| Navy | `#0B1330` | Buttons, links, interactive states |
| Royal Blue | `#1E3A8A` | Header, footer, hero, radio page background |
| Cardinal Red | `#C8102E` | Accent only - ticker, live badge, pin flags |
| Gold | `#D8B45C` | Small warm highlights (labels, service times) |
