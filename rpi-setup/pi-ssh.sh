#!/usr/bin/env bash
# ============================================================
# pi-ssh.sh — SSH to the kiosk Pi, auto-resolving its IP by MAC
# ============================================================
# Usage:
#   rpi-setup/pi-ssh.sh                 # interactive shell
#   rpi-setup/pi-ssh.sh 'uptime; pgrep -a mpv'   # run a remote command
#   PI_PRINT_IP=1 rpi-setup/pi-ssh.sh   # just print the resolved IP and exit
#
# Resolves the IP via find-pi.sh (MAC-based discovery), so it keeps
# working after the Pi's DHCP lease changes. No need to edit RPI_HOST.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if [[ -f "$REPO_ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "$REPO_ROOT/.env"; set +a
fi

: "${RPI_USER:?RPI_USER not set in .env}"
: "${RPI_PASS:?RPI_PASS not set in .env}"

# Resolve current IP by MAC (falls back to sweep). find-pi.sh prints only the IP.
IP="$("$SCRIPT_DIR/find-pi.sh")"

if [[ "${PI_PRINT_IP:-0}" == "1" ]]; then
  echo "$IP"; exit 0
fi

SSH_OPTS=(
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null   # IP churns; don't spam known_hosts
  -o ConnectTimeout=8
  -o PreferredAuthentications=password
  -o PubkeyAuthentication=no
  -o LogLevel=ERROR
)

echo "pi-ssh: connecting to $RPI_USER@$IP ..." >&2
exec sshpass -p "$RPI_PASS" ssh "${SSH_OPTS[@]}" "$RPI_USER@$IP" "$@"
