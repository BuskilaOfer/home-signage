#!/bin/sh
# YouTube video player — hardware H.264 decode via bcm2835-codec (v4l2m2m-copy)
# Renders as a Wayland overlay pinned over .youtube-card (1298x730 at x=28,y=28)
# Position is enforced by labwc window rule in rc.xml (--geometry hint alone is ignored)

YTDLP="/usr/local/bin/yt-dlp"
GEOMETRY="1298x730+28+28"

# Force h264 at 480p max — AV1/VP9 can't use bcm2835-codec hardware decode
# At 480p h264: ~20% CPU via v4l2m2m-copy vs ~52% at 720p
YTDL_FORMAT="bestvideo[vcodec^=avc][height<=480]+bestaudio/best[height<=480]"

export XDG_RUNTIME_DIR=/run/user/1000
export WAYLAND_DISPLAY=wayland-0

log() { echo "[yt-player] $(date +%H:%M:%S) $*" >> /tmp/yt-player.log; }
log "started"

# Hardcoded playlist IDs — avoids yt-dlp hanging on YouTube mix playlists at startup
PLAYLIST_IDS="nK5Jwi3Mpc0
4xDzrJKXOOY
jfKfPfyJRdk
Na0w3Mz46GA
5qap5aO4i9A
DWcJFNfaw9c
lTRiuFIWV54
XULUBg_ZcAU"

echo "$PLAYLIST_IDS" | grep -v "^$" | while read id; do
  echo "ytdl://$id"
done > /tmp/yt-playlist.m3u
log "playlist built: $(wc -l < /tmp/yt-playlist.m3u) tracks"

while true; do
  log "launching mpv"
  mpv \
    --no-config --really-quiet --no-border --no-osc --no-osd-bar \
    --no-input-default-bindings \
    --hwdec=v4l2m2m-copy \
    --vo=gpu --gpu-context=wayland \
    --wayland-app-id=kiosk-youtube \
    --wayland-configure-bounds=no \
    --ontop --ontop-level=system \
    --geometry="$GEOMETRY" \
    --volume=70 \
    --loop-playlist=inf \
    --ytdl-format="$YTDL_FORMAT" \
    --script-opts=ytdl_hook-ytdl_path="$YTDLP" \
    /tmp/yt-playlist.m3u >> /tmp/mpv.log 2>&1
  RET=$?
  log "mpv exited code=$RET, restarting in 10s"
  sleep 10
done
