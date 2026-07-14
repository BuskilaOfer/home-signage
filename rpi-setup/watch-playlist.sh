#!/bin/sh
# ============================================================
# watch-playlist.sh — auto-reload the video playlist from GitHub Pages
# ============================================================
# Polls the published playlist.json every INTERVAL seconds. When its
# CONTENT changes, rebuilds /tmp/yt-playlist.m3u and restarts the kiosk
# mpv so the new list takes effect. Mirrors watch-deploy.sh's pattern.
#
# Only restarts video when the PLAYLIST changes — a web-only commit
# does not interrupt playback.
#
# Depends on: curl, python3, build-playlist.sh, youtube-player.sh loop.
# ============================================================

KIOSK_DIR="/home/ofer/kiosk"
PLAYLIST_URL="https://buskilaofer.github.io/home-signage/playlist.json"
LOCAL_JSON="$KIOSK_DIR/playlist.json"
OUT_M3U="/tmp/yt-playlist.m3u"
BUILDER="$KIOSK_DIR/build-playlist.sh"
INTERVAL=60
MPV_MATCH="wayland-app-id=kiosk-youtube"   # must match youtube-player.sh

export XDG_RUNTIME_DIR=/run/user/1000
export WAYLAND_DISPLAY=wayland-0

log() { echo "[watch-playlist] $(date +%H:%M:%S) $*"; }

# Hash the current local json (empty string if none yet).
hash_of() { [ -f "$1" ] && md5sum "$1" 2>/dev/null | awk '{print $1}' || echo ""; }

log "started — watching $PLAYLIST_URL every ${INTERVAL}s"
LAST_HASH="$(hash_of "$LOCAL_JSON")"

while true; do
  # Fetch to a temp file; only act if the download succeeded.
  TMP="/tmp/playlist.fetch.$$"
  if curl -sf "$PLAYLIST_URL" -o "$TMP" 2>/dev/null; then
    NEW_HASH="$(hash_of "$TMP")"
    if [ -n "$NEW_HASH" ] && [ "$NEW_HASH" != "$LAST_HASH" ]; then
      log "playlist changed ($LAST_HASH -> $NEW_HASH)"
      # Build from the freshly fetched file. Only commit + restart if the
      # build succeeds (non-empty, valid) — otherwise keep the old m3u.
      if "$BUILDER" "$TMP" "$OUT_M3U"; then
        mv "$TMP" "$LOCAL_JSON"
        LAST_HASH="$NEW_HASH"
        log "rebuilt playlist; restarting mpv"
        # Kill only the kiosk mpv; youtube-player.sh's loop relaunches it.
        pkill -f "$MPV_MATCH" 2>/dev/null || true
      else
        log "build failed on new playlist — keeping current playlist, will retry"
        rm -f "$TMP"
      fi
    else
      rm -f "$TMP"
    fi
  else
    log "fetch failed (offline?) — will retry in ${INTERVAL}s"
    rm -f "$TMP" 2>/dev/null || true
  fi
  sleep "$INTERVAL"
done
