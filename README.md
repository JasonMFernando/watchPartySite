# Watch Party

Real-time watch-together app for **GitHub Pages** — vanilla HTML/CSS/JS with **Firebase Realtime Database** for room sync. Videos stream from Cloudflare R2. No build step.

## Features

- Create / join rooms with a short room code and shareable link
- Host movie library loaded from an R2-backed Cloudflare Worker
- Synchronized play, pause, and seek
- Sidebar text chat + floating emoji reactions

## Quick start (local)

```bash
python -m http.server 8080
```

Open `http://localhost:8080`, click **Create Room**, open the invite link in another browser/profile, then pick a movie as host.

## Firebase setup (required)

1. Project config lives in [`js/firebase-config.js`](js/firebase-config.js).
2. In Firebase Console → **Realtime Database → Rules**, paste the contents of [`database.rules.json`](database.rules.json) and **Publish**.
3. Until rules are published (or if left locked), create/join will fail.

Default rules allow anyone with a room code to read/write that room (fine for a private watch party; tighten later if you add Auth).

## Movies (R2 + Worker)

The library fetches:

`https://watchparty-movie-list.jasonmathewfd.workers.dev/`

Upload `.mp4` files to your R2 bucket; refresh the library to see them. No need to edit `js/movies.js` for new episodes.

### Multiple qualities (480p / 720p)

Name pairs the same except for the quality token:

```
Show.S01E01.Title.720P.Bluray....mp4
Show.S01E01.Title.480P.Bluray....mp4
```

The site groups those into **one** library card and shows a **Quality** dropdown in the theater (each person can pick 480 or 720; sync stays on time).

### R2 CORS

Allow your GitHub Pages origin (and `http://localhost:8080`) for `GET` / `HEAD`.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Deploy from a branch** → `main` / **(root)**

## How sync works

1. Host creates a Firebase room (`rooms/{code}`).
2. Guest joins the same path with the room code.
3. Movie, playback, chat, and reactions are written under that room and streamed to both clients in real time.

**Limits:** designed for one host + one guest; video still downloads separately from R2 for each viewer.

## Project layout

```
index.html           Landing — create / join
library.html         Host movie picker
theater.html         Player, chat, reactions
database.rules.json  RTDB security rules (paste into Firebase)
js/firebase-config.js
js/peer.js           Room API (Firebase-backed)
js/sync.js / chat.js / reactions.js
js/app.js / library.js / theater.js
```
