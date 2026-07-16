#!/usr/bin/env bash
set -Eeuo pipefail

readonly UPSTREAM_FILE="/etc/nginx/conf.d/games-arena-upstream.conf"
readonly API_UPSTREAM_NAME="games_arena_backend"
readonly HELPER_VERSION="1"

fail() {
  printf 'games-arena upstream switch: %s\n' "$1" >&2
  exit 1
}

require_root() {
  [[ ${EUID} -eq 0 ]] || fail "must run as root"
}

read_current_port() {
  awk '
    $1 == "server" && $2 ~ /^127[.]0[.]0[.]1:(3000|3001|3002)$/ {
      split($2, address, ":")
      print address[2]
      found = 1
      exit
    }
    END { if (!found) exit 1 }
  ' "$UPSTREAM_FILE"
}

check_layout() {
  [[ -f "$UPSTREAM_FILE" ]] || fail "$UPSTREAM_FILE is not installed"

  local current_port nginx_dump upstream_count proxy_count
  current_port="$(read_current_port)" || fail "managed upstream does not contain an allowed loopback port"
  nginx_dump="$(nginx -T 2>&1)" || {
    printf '%s\n' "$nginx_dump" >&2
    fail "nginx configuration is invalid"
  }
  upstream_count="$(grep -Fc "upstream ${API_UPSTREAM_NAME} {" <<<"$nginx_dump" || true)"
  proxy_count="$(grep -Fc "proxy_pass http://${API_UPSTREAM_NAME};" <<<"$nginx_dump" || true)"
  [[ "$upstream_count" == "1" ]] || fail "exactly one managed upstream must be active"
  (( proxy_count >= 2 )) || fail "the active API and Socket.IO locations must use the managed upstream"
  systemctl is-active --quiet nginx || fail "nginx is not active"
  nginx -t >/dev/null
  printf 'layout-ok port=%s\n' "$current_port"
}

render_upstream() {
  local port="$1"
  cat <<EOF
# Managed by /usr/local/sbin/games-arena-switch-upstream.
upstream ${API_UPSTREAM_NAME} {
    server 127.0.0.1:${port} max_fails=3 fail_timeout=5s;
    keepalive 32;
}
EOF
}

switch_upstream() {
  local port="$1"
  [[ "$port" =~ ^(3000|3001|3002)$ ]] || fail "port must be 3000, 3001, or 3002"
  check_layout >/dev/null

  local current_port candidate backup
  current_port="$(read_current_port)"
  if [[ "$current_port" == "$port" ]]; then
    printf 'upstream-already-active port=%s\n' "$port"
    return
  fi

  candidate="$(mktemp /etc/nginx/conf.d/.games-arena-upstream.XXXXXX)"
  backup="$(mktemp /etc/nginx/.games-arena-upstream.rollback.XXXXXX)"
  trap 'rm -f -- "${candidate:-}" "${backup:-}"' EXIT

  cp --preserve=mode,ownership,timestamps -- "$UPSTREAM_FILE" "$backup"
  render_upstream "$port" > "$candidate"
  chown root:root "$candidate"
  chmod 0644 "$candidate"
  mv -f -- "$candidate" "$UPSTREAM_FILE"

  if ! nginx -t >/dev/null; then
    mv -f -- "$backup" "$UPSTREAM_FILE"
    nginx -t >/dev/null || fail "candidate and restored nginx configurations are invalid"
    fail "candidate nginx configuration was rejected; previous upstream restored"
  fi

  if ! systemctl reload nginx; then
    mv -f -- "$backup" "$UPSTREAM_FILE"
    nginx -t >/dev/null || fail "nginx reload failed and restored configuration is invalid"
    systemctl reload nginx || fail "nginx reload and rollback reload both failed"
    fail "nginx reload failed; previous upstream restored"
  fi

  rm -f -- "$backup"
  trap - EXIT
  printf 'upstream-switched old_port=%s new_port=%s\n' "$current_port" "$port"
}

main() {
  require_root
  [[ $# -eq 1 ]] || fail "expected exactly one argument"

  case "$1" in
    --check)
      check_layout
      ;;
    --current)
      check_layout >/dev/null
      read_current_port
      ;;
    --version)
      printf '%s\n' "$HELPER_VERSION"
      ;;
    3000|3001|3002)
      switch_upstream "$1"
      ;;
    *)
      fail "unsupported argument"
      ;;
  esac
}

main "$@"
