# RPi Home Signage

Self-hosted building signage system: display page on GitHub Pages, audio + kiosk on Raspberry Pi.

## Architecture

```
┌─────────────────────┐         ┌───────────────────────────────┐
│   GitHub Pages      │◄────────│   Your Phone / Laptop         │
│                     │  push   │   (edit config.json & push)   │
│  - index.html       │         └───────────────────────────────┘
│  - style.css        │
│  - app.js           │
│  - config.json ◄────── messages, playlist URL, settings
│  - assets/          │
└────────┬────────────┘
         │ HTTPS (loads page)
         ▼
┌─────────────────────────────────────────────┐
│            Raspberry Pi                      │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Chromium Kiosk (full screen)       │    │
│  │  → loads GitHub Pages URL           │    │
│  │  → shows clock, weather, messages   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Audio Service (systemd)            │    │
│  │  → yt-dlp + mpv                     │    │
│  │  → loops YouTube playlist           │    │
│  │  → re-reads config on each loop     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  config.env → playlist URL                  │
└─────────────────────────────────────────────┘
         │
         ▼
    🔊 Speaker (3.5mm / Bluetooth)
    📺 Screen (HDMI)
```

## Quick Start

### 1. GitHub Pages (Display)

1. Create a GitHub repo (e.g., `home-signage`)
2. Copy the `display/` folder contents to the repo root
3. Add your building background image to `assets/building-bg.jpg`
4. Add your building logo to `assets/logo.png`
5. Edit `config.json` with your messages and location
6. Enable GitHub Pages (Settings → Pages → Source: main, folder: / root)
7. Your display is live at `https://YOUR_USERNAME.github.io/home-signage/`

### 2. Raspberry Pi (Kiosk + Audio)

```bash
# SSH into your Pi
ssh pi@raspberrypi.local

# Download and run installer
curl -O https://raw.githubusercontent.com/YOUR_USERNAME/home-signage/main/rpi-setup/install.sh
chmod +x install.sh
./install.sh "https://YOUR_USERNAME.github.io/home-signage/" "https://www.youtube.com/playlist?list=YOUR_PLAYLIST_ID"

# Reboot
sudo reboot
```

## Managing Messages

Edit `config.json` in your GitHub repo:

```json
{
  "messages": [
    {
      "id": 1,
      "text": "Water shutdown tomorrow 06:00-10:00",
      "type": "alert",
      "active": true
    },
    {
      "id": 2,
      "text": "Building meeting Thursday at 20:00",
      "type": "info",
      "active": true
    }
  ]
}
```

Push to GitHub → the display auto-refreshes every 5 minutes.

## Changing YouTube Playlist

**Option A: SSH to Pi**
```bash
/home/pi/signage/change-playlist.sh "https://www.youtube.com/playlist?list=NEW_ID"
```

**Option B: Edit config.env directly**
```bash
ssh pi@raspberrypi.local
nano /home/pi/signage/config.env
sudo systemctl restart signage-audio
```

## Useful Commands (on the Pi)

| Command | What it does |
|---------|-------------|
| `sudo systemctl restart signage-audio` | Restart audio player |
| `sudo systemctl restart signage-kiosk` | Restart display |
| `journalctl -u signage-audio -f` | View audio logs |
| `journalctl -u signage-kiosk -f` | View kiosk logs |
| `/home/pi/signage/change-playlist.sh <URL>` | Change playlist |

## File Structure

```
home-signage/           ← GitHub repo
├── index.html          ← Signage display page
├── style.css           ← Layout & styling
├── app.js              ← Clock, weather, message rotation
├── config.json         ← Messages, settings (edit this!)
├── assets/
│   ├── building-bg.jpg ← Your building photo
│   └── logo.png        ← Your building logo
├── rpi-setup/
│   └── install.sh      ← Pi installation script
└── README.md
```

## Weather

By default uses [wttr.in](https://wttr.in) (no API key needed).

For better accuracy, get a free [OpenWeatherMap](https://openweathermap.org/api) API key and add it to `config.json`:

```json
"weather": {
    "provider": "openweathermap",
    "apiKey": "YOUR_FREE_KEY_HERE",
    "units": "metric",
    "refreshMinutes": 30
}
```
