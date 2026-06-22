# Project Context for LLM Continuation

> This file provides full context for any LLM picking up this project.
> Last updated: 2026-06-22 (evening — video background + logo update)

## What Is This

A self-hosted **building digital signage** system for a Raspberry Pi connected to a screen.
The display page is hosted on **GitHub Pages**, the RPi loads it in kiosk mode and runs a separate YouTube audio player.

**Owner:** Ofer Buskila (GitHub: BuskilaOfer)
**Building:** Urban Tower, Kiryat Motzkin, Israel

---

## Architecture

```
GitHub Pages (static site)          Raspberry Pi
┌─────────────────────────┐        ┌──────────────────────────┐
│ index.html               │◄──────│ Chromium kiosk (fullscr) │
│ style.css                │ HTTPS │                          │
│ app.js                   │       │ yt-dlp + mpv (audio)     │
│ config.json (settings)   │       │ systemd services         │
│ assets/video.gif (38MB)  │       │ config.env (playlist)    │
│ assets/u-logo.png        │       │                          │
│ assets/logo.svg          │       │                          │
└─────────────────────────┘        └──────────────────────────┘
```

- **Display:** Pure static HTML/CSS/JS on GitHub Pages. No backend.
- **Background:** Full-screen looping video GIF (from urban-tower.co.il) with 40% dark overlay — matches the building's official website style.
- **Data sources:** Weather from Open-Meteo API (free, no key). News from Ynet RSS via rss2json API.
- **Audio:** Separate systemd service on RPi using yt-dlp + mpv to loop a YouTube playlist.
- **Management:** Edit `config.json` in the repo and push → page auto-refreshes every 5 minutes.

---

## Current Status (What Works)

| Feature | Status | Details |
|---------|--------|---------|
| Video GIF background | ✅ Done | Full-screen looping aerial GIF from urban-tower.co.il, self-hosted (38MB) |
| Dark overlay | ✅ Done | 40% black opacity over video for text readability |
| Urban Tower logo (top-left) | ✅ Done | `assets/u-logo.png` — white logo, upper-left corner |
| Clock with seconds | ✅ Done | Top-right, pulses background on every tick |
| Weather current | ✅ Done | Open-Meteo API, Kiryat Motzkin, no API key needed |
| 4-day forecast | ✅ Done | Shows next 4 days with emoji icons + high/low |
| RSS news ticker | ✅ Done | Ynet RSS via rss2json, rotates every 10s |
| Building logo (bottom-right) | ✅ Done | SVG "U" + URBAN TOWER text, bottom-right corner |
| Orange ticker bar | ✅ Done | Bottom of screen, RSS icon + rotating text |
| GitHub Pages deploy | ✅ Done | Auto-deploys on push via Actions workflow |
| RPi install script | ✅ Done | `rpi-setup/install.sh` — not tested on real Pi yet |
| YouTube audio loop | ✅ Done | Script written, systemd service defined |
| Auto-refresh config | ✅ Done | Page re-fetches config.json every 5 min |

---

## What Still Needs To Be Done

