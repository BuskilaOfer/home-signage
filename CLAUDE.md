# CLAUDE.md — Home Signage Kiosk

> Context file for AI assistants (Claude, Copilot, etc.) continuing work on this project.
> Keep this file up to date when architecture changes.
> **No credentials here** — all secrets are stored outside the repo.

---

## What This Is

A **full-screen digital signage kiosk** for Urban Tower, Kiryat Motzkin, Israel.
Running on a **Raspberry Pi 3B** (BCM2837, vc4 GPU) connected to a 1920×1080 display.

- The **web UI** is static HTML/CSS/JS hosted on **GitHub Pages** (this repo).
- **YouTube videos** play via `mpv` with hardware decode, rendered as a Wayland overlay on top of Chromium.
- Chromium runs in kiosk mode under **Wayland** (labwc compositor).

**Live URL:** https://buskilaofer.github.io/home-signage/
**Repo:** https://github.com/BuskilaOfer/home-signage

---

## Hardware

| Item | Detail |
|------|--------|
| Board | Raspberry Pi 3B Rev 1.2, BCM2837 64-bit |
| GPU | Broadcom VideoCore IV (vc4 DRM driver) |
| OS | Raspberry Pi OS Bookworm (Debian 13 trixie) |
| Display | 1920×1080, Wayland output |
| Decoder | bcm2835-codec V4L2 M2M at `/dev/video10` (H.264 hardware decode) |

---

## Architecture

```
GitHub Pages (this repo)              Raspberry Pi 3B
┌──────────────────────────┐         ┌────────────────────────────────┐
│ index.html               │         │ LightDM autologin              │
│ style.css                │◄──HTTPS─│   └─ labwc (Wayland compositor)│
│ app.js                   │         │        └─ autostart:           │
│ config.json              │         │             start.sh → Chromium│
│ assets/building.jpg      │         │             watch-deploy.sh    │
│ assets/logo.svg          │         │             youtube-player.sh  │
│ assets/rss-icon.svg      │         │                  └─ mpv overlay│
└──────────────────────────┘         └────────────────────────────────┘
```

### Key processes on the Pi

| Process | Role |
|---------|------|
| `labwc` | Wayland compositor, started by LightDM `rpd-labwc` session |
| `chromium --kiosk` | Renders the GitHub Pages web UI fullscreen |
| `mpv` | Plays YouTube videos as a Wayland window pinned over the youtube-card area |
| `watch-deploy.sh` | Polls GitHub API every 60 s; reloads Chromium when a new commit is detected |
| `youtube-player.sh` | Keeps mpv running in a loop; restarts on crash |

---

## Pi File Locations

