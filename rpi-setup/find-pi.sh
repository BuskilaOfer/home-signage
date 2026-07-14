#!/usr/bin/env bash
# ============================================================
# find-pi.sh — resolve the kiosk Pi's current LAN IP by MAC
# ============================================================
# WHY: The Pi gets its IP from DHCP, so RPI_HOST in .env goes
# stale on every reboot/lease change. MAC addresses never change,
# so we discover the IP from the MAC instead of hardcoding it.
#
# Prints the working IP to stdout (nothing else), so it is safe
# to use as:   PI=$(rpi-setup/find-pi.sh)
# Diagnostics go to stderr. Exit 0 on success, 1 if not found.
#
# Env (from .env, auto-sourced): RPI_MAC_ETH, RPI_MAC_WLAN, RPI_SUBNET
# ============================================================
set -euo pipefail

log() { echo "find-pi: $*" >&2; }

# --- Locate + source .env (repo root is this script's parent dir) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
if [[ -f "$REPO_ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "$REPO_ROOT/.env"; set +a
fi

# Wired (eth0) is the primary route, so try it first; WiFi (wlan0) is backup.
CANDIDATE_MACS=()
[[ -n "${RPI_MAC_ETH:-}"  ]] && CANDIDATE_MACS+=("$RPI_MAC_ETH")
[[ -n "${RPI_MAC_WLAN:-}" ]] && CANDIDATE_MACS+=("$RPI_MAC_WLAN")

if [[ ${#CANDIDATE_MACS[@]} -eq 0 ]]; then
  log "ERROR: no RPI_MAC_ETH / RPI_MAC_WLAN set in $REPO_ROOT/.env"
  exit 1
fi

# Canonicalize a MAC for comparison. macOS `arp` strips leading zeros
# from each octet (prints b8:27:eb:7a:60:7 not ...60:07), so we lowercase
# and strip leading zeros from every octet on BOTH sides before matching.
# NOTE: macOS ships bash 3.2 — no ${var,,}; lowercase via tr.
norm_mac() {
  local mac oct out="" octs
  mac="$(tr 'A-F-' 'a-f:' <<< "$1")"   # lowercase + treat '-' as ':'
  IFS=':' read -ra octs <<< "$mac"
  for oct in "${octs[@]}"; do
    oct="${oct#"${oct%%[!0]*}"}"        # strip leading zeros
    [[ -z "$oct" ]] && oct="0"
    out+="${out:+:}${oct}"
  done
  echo "$out"
}

# Find an IPv4 in the ARP cache whose MAC matches $1. Prints IP or nothing.
ip_from_arp() {
  local want; want="$(norm_mac "$1")"
  # A blank target must never match (would false-hit incomplete entries).
  [[ -z "$want" ]] && return 1
  # arp -a -n lines look like: ? (192.168.68.117) at b8:27:eb:2f:35:52 on en0 ...
  arp -a -n 2>/dev/null | while read -r line; do
    local ip mac
    ip="$(sed -n 's/.*(\([0-9.]*\)).*/\1/p' <<< "$line")"
    mac="$(awk '{for(i=1;i<=NF;i++) if($i=="at"){print $(i+1); exit}}' <<< "$line")"
    [[ -z "$ip" || -z "$mac" || "$mac" == "(incomplete)" ]] && continue
    if [[ "$(norm_mac "$mac")" == "$want" ]]; then echo "$ip"; return; fi
  done
}

# Reachability check that does not depend on ICMP being answered:
# a refused/answered TCP:22 or a ping reply both count as "alive".
alive() { ping -c 1 -t 1 "$1" >/dev/null 2>&1; }

try_all_macs() {
  local mac ip
  for mac in "${CANDIDATE_MACS[@]}"; do
    ip="$(ip_from_arp "$mac" || true)"
    if [[ -n "$ip" ]]; then echo "$ip"; return 0; fi
  done
  return 1
}

# 1) Fast path: already in ARP cache.
if ip="$(try_all_macs)"; then
  log "found via ARP cache: $ip"
  echo "$ip"; exit 0
fi

# 2) Populate ARP by sweeping the subnet, then retry.
SUBNET="${RPI_SUBNET:-}"
if [[ -z "$SUBNET" ]]; then
  # Derive /24 from the default-route source address.
  myip="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}' | \
          xargs -I{} ipconfig getifaddr {} 2>/dev/null || true)"
  [[ -n "$myip" ]] && SUBNET="${myip%.*}.0/24"
fi
[[ -z "$SUBNET" ]] && SUBNET="192.168.68.0/24"
BASE="${SUBNET%.*/*}"   # 192.168.68

log "not in ARP cache; sweeping ${BASE}.1-254 to discover it ..."
for i in $(seq 1 254); do ping -c 1 -t 1 "${BASE}.${i}" >/dev/null 2>&1 & done
wait 2>/dev/null || true

if ip="$(try_all_macs)"; then
  log "found after sweep: $ip"
  echo "$ip"; exit 0
fi

log "ERROR: could not find the Pi by MAC on ${BASE}.0/24."
log "  MACs searched: ${CANDIDATE_MACS[*]}"
log "  Is the Pi powered on and on this network?"
exit 1
