#!/bin/sh
# Kiosk launcher — runs Chromium in fullscreen Wayland kiosk mode
# Called from ~/.config/labwc/autostart (inside a restart loop)
pkill -f chromium 2>/dev/null
sleep 1

export XDG_RUNTIME_DIR=/run/user/1000
export WAYLAND_DISPLAY=wayland-0
wlopm --on '*' 2>/dev/null

exec /usr/bin/chromium \
  --no-gl-override \
  --ozone-platform=wayland \
  --kiosk \
  --no-first-run \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --disable-features=Translate,TranslateUI,MediaStreamVideoCapture,VideoCaptureServiceSupported \
  --disable-session-crashed-bubble \
  --password-store=basic \
  --autoplay-policy=no-user-gesture-required \
  --disable-features=AutoplayIgnoreWebAudio \
  --allow-running-insecure-content \
  --disable-web-security \
  --disk-cache-size=0 \
  --media-cache-size=0 \
  --disable-gpu-shader-disk-cache \
  --disable-gpu \
  --renderer-process-limit=2 \
  --gpu-driver-bug-workarounds=0 \
  --remote-debugging-port=9222 \
  --remote-allow-origins=http://localhost:9222 \
  --user-data-dir=/home/ofer/kiosk/profile \
  https://buskilaofer.github.io/home-signage/
