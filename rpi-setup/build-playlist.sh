#!/bin/sh
# ============================================================
# build-playlist.sh — transform playlist.json -> mpv m3u
# ============================================================
# Pure transform. Reads a playlist.json, writes an mpv playlist of
# ytdl:// entries. Used by youtube-player.sh (boot) and
# watch-playlist.sh (on change).
#
# Usage:  build-playlist.sh <playlist.json> [output.m3u]
#   output.m3u defaults to /tmp/yt-playlist.m3u
#
# SAFETY: on malformed JSON or a zero-video result, it does NOT
# overwrite the output — it leaves the last-good playlist in place
# and exits non-zero. A bad edit can never blank the screen.
#
# Depends on: python3 (present on the Pi; no jq required).
# ============================================================
set -eu

SRC="${1:-}"
OUT="${2:-/tmp/yt-playlist.m3u}"

if [ -z "$SRC" ]; then
  echo "build-playlist: usage: build-playlist.sh <playlist.json> [out.m3u]" >&2
  exit 2
fi
if [ ! -f "$SRC" ]; then
  echo "build-playlist: source not found: $SRC" >&2
  exit 2
fi

# Parse + transform in python3. Prints ytdl:// lines to stdout.
# Exits non-zero (and prints nothing usable) on parse error or empty result.
# ID extraction handles: bare ID, watch?v=, youtu.be/, /embed/, /shorts/.
LINES="$(python3 - "$SRC" <<'PY'
import sys, json, re

def extract_id(raw):
    s = (raw or "").strip()
    if not s:
        return None
    # Full URL forms -> pull the 11-char video id.
    m = re.search(r'(?:v=|/embed/|/shorts/|youtu\.be/)([A-Za-z0-9_-]{11})', s)
    if m:
        return m.group(1)
    # Bare id: exactly the YouTube id charset/length.
    if re.fullmatch(r'[A-Za-z0-9_-]{11}', s):
        return s
    return None

try:
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        data = json.load(f)
except Exception as e:
    sys.stderr.write("build-playlist: JSON parse error: %s\n" % e)
    sys.exit(1)

videos = data.get("videos") if isinstance(data, dict) else None
if not isinstance(videos, list):
    sys.stderr.write("build-playlist: no 'videos' array in JSON\n")
    sys.exit(1)

out = []
for entry in videos:
    if not isinstance(entry, dict):
        continue
    # Omitted 'enabled' => enabled. Explicit false => skip.
    if entry.get("enabled", True) is False:
        continue
    vid = extract_id(entry.get("id"))
    if vid:
        out.append("ytdl://" + vid)
    else:
        sys.stderr.write("build-playlist: skipping unrecognized id: %r\n" % entry.get("id"))

if not out:
    sys.stderr.write("build-playlist: no enabled/valid videos — refusing to write empty playlist\n")
    sys.exit(1)

sys.stdout.write("\n".join(out) + "\n")
PY
)" || {
  echo "build-playlist: build failed; keeping existing $OUT" >&2
  exit 1
}

# Write atomically so a reader never sees a half-written file.
TMP="${OUT}.tmp.$$"
printf '%s\n' "$LINES" > "$TMP"
mv "$TMP" "$OUT"

COUNT="$(grep -c '^ytdl://' "$OUT" 2>/dev/null || echo 0)"
echo "build-playlist: wrote $COUNT track(s) to $OUT" >&2
exit 0
