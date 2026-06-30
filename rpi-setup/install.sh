#!/bin/bash
# ============================================================
# RPi Home Signage — Install Script
# Target: Raspberry Pi 3B, Raspberry Pi OS Bookworm (trixie)
#         Wayland + labwc compositor (RPi OS default since 2024)
# Run as user 'ofer' on the Pi
# ============================================================
set -e

KIOSK_DIR="/home/ofer/kiosk"
PAGES_URL="https://buskilaofer.github.io/home-signage/"

echo "=== Home Signage Installer (Wayland/labwc) ==="

# 1. System update
sudo apt update && sudo apt upgrade -y

# 2. Install tools (chromium + mpv + Wayland utilities)
sudo apt install -y \
  chromium \
  mpv \
  yt-dlp \
  wtype \
  wlopm \
  grim \
  curl \
  python3

# 3. Kiosk directory
mkdir -p "$KIOSK_DIR"
cp start.sh          "$KIOSK_DIR/"
cp youtube-player.sh "$KIOSK_DIR/"
cp watch-deploy.sh   "$KIOSK_DIR/"
chmod +x "$KIOSK_DIR/"*.sh

# 4. labwc config
mkdir -p /home/ofer/.config/labwc
cp labwc-autostart /home/ofer/.config/labwc/autostart
cp labwc-rc.xml    /home/ofer/.config/labwc/rc.xml
chmod +x /home/ofer/.config/labwc/autostart

# 5. LightDM autologin (if not already set)
if ! grep -q "autologin-user=ofer" /etc/lightdm/lightdm.conf 2>/dev/null; then
  sudo sed -i 's/#autologin-user=/autologin-user=ofer/' /etc/lightdm/lightdm.conf
  sudo sed -i 's/#autologin-session=/autologin-session=rpd-labwc/' /etc/lightdm/lightdm.conf
  echo "LightDM autologin configured."
fi

echo ""
echo "=== Done! Reboot to start kiosk ==="
echo "  sudo reboot"
echo ""
echo "Post-install checks:"
echo "  tail -f /tmp/yt-player.log      — YouTube player log"
echo "  tail -f /tmp/watch-deploy.log   — Auto-deploy watcher log"
echo "  tail -f /tmp/mpv.log            — mpv video log"
