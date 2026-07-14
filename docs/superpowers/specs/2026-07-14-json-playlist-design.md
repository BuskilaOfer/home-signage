# Design: Git-Managed JSON YouTube Playlist

**Date:** 2026-07-14
**Status:** Approved
**Component:** Home Signage Kiosk — mpv YouTube player

## Problem

YouTube video IDs are hardcoded in a shell variable (`PLAYLIST_IDS`) inside
`rpi-setup/youtube-player.sh` on the Pi. Changing the playlist means editing a
shell script and pushing it to the Pi by hand. The stale `youtube` key in
`config.json` is unused (`app.js` replaced `setupYoutube()` with the mpv player).

## Goal

Manage the playlist as a git-tracked `playlist.json`. When edited and pushed,
the Pi auto-reloads it (like the web UI) and the video player restarts with the
new list. The playlist plays top-to-bottom and reloops forever.

## Decisions (from brainstorming)

| Decision | Choice |
|----------|--------|
| Update flow | Auto-reload like the web UI (poll every ~60s, hands-off) |
| JSON shape | Simple: `id` (bare ID **or** full URL) + `enabled` flag |
| Play order | In order, top-to-bottom, then reloop |
| Approach | A — dedicated playlist watcher (separate scripts) |
| mpv restart | `pkill` the kiosk mpv; existing loop relaunches it (~2s gap) |

## The playlist file — `playlist.json` (repo root)

Served by GitHub Pages so the Pi can `curl` it.

```json
{
  "videos": [
    { "id": "nK5Jwi3Mpc0", "enabled": true },
    { "id": "https://www.youtube.com/watch?v=Na0w3Mz46GA", "enabled": true },
    { "id": "5qap5aO4i9A", "enabled": false }
  ]
}
```

- `id` accepts a bare video ID or a full URL (`watch?v=`, `youtu.be/`, `/embed/`).
- `enabled: false` or omitted `enabled` → treated per rule: **omitted = enabled**,
  explicit `false` = skipped.
- Order in the array = play order. Loops forever via mpv `--loop-playlist=inf`.
- Pre-populated with the current 8 IDs so day-one behavior is unchanged.

## Components (Approach A — three focused scripts on the Pi)

### 1. `build-playlist.sh` — pure transform
- **In:** local `playlist.json` path (arg). **Out:** `/tmp/yt-playlist.m3u`.
- Parses JSON with `python3` (already on Pi; no `jq`). Filters `enabled != false`,
  extracts the video ID from bare-ID or URL forms, emits one `ytdl://<id>` per line.
- **Safety:** malformed JSON or a zero-video result → exit non-zero and leave the
  existing m3u untouched. A bad edit never blanks the screen.

### 2. `watch-playlist.sh` — auto-reload poller
- Every 60s, `curl`s the Pages `playlist.json`. Compares a content hash to the
  last seen. On change: save file → `build-playlist.sh` → if build OK, restart mpv.
- Restart = `pkill -f 'wayland-app-id=kiosk-youtube'` (targets exactly this mpv).
- Mirrors the proven `watch-deploy.sh` polling pattern. Depends on `curl` + python3.

### 3. `youtube-player.sh` — refactored (keeps reloop)
- At boot: fetch `playlist.json` once + `build-playlist.sh`. If offline, fall back
  to a baked-in default ID list so video always plays at boot.
- Same mpv loop as today with `--loop-playlist=inf` (the reloop). Restart delay
  shortened 10s → 2s so on-demand swaps are quick.
- Old `PLAYLIST_IDS` becomes the offline fallback only.

## Data flow

```
edit playlist.json → git push → Pages redeploy (~30-90s)
  → watch-playlist.sh (poll 60s) detects hash change
  → build-playlist.sh writes new /tmp/yt-playlist.m3u
  → pkill kiosk mpv → youtube-player.sh loop relaunches mpv (~2s gap)
  → plays new list, loops forever
```

Total lag ~1–2 min after push. Only the video card blinks; clock/weather/RSS/bg
are untouched. A web-only commit does **not** restart the video (separation).

## Error handling

- Bad/empty JSON → keep last good m3u, log, don't restart.
- Offline at boot → baked-in fallback list plays.
- mpv crash → existing restart loop recovers (unchanged behavior).
- `pkill` matches only `wayland-app-id=kiosk-youtube`, never other mpv.

## Testing

1. **Unit (Mac):** bare IDs, URL forms, `enabled:false`, omitted `enabled`,
   malformed JSON (non-zero, no empty m3u), all-disabled (preserve old).
2. **Parity:** generated m3u from pre-populated `playlist.json` byte-matches the
   current hardcoded 8-video output.
3. **Live (Pi):** boot playback + reloop; flip one `enabled:false`, push, swap
   within ~2 min; web-only commit does not restart video; offline fallback.

## Rollback

All changes are additive (new files) plus a `youtube-player.sh` refactor; the
original is preserved in git history for instant restore.

## Files

| File | Change |
|------|--------|
| `playlist.json` | NEW — repo root, git-managed playlist |
| `rpi-setup/build-playlist.sh` | NEW — JSON→m3u transform |
| `rpi-setup/watch-playlist.sh` | NEW — poller/auto-reload |
| `rpi-setup/youtube-player.sh` | MODIFIED — fetch+build at boot, fallback, 2s delay |
| `rpi-setup/labwc-autostart` | MODIFIED — launch watch-playlist.sh |
| `rpi-setup/install.sh` | MODIFIED — copy new scripts |
| `docs/superpowers/specs/2026-07-14-json-playlist-design.md` | NEW — this doc |
