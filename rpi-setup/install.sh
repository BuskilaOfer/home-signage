#!/bin/bash
# ============================================================
# RPi Home Signage - Installation Script
# Run on a fresh Raspberry Pi OS (Lite or Desktop)
# ============================================================

set -e

echo "=== RPi Home Signage Installer ==="
echo ""

# --- Configuration ---
GITHUB_PAGES_URL="${1:-https://YOUR_USERNAME.github.io/home-signage/}"
YOUTUBE_PLAYLIST="${2:-https://www.youtube.com/playlist?list=PLjp0AEEJ0-fHgANMYEKhB_LhEbOFrXQC}"
SIGNAGE_DIR="/home/pi/signage"

echo "Display URL: $GITHUB_PAGES_URL"
echo "YouTube Playlist: $YOUTUBE_PLAYLIST"
echo ""

# --- Update system ---
echo ">>> Updating system..."
sudo apt update && sudo apt upgrade -y

# --- Install dependencies ---
echo ">>> Installing dependencies..."
sudo apt install -y \
    chromium-browser \
    xserver-xorg \
    x11-xserver-utils \
    xinit \
    openbox \
    mpv \
    python3-pip \
    unclutter

# --- Install yt-dlp ---
echo ">>> Installing yt-dlp..."
sudo pip3 install --break-system-packages yt-dlp

# --- Create signage directory ---
echo ">>> Setting up signage directory..."
mkdir -p "$SIGNAGE_DIR"

# --- Save config ---
cat > "$SIGNAGE_DIR/config.env" << EOF
GITHUB_PAGES_URL=${GITHUB_PAGES_URL}
YOUTUBE_PLAYLIST=${YOUTUBE_PLAYLIST}
EOF

# --- Create kiosk start script ---
cat > "$SIGNAGE_DIR/start-kiosk.sh" << 'KIOSK_EOF'
#!/bin/bash
# Start Chromium in kiosk mode pointing to GitHub Pages

source /home/pi/signage/config.env

# Disable screen blanking
xset s off
xset -dpms
xset s noblank

# Hide cursor
unclutter -idle 0.5 -root &

# Start Chromium in kiosk mode
chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-translate \
    --no-first-run \
    --disable-features=TranslateUI \
    --check-for-update-interval=31536000 \
    --autoplay-policy=no-user-gesture-required \
    --start-fullscreen \
    --disable-session-crashed-bubble \
    "$GITHUB_PAGES_URL"
KIOSK_EOF
chmod +x "$SIGNAGE_DIR/start-kiosk.sh"

# --- Create audio player script ---
cat > "$SIGNAGE_DIR/start-audio.sh" << 'AUDIO_EOF'
#!/bin/bash
# YouTube Audio Player - loops playlist using yt-dlp + mpv
# Reads playlist URL from config.env, re-reads on each loop iteration

SIGNAGE_DIR="/home/pi/signage"

while true; do
    source "$SIGNAGE_DIR/config.env"

    echo "[audio] Playing playlist: $YOUTUBE_PLAYLIST"

    # Extract audio URLs and play with mpv (audio only, no video)
    yt-dlp \
        --flat-playlist \
        --print-to-file url "$SIGNAGE_DIR/current_urls.txt" \
        "$YOUTUBE_PLAYLIST" 2>/dev/null

    if [ -f "$SIGNAGE_DIR/current_urls.txt" ]; then
        while IFS= read -r video_url; do
            # Get audio stream URL and play
            AUDIO_URL=$(yt-dlp -f bestaudio --get-url "https://www.youtube.com/watch?v=$video_url" 2>/dev/null)
            if [ -n "$AUDIO_URL" ]; then
                mpv --no-video --really-quiet "$AUDIO_URL"
            fi
        done < "$SIGNAGE_DIR/current_urls.txt"
        rm -f "$SIGNAGE_DIR/current_urls.txt"
    else
        echo "[audio] Failed to fetch playlist, retrying in 30s..."
        sleep 30
    fi

    echo "[audio] Playlist finished, re-reading config and looping..."
    sleep 2
done
AUDIO_EOF
chmod +x "$SIGNAGE_DIR/start-audio.sh"

# --- Create playlist update script (for easy CLI updates) ---
cat > "$SIGNAGE_DIR/change-playlist.sh" << 'CHANGE_EOF'
#!/bin/bash
# Quick script to change the YouTube playlist
# Usage: ./change-playlist.sh "https://youtube.com/playlist?list=..."

NEW_URL="$1"
if [ -z "$NEW_URL" ]; then
    echo "Usage: $0 <youtube-playlist-url>"
    exit 1
fi

CONFIG="/home/pi/signage/config.env"
sed -i "s|YOUTUBE_PLAYLIST=.*|YOUTUBE_PLAYLIST=${NEW_URL}|" "$CONFIG"

echo "Playlist updated to: $NEW_URL"
echo "Audio will switch on next loop iteration."
echo "To force restart now: sudo systemctl restart signage-audio"
CHANGE_EOF
chmod +x "$SIGNAGE_DIR/change-playlist.sh"

# --- Install systemd services ---
echo ">>> Installing systemd services..."

# Kiosk service
sudo cat > /etc/systemd/system/signage-kiosk.service << 'EOF'
[Unit]
Description=Signage Kiosk Display
After=graphical.target
Wants=graphical.target

[Service]
User=pi
Environment=DISPLAY=:0
ExecStartPre=/bin/sleep 5
ExecStart=/home/pi/signage/start-kiosk.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=graphical.target
EOF

# Audio service
sudo cat > /etc/systemd/system/signage-audio.service << 'EOF'
[Unit]
Description=Signage YouTube Audio Player
After=network-online.target sound.target
Wants=network-online.target

[Service]
User=pi
ExecStart=/home/pi/signage/start-audio.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# --- Enable services ---
sudo systemctl daemon-reload
sudo systemctl enable signage-kiosk.service
sudo systemctl enable signage-audio.service

# --- Configure auto-login to console + startx ---
echo ">>> Configuring auto-login..."
sudo raspi-config nonint do_boot_behaviour B2  # Auto-login to CLI

# Add startx to .bash_profile
if ! grep -q "startx" /home/pi/.bash_profile 2>/dev/null; then
    cat >> /home/pi/.bash_profile << 'EOF'

# Auto-start X for signage kiosk
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
    startx
fi
EOF
fi

# --- Openbox autostart (launches kiosk after X starts) ---
mkdir -p /home/pi/.config/openbox
cat > /home/pi/.config/openbox/autostart << 'EOF'
/home/pi/signage/start-kiosk.sh &
EOF

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit /home/pi/signage/config.env with your GitHub Pages URL"
echo "  2. Reboot: sudo reboot"
echo "  3. The signage should appear on the connected screen"
echo ""
echo "Useful commands:"
echo "  - Change playlist: /home/pi/signage/change-playlist.sh <URL>"
echo "  - Restart audio:   sudo systemctl restart signage-audio"
echo "  - Restart display: sudo systemctl restart signage-kiosk"
echo "  - View audio logs: journalctl -u signage-audio -f"
echo "  - View kiosk logs: journalctl -u signage-kiosk -f"
