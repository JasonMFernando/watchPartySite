# Watch Party

Real-time watch-together app for **GitHub Pages** — vanilla HTML, CSS, and JavaScript with **PeerJS** (WebRTC) for host ↔ guest sync. No build step, no backend server.

## Features

- Create / join rooms with a short room code and shareable link
- Host movie library (titles + direct `.mp4` URLs)
- Synchronized play, pause, and seek (seek sync when drift &gt; 2s)
- Sidebar text chat
- Floating emoji reactions

## Quick start (local)

Because PeerJS and some browsers restrict `file://`, serve the folder over HTTP:

```bash
# Python 3
python -m http.server 8080

# or Node
npx --yes serve .
```

Open `http://localhost:8080`, click **Create Room**, open the invite link in another browser/profile, then pick a movie as host.

## Add your Cloudflare R2 videos

Edit [`js/movies.js`](js/movies.js) and replace the placeholder entries:

```js
const MOVIES = [
  {
    id: "demo-1",
    title: "My Movie",
    poster: "", // optional image URL
    url: "https://YOUR-R2-BUCKET.r2.dev/path/to/video.mp4",
  },
];
```

Subtitles should be burned into the video files (no separate subtitle tracks).

### R2 CORS

The browser must be allowed to `GET` the `.mp4` from your Pages origin. In the R2 bucket CORS policy, allow your GitHub Pages origin (and `http://localhost:8080` for local testing), methods `GET` / `HEAD`, and appropriate headers.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment**
3. Source: **Deploy from a branch**
4. Branch: `main` (or `master`), folder: **/ (root)**
5. Save, then open `https://<user>.github.io/<repo>/`

## How sync works

1. **Host** opens a PeerJS peer whose ID is the room code (library, then theater).
2. **Guest** connects to that ID with a DataConnection.
3. JSON messages (`play`, `pause`, `seek`, `chat`, `reaction`, `movie`) keep both clients in sync.

**Limits (by design):**

- One host + one guest (single PeerJS connection)
- Host tab must stay open; refreshing the host may require a new room if the Peer ID is still claimed briefly
- Relies on the public PeerJS cloud for signaling

## Project layout

```
index.html      Landing — create / join
library.html    Host movie picker
theater.html    Player, chat, reactions
css/styles.css
js/movies.js    Your R2 URLs
js/peer.js      Room + PeerJS protocol
js/sync.js      Playback sync
js/chat.js
js/reactions.js
js/app.js / library.js / theater.js
```