### High Priority
- [x] **~~Add actual building background~~** — DONE: using full-screen video.gif from urban-tower.co.il with dark overlay (matches the building's official site style)
- [ ] **Test on real Raspberry Pi** — install script written but untested on hardware
- [ ] **Test YouTube audio player** — yt-dlp + mpv script not tested on Pi
- [ ] **RTL support for Hebrew** — RSS ticker shows Hebrew but text direction in ticker might need tweaking for long headlines

### Medium Priority
- [ ] **Mobile-friendly admin** — currently must edit config.json in GitHub. Could add a simple admin page or use GitHub's mobile editor
- [ ] **YouTube playlist change from phone** — currently requires SSH to Pi. Consider a small local API on the Pi
- [ ] **Clock shows "Monday" but today is Sunday** — `weather-day` shows current day name; check timezone handling on Pi
- [ ] **Forecast emoji rendering** — some emojis show as squares on certain browsers/OS. Consider using SVG weather icons instead

### Low Priority / Future
- [ ] Multiple message types (urgent = red, info = default)
- [ ] Scheduled messages (time-based)
- [ ] Shabbat times widget
- [ ] Family calendar integration
- [ ] Photo slideshow zone
- [ ] PWA admin app
- [ ] Voice TTS for urgent messages

---

## Key Files

| File | Purpose | Edit frequency |
|------|---------|---------------|
| `config.json` | All settings: messages, RSS URL, weather location, building info | **Frequent** — this is the main management file |
| `app.js` | Main application logic: clock, weather, RSS, auto-refresh | When adding features |
| `style.css` | Layout and styling, video background, overlay, widgets | When changing design |
| `index.html` | Page structure, widget layout, video background element | Rarely |
| `assets/video.gif` | Full-screen background video loop (38MB, from urban-tower.co.il) | Rarely — replace to change building visual |
| `assets/u-logo.png` | Urban Tower logo (white, displayed top-left) | Rarely |
| `assets/logo.svg` | Building logo (white U + text, displayed bottom-right) | Rarely |
| `rpi-setup/install.sh` | One-shot Pi setup script | Before first Pi install |
| `rpi-setup/signage-audio.service` | systemd unit for YouTube audio | Rarely |
| `rpi-setup/signage-kiosk.service` | systemd unit for Chromium kiosk | Rarely |
| `.github/workflows/deploy-pages.yml` | GitHub Actions: auto-deploy on push | Never |

---

## Config.json Structure

```json
{
  "building": {
    "name": "Urban Tower",
    "logo": "assets/logo.svg",        // path to logo image (bottom-right)
    "background": "assets/video.gif"  // path to background video/GIF (full-screen)
  },
  "location": {
    "city": "Kiryat Motzkin",
    "lat": 32.84,
    "lon": 35.07
  },
  "rss": {
    "url": "http://www.ynet.co.il/Integration/StoryRss2.xml",
    "rotationSeconds": 10,             // how often to switch headlines
    "maxItems": 15                     // max headlines to show
  },
  "messages": [...],                   // fallback if RSS is empty/disabled
  "messageRotationSeconds": 10,
  "youtube": {
    "playlist": "https://www.youtube.com/playlist?list=...",
    "description": "Lofi beats"
  },
  "weather": {
    "provider": "wttr",                // not used anymore, Open-Meteo is hardcoded
    "apiKey": "",                       // not needed for Open-Meteo
    "forecastDays": 4,
    "refreshMinutes": 30
  }
}
```

---

## APIs Used (all free, no keys)

| API | Purpose | Docs |
|-----|---------|------|
| Open-Meteo | Weather + forecast | https://open-meteo.com/en/docs |
| rss2json | Convert RSS XML to JSON (CORS-friendly) | https://rss2json.com/ |
| allorigins | Fallback CORS proxy for RSS | https://allorigins.win/ |
| Google Fonts | Rubik font | loaded via CSS link |

---

## RPi Setup (Not Yet Tested)

The Pi needs:
1. Raspberry Pi OS (Lite or Desktop)
2. Packages: `chromium-browser`, `mpv`, `python3-pip`, `unclutter`, `xserver-xorg`, `xinit`, `openbox`
3. pip: `yt-dlp`
4. Run `install.sh` with GitHub Pages URL and YouTube playlist URL
5. Reboot → auto-starts kiosk + audio

The audio service reads `/home/pi/signage/config.env` which contains:
```
GITHUB_PAGES_URL=https://buskilaofer.github.io/home-signage/
YOUTUBE_PLAYLIST=https://www.youtube.com/playlist?list=...
```

To change playlist: edit config.env or run `change-playlist.sh <URL>`, then restart audio service.

---

## Design Decisions

1. **GitHub Pages over local server** — no backend to maintain on Pi, easy to update from anywhere
2. **Open-Meteo over OpenWeatherMap** — no API key signup, generous free tier, proper forecast data
3. **rss2json over direct fetch** — RSS feeds don't support CORS, need a proxy/converter
4. **yt-dlp + mpv over browser YouTube** — avoids ads, heavy rendering, login issues
5. **config.json for management** — simple, version-controlled, editable from GitHub mobile
6. **Systemd services** — auto-start on boot, auto-restart on crash
7. **Clock pulse animation** — subtle background flash gives "alive" feeling to the clock
8. **Video GIF background (urban-tower.co.il style)** — full-screen looping GIF with dark overlay (40% opacity) matches the building's official website. Self-hosted in repo because external hotlinking is blocked by the source server (CORS). The `<img>` tag approach is used instead of `<video>` for GIF compatibility.
9. **Layered z-index structure** — video (-1 via parent) → overlay (z-index 1 within bg container) → content widgets (default stacking). Widgets use frosted glass effect (backdrop-filter: blur) over the darkened video.
10. **Urban Tower logo top-left** — matches branding from urban-tower.co.il, uses drop-shadow for readability over video

---

## Known Issues

1. **rss2json free tier has rate limits** — 10,000 requests/day. With 5-min refresh = ~288/day, well within limit
2. **GitHub Pages caching** — may take up to 10 min for config.json changes to propagate (CDN cache)
3. **Hebrew RTL in ticker** — text shows correctly but long headlines may clip. The `white-space: nowrap` prevents wrapping; consider adding a scroll animation for very long text
4. **video.gif is 38MB** — large file in repo. Could be optimized (lower framerate, WebP animation, or actual `<video>` tag with MP4). Works fine on GitHub Pages but makes cloning slower.
5. **Video GIF cannot be hotlinked** — urban-tower.co.il blocks cross-origin requests. The GIF must be self-hosted in the repo (already done).

---

## How to Continue Development

1. Clone: `git clone https://github.com/BuskilaOfer/home-signage.git`
2. Edit files locally or directly on GitHub
3. Push to main → auto-deploys to GitHub Pages in ~20 seconds
4. View live at: https://buskilaofer.github.io/home-signage/
5. The page works standalone in any browser for testing

---

## Repo URL
https://github.com/BuskilaOfer/home-signage

## Live Display URL
https://buskilaofer.github.io/home-signage/