| Path | Purpose |
|------|---------|
| `/home/ofer/kiosk/start.sh` | Launches Chromium with all flags |
| `/home/ofer/kiosk/youtube-player.sh` | Builds playlist, runs mpv loop |
| `/home/ofer/kiosk/watch-deploy.sh` | GitHub API deploy watcher → Chromium reload |
| `~/.config/labwc/autostart` | labwc startup: runs start.sh, watch-deploy.sh, youtube-player.sh |
| `~/.config/labwc/rc.xml` | Window rule: pins mpv window at youtube-card position (28,28 / 1298×730) |
| `/tmp/yt-player.log` | youtube-player.sh log |
| `/tmp/mpv.log` | mpv stdout/stderr |
| `/tmp/watch-deploy.log` | watch-deploy.sh log |
| `/tmp/yt-playlist.m3u` | Generated mpv playlist (ytdl:// entries) |

---

## Chromium Launch Flags (critical)

```sh
/usr/bin/chromium \
  --ozone-platform=wayland \
  --kiosk \
  --disable-gpu \              # REQUIRED: vc4 driver can't provide GPU accel for Chromium 149
  --no-gl-override \
  --disk-cache-size=0 \
  --media-cache-size=0 \
  --disable-gpu-shader-disk-cache \
  --renderer-process-limit=2 \
  --remote-debugging-port=9222 \
  --user-data-dir=/home/ofer/kiosk/profile \
  https://buskilaofer.github.io/home-signage/
```

**`--disable-gpu` has CSS implications:**
- `backdrop-filter: blur()` **BREAKS** the entire layout (requires GPU compositing). **Never use it.**
- `position: fixed` background-image works fine.
- `background-image` on `html, body` is the most reliable background approach.

---

## mpv YouTube Player

Hardware-accelerated video playback using bcm2835-codec:

```sh
mpv \
  --hwdec=v4l2m2m-copy \
  --vo=gpu --gpu-context=wayland \
  --wayland-app-id=kiosk-youtube \    # used by labwc window rule
  --ontop --ontop-level=system \
  --geometry=1298x730+28+28 \         # matches .youtube-card in CSS
  --ytdl-format="bestvideo[vcodec^=avc][height<=480]+bestaudio/best[height<=480]" \
  --script-opts=ytdl_hook-ytdl_path=/usr/local/bin/yt-dlp \
  /tmp/yt-playlist.m3u
```

**Important notes:**
- mpv v0.40.0: `--ytdl-path` was **removed**; use `--script-opts=ytdl_hook-ytdl_path=...`
- Force h264 (`vcodec^=avc`) at 480p max — AV1/VP9 can't use bcm2835-codec
- Hardware decode confirmed via `/dev/video10` — CPU ~20% at 480p vs ~52% at 720p
- Playlist uses hardcoded video IDs (not dynamic fetch) — avoids yt-dlp hanging on mix playlists

**labwc window rule** (`~/.config/labwc/rc.xml`) pins the mpv window:
```xml
<windowRule identifier="kiosk-youtube" matchOnce="yes" fixedPosition="yes">
  <action name="MoveTo"><x>28</x><y>28</y></action>
  <action name="ResizeTo"><width>1298</width><height>730</height></action>
</windowRule>
```

---

## Layout / CSS Architecture

**Screen:** 1920×1080

```
┌─────────────────────────────────────────────────────┐
│  .main-area  (top: 0, bottom: 300px)                │
│  ┌─────────────────────────┬──────────────────────┐ │
│  │ .youtube-panel (flex:1) │ .right-panel (580px) │ │
│  │  pad 28/14/22/28        │  pad 28/28/22/14     │ │
│  │  └─ .youtube-card       │  ├─ .clock-widget    │ │
│  │     1298×730 @ (28,28)  │  └─ .weather-widget  │ │
│  └─────────────────────────┴──────────────────────┘ │
│  .rss-bar  (position:fixed, bottom:0, height:300px) │
│  ├─ .rss-text-panel (flex:1)                        │
│  ├─ .rss-image-panel (280px)                        │
│  └─ .building-logo-panel (200px)                    │
└─────────────────────────────────────────────────────┘
```

**Background:** `background-image: url("assets/building.jpg")` on `html, body` — most reliable with `--disable-gpu`.

**Glass panels:** `rgba(8, 18, 52, 0.72)` with `border: 1px solid rgba(255,255,255,0.18)` — solid semi-transparent, NO backdrop-filter.

**z-index layers:** body bg (0) → `.bg-wrap` overlay (z:0) → `.main-area` / `.rss-bar` (z:10) → mpv Wayland overlay (above all via `--ontop`)

---

## Data Sources

| Source | What | URL |
|--------|------|-----|
| Open-Meteo | Weather + 4-day forecast | `https://api.open-meteo.com/v1/forecast` — free, no key |
| Ynet RSS | Hebrew news | `https://www.ynet.co.il/Integration/StoryRss2.xml` |
| rss2json | RSS→JSON CORS proxy | `https://api.rss2json.com/v1/api.json?rss_url=...` |
| allorigins | Fallback CORS proxy | `https://api.allorigins.win/get?url=...` |
| Google Fonts | Rubik font | loaded in `<head>` |

---

## Auto-Deploy Flow

1. Push to `main` → GitHub Actions runs `.github/workflows/deploy-pages.yml`
2. Pages deploys in ~30–90 seconds
3. `watch-deploy.sh` on the Pi polls `https://api.github.com/repos/BuskilaOfer/home-signage/commits/main` every 60 s
4. When SHA changes → sends `Ctrl+R` to Chromium via `wtype` (Wayland key injection)

---

## Current Playlist (YouTube video IDs)

```
nK5Jwi3Mpc0  4xDzrJKXOOY  jfKfPfyJRdk  Na0w3Mz46GA
5qap5aO4i9A  DWcJFNfaw9c  lTRiuFIWV54  XULUBg_ZcAU
```

To change: edit the `PLAYLIST_IDS` variable in `/home/ofer/kiosk/youtube-player.sh` and restart the script.

---

## Known Constraints & Gotchas

| Issue | Detail |
|-------|--------|
| `--disable-gpu` on Chromium | Required for RPi3/vc4. Breaks `backdrop-filter`, WebGL. CSS must use solid rgba backgrounds. |
| `background-image` on fixed div | Can fail in software render; put it on `html, body` instead |
| mpv `--ytdl-path` removed | Use `--script-opts=ytdl_hook-ytdl_path=/path/to/yt-dlp` |
| mpv Wayland position | `--geometry` hint is ignored; position via labwc `rc.xml` window rule |
| SIGUSR1 to labwc | Sends reconfigure signal but **kills the kiosk session** on this build — don't use it |
| GitHub Pages cache | CDN can take 2–5 min to serve new content after commit |
| yt-dlp mix playlist | `get_playlist()` on YouTube mix URLs hangs (unlimited entries); use hardcoded IDs |
| CDP WebSocket | Requires `--remote-allow-origins=http://localhost:9222` flag to connect; current start.sh lacks it |
| Chromium singleton lock | After crash, delete `/home/ofer/kiosk/profile/Default/SingletonLock` before restart |

---

## How to Diagnose

```sh
# SSH to Pi (credentials stored separately — not in this file)

# View logs
tail -f /tmp/yt-player.log       # youtube-player.sh
tail -f /tmp/mpv.log              # mpv output
tail -f /tmp/watch-deploy.log     # auto-deploy watcher

# Take a Wayland screenshot
export XDG_RUNTIME_DIR=/run/user/1000
export WAYLAND_DISPLAY=wayland-0
grim /tmp/screenshot.png

# Check what's running
pgrep -a chromium | head -2
pgrep -a mpv
pgrep -a labwc

# Hard-refresh Chromium (clear cache + restart)
pkill chromium
rm -rf /home/ofer/kiosk/profile/Default/Cache/*
nohup /home/ofer/kiosk/start.sh > /dev/null 2>&1 &

# Check hardware decode
ls /dev/video*    # should include /dev/video10 (bcm2835-codec)
```

---

## Key Design Decisions

1. **GitHub Pages** — no backend on Pi; update from any device by pushing to main
2. **mpv + yt-dlp** over browser YouTube — avoids ads, heavy JS, login; hardware decode via bcm2835-codec
3. **Wayland + labwc** — RPi OS Bookworm default; lighter than X11 + openbox
4. **Open-Meteo** — free weather API, no key required, covers Kiryat Motzkin
5. **Hardcoded video playlist** — avoids yt-dlp network fetch at startup (was causing 99% CPU hangs)
6. **CSS `background-image` on body** — most reliable background approach with `--disable-gpu`
7. **No `backdrop-filter`** — breaks entire CSS layout in Chromium without GPU; use solid rgba instead
8. **RSS via rss2json proxy** — RSS feeds block CORS; proxy converts to JSON and adds CORS headers
9. **labwc window rules** — only reliable way to position mpv Wayland window at exact pixel coordinates
10. **480p h264 cap on YouTube** — balances quality vs CPU (v4l2m2m-copy at 480p ≈ 20% CPU vs 52% at 720p)

---

## What's Working ✅

- Building background image (Urban Tower JPEG, CSS on body)
- Semi-transparent glass panels floating over the background
- Large clock with seconds (pulses on tick)
- Weather widget: current temp + condition + 4-day forecast (Open-Meteo)
- Hebrew RTL RSS news with image thumbnail (Ynet)
- YouTube video overlay via mpv hardware decode (v4l2m2m-copy)
- Auto-deploy: push to main → Pi reloads within ~2 minutes
- Labwc window rule pins mpv at exact youtube-card position

## What Could Be Improved 🔧

- [ ] Add `--remote-allow-origins=http://localhost:9222` to Chromium flags for CDP access
- [ ] Shabbat times widget
- [ ] Admin page / config editor UI
- [ ] Smoother RSS transitions (crossfade between items)
- [ ] Building-specific branding tweaks (colors, fonts)
- [ ] Watchdog: auto-restart mpv if video freezes (currently: mpv loop restarts after crash)
