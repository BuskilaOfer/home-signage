#!/bin/sh
# YouTube video player — hardware H.264 decode via bcm2835-codec (v4l2m2m-copy)
# Renders as a Wayland overlay pinned over .youtube-card (1298x730 at x=28,y=28)
# Position is enforced by labwc window rule in rc.xml (--geometry hint alone is ignored)
#
# Playlist is git-managed in playlist.json (repo root, served by GitHub Pages).
# At boot we fetch + build it; watch-playlist.sh keeps it in sync afterwards.
# If we're offline at boot, we fall back to the baked-in FALLBACK_IDS below so
# video always plays. mpv loops the playlist forever (--loop-playlist=inf).

YTDLP="/usr/local/bin/yt-dlp"
GEOMETRY="1298x730+28+28"

# Audio: route straight to the HDMI output via ALSA, addressed by CARD *name*
# (reboot-stable — unlike numeric card indexes, which can reorder).
# WHY not the default (PipeWire) sink: WirePlumber won't spawn an HDMI sink on
# this board (the vc4 connector reports empty EDID at boot, so its only live
# sink is the analog 3.5mm jack — which is unplugged, hence "no sound"). The
# HDMI PCM works fine when opened directly, so we bypass PipeWire for audio.
# `plughw` does any needed format conversion (raw hw: rejects S16/S32 here).
# If you ever want sound on the 3.5mm jack instead, use:
#   AUDIO_DEVICE="alsa/plughw:CARD=Headphones,DEV=0"
AUDIO_DEVICE="alsa/plughw:CARD=vc4hdmi,DEV=0"

KIOSK_DIR="/home/ofer/kiosk"
PLAYLIST_URL="https://buskilaofer.github.io/home-signage/playlist.json"
LOCAL_JSON="$KIOSK_DIR/playlist.json"
OUT_M3U="/tmp/yt-playlist.m3u"
BUILDER="$KIOSK_DIR/build-playlist.sh"

# Force h264 at 480p max — AV1/VP9 can't use bcm2835-codec hardware decode
# At 480p h264: ~20% CPU via v4l2m2m-copy vs ~52% at 720p
YTDL_FORMAT="bestvideo[vcodec^=avc][height<=480]+bestaudio/best[height<=480]"

export XDG_RUNTIME_DIR=/run/user/1000
export WAYLAND_DISPLAY=wayland-0

log() { echo "[yt-player] $(date +%H:%M:%S) $*" >> /tmp/yt-player.log; }
log "started"

# Offline fallback — used only if we can't fetch/build playlist.json at boot.
FALLBACK_IDS="nK5Jwi3Mpc0
4xDzrJKXOOY
jfKfPfyJRdk
Na0w3Mz46GA
5qap5aO4i9A
DWcJFNfaw9c
lTRiuFIWV54
XULUBg_ZcAU"

build_fallback() {
  echo "$FALLBACK_IDS" | grep -v "^$" | while read id; do echo "ytdl://$id"; done > "$OUT_M3U"
  log "using baked-in fallback playlist: $(grep -c '^ytdl://' "$OUT_M3U") tracks"
}

# --- Build the initial playlist -------------------------------------------
# Prefer a fresh fetch; fall back to last-saved local json; then baked-in IDs.
if curl -sf "$PLAYLIST_URL" -o "$LOCAL_JSON.boot" 2>/dev/null; then
  if [ -x "$BUILDER" ] && "$BUILDER" "$LOCAL_JSON.boot" "$OUT_M3U"; then
    mv "$LOCAL_JSON.boot" "$LOCAL_JSON"
    log "playlist built from fetched playlist.json: $(grep -c '^ytdl://' "$OUT_M3U") tracks"
  else
    rm -f "$LOCAL_JSON.boot"
    if [ -x "$BUILDER" ] && [ -f "$LOCAL_JSON" ] && "$BUILDER" "$LOCAL_JSON" "$OUT_M3U"; then
      log "fetched playlist unusable; built from last-saved local playlist.json"
    else
      build_fallback
    fi
  fi
elif [ -x "$BUILDER" ] && [ -f "$LOCAL_JSON" ] && "$BUILDER" "$LOCAL_JSON" "$OUT_M3U"; then
  log "offline at boot; built from last-saved local playlist.json"
else
  build_fallback
fi

# --- mpv loop (also relaunches on demand when watch-playlist.sh kills it) ---
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
    --ao=alsa --audio-device="$AUDIO_DEVICE" \
    --volume=100 \
    --loop-playlist=inf \
    --ytdl-format="$YTDL_FORMAT" \
    --script-opts=ytdl_hook-ytdl_path="$YTDLP" \
    "$OUT_M3U" >> /tmp/mpv.log 2>&1
  RET=$?
  log "mpv exited code=$RET, restarting in 2s"
  sleep 2
done
