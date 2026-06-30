#!/bin/sh
# Auto-deploy watcher — polls GitHub API every 60s
# When a new commit is detected on main, reloads Chromium via wtype (Wayland key injection)

REPO="BuskilaOfer/home-signage"
INTERVAL=60
LAST_SHA=""

log() { echo "[watch-deploy] $(date +%H:%M:%S) $*"; }

log "started — watching $REPO"

while true; do
  SHA=$(curl -sf "https://api.github.com/repos/$REPO/commits/main" \
        -H "Accept: application/vnd.github.v3+json" \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'][:12])" 2>/dev/null)

  if [ -n "$SHA" ] && [ "$SHA" != "$LAST_SHA" ]; then
    if [ -n "$LAST_SHA" ]; then
      log "new commit $SHA — reloading Chromium"
      export XDG_RUNTIME_DIR=/run/user/1000
      export WAYLAND_DISPLAY=wayland-0
      wtype -M ctrl r -m ctrl 2>/dev/null || true
    else
      log "initial SHA: $SHA"
    fi
    LAST_SHA="$SHA"
  fi

  sleep "$INTERVAL"
done
