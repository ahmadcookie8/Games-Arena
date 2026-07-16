#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly DEPLOY_ROOT="/home/ubuntu/Games-Arena/backend"
readonly COMPOSE_FILE="${DEPLOY_ROOT}/docker-compose.yml"
readonly NEXT_COMPOSE_FILE="${COMPOSE_FILE}.next"
readonly ROLLBACK_COMPOSE_FILE="${COMPOSE_FILE}.rollback"
readonly ENV_FILE="${DEPLOY_ROOT}/.env"
readonly NGINX_SWITCH_HELPER="/usr/local/sbin/games-arena-switch-upstream"
readonly REQUIRED_NGINX_HELPER_VERSION="1"
readonly API_HOST="api.penguincookie.ca"
readonly BLUE_CONTAINER="games-arena-backend-blue"
readonly GREEN_CONTAINER="games-arena-backend-green"
readonly BLUE_PORT="3001"
readonly GREEN_PORT="3002"
readonly DEPLOY_LOCK="${DEPLOY_ROOT}/.deploy.lock"

candidate_container=""
candidate_port=""
candidate_started=0
compose_switched=0
nginx_switched=0
active_port=""
previous_image=""
deployment_succeeded=0

log() {
  printf '[games-arena-deploy] %s\n' "$*"
}

fail() {
  printf '[games-arena-deploy] ERROR: %s\n' "$*" >&2
  return 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command is unavailable: $1"
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

https_health_check() {
  curl \
    --fail \
    --silent \
    --show-error \
    --connect-timeout 5 \
    --max-time 15 \
    --proto '=https' \
    --tlsv1.2 \
    --resolve "${API_HOST}:443:127.0.0.1" \
    "https://${API_HOST}/api/health" >/dev/null
}

direct_health_check() {
  local port="$1"
  curl \
    --fail \
    --silent \
    --show-error \
    --connect-timeout 3 \
    --max-time 10 \
    "http://127.0.0.1:${port}/api/health" >/dev/null
}

container_for_active_port() {
  local port="$1"
  case "$port" in
    3000)
      compose ps -q node 2>/dev/null || true
      ;;
    3001)
      docker ps -q --filter "name=^/${BLUE_CONTAINER}$"
      ;;
    3002)
      docker ps -q --filter "name=^/${GREEN_CONTAINER}$"
      ;;
    *)
      fail "managed Nginx returned an unsupported active port: $port"
      ;;
  esac
}

wait_for_candidate() {
  local deadline=$((SECONDS + 150)) status health
  while (( SECONDS < deadline )); do
    status="$(docker inspect --format '{{.State.Status}}' "$candidate_container" 2>/dev/null || true)"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$candidate_container" 2>/dev/null || true)"
    if [[ "$status" == "running" && "$health" == "healthy" ]]; then
      direct_health_check "$candidate_port"
      return
    fi
    if [[ "$status" == "exited" || "$status" == "dead" || "$health" == "unhealthy" ]]; then
      docker logs --tail 100 "$candidate_container" >&2 || true
      fail "candidate container failed before becoming healthy"
      return
    fi
    sleep 2
  done

  docker logs --tail 100 "$candidate_container" >&2 || true
  fail "candidate container did not become healthy within 150 seconds"
}

rollback_deployment() {
  set +e
  log "rolling back failed candidate deployment"

  local safe_to_remove_candidate=1 restored_port=""
  if [[ "$nginx_switched" == "1" ]]; then
    safe_to_remove_candidate=0
    if [[ -n "$active_port" ]]; then
      sudo -n "$NGINX_SWITCH_HELPER" "$active_port" || true
      restored_port="$(sudo -n "$NGINX_SWITCH_HELPER" --current 2>/dev/null || true)"
      if [[ "$restored_port" == "$active_port" ]]; then
        safe_to_remove_candidate=1
      fi
    fi
    if [[ "$safe_to_remove_candidate" != "1" ]]; then
      log "CRITICAL: failed to confirm Nginx rollback to port ${active_port:-unknown}; preserving the candidate container"
    fi
  fi

  if [[ "$candidate_started" == "1" && -n "$candidate_container" ]]; then
    if [[ "$safe_to_remove_candidate" == "1" ]]; then
      docker rm -f "$candidate_container" >/dev/null 2>&1 || true
    else
      log "CRITICAL: ${candidate_container} remains running because Nginx may still reference it"
    fi
  fi

  if [[ "$compose_switched" == "1" && -f "$ROLLBACK_COMPOSE_FILE" ]]; then
    mv -f -- "$ROLLBACK_COMPOSE_FILE" "$COMPOSE_FILE"
    BACKEND_IMAGE="${previous_image:-games-arena-backend:local}" \
      compose up -d --no-build --wait --wait-timeout 120 redis || \
      log "WARNING: Redis could not be reconciled with the restored Compose file"
  fi
}

on_exit() {
  local status=$?
  trap - EXIT
  if [[ "$deployment_succeeded" != "1" ]]; then
    rollback_deployment
  fi
  exit "$status"
}

main() {
  [[ $# -eq 1 ]] || fail "expected immutable image reference argument"
  local image_ref="$1"
  [[ "$image_ref" =~ ^[a-zA-Z0-9._/:+-]+@sha256:[0-9a-f]{64}$ ]] || \
    fail "backend image must be an immutable sha256 reference"

  require_command docker
  require_command curl
  require_command flock
  require_command sudo
  [[ -f "$ENV_FILE" ]] || fail "production .env is missing"
  [[ -f "$COMPOSE_FILE" ]] || fail "current Compose file is missing"
  [[ -f "$NEXT_COMPOSE_FILE" ]] || fail "candidate Compose file is missing"

  exec 9>"$DEPLOY_LOCK"
  flock -n 9 || fail "another production deployment is already running"

  cd "$DEPLOY_ROOT"
  export NODE_ENV=production
  export CORS_ORIGIN=https://games.penguincookie.ca

  [[ "$(sudo -n "$NGINX_SWITCH_HELPER" --version)" == "$REQUIRED_NGINX_HELPER_VERSION" ]] || \
    fail "installed Nginx switch helper is missing or incompatible"
  sudo -n "$NGINX_SWITCH_HELPER" --check >/dev/null
  active_port="$(sudo -n "$NGINX_SWITCH_HELPER" --current)"
  [[ "$active_port" =~ ^(3000|3001|3002)$ ]] || fail "could not determine active Nginx slot"
  https_health_check || fail "current backend is not healthy through local Nginx"

  local previous_container previous_image_id previous_source_ref rollback_reference rollback_suffix
  previous_container="$(container_for_active_port "$active_port")"
  [[ -n "$previous_container" ]] || fail "active backend container could not be identified"
  [[ "$(docker inspect --format '{{.State.Running}}' "$previous_container")" == "true" ]] || \
    fail "active backend container is not running"

  previous_image_id="$(docker inspect --format '{{.Image}}' "$previous_container")"
  [[ "$previous_image_id" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "active image ID is invalid"
  previous_source_ref="$(docker inspect --format '{{.Config.Image}}' "$previous_container")"
  rollback_suffix="${previous_image_id#sha256:}"
  previous_image="games-arena-backend:rollback-${rollback_suffix:0:16}"
  docker image tag "$previous_image_id" "$previous_image"
  rollback_reference="$previous_image"
  if [[ "$previous_source_ref" =~ ^[a-zA-Z0-9._/:+-]+@sha256:[0-9a-f]{64}$ ]]; then
    rollback_reference="$previous_source_ref"
  fi
  log "retained rollback image ${previous_image}"

  case "$active_port" in
    3001)
      candidate_container="$GREEN_CONTAINER"
      candidate_port="$GREEN_PORT"
      ;;
    *)
      candidate_container="$BLUE_CONTAINER"
      candidate_port="$BLUE_PORT"
      ;;
  esac

  if docker container inspect "$candidate_container" >/dev/null 2>&1; then
    docker rm -f "$candidate_container" >/dev/null
  fi

  BACKEND_IMAGE="$image_ref" docker compose \
    --env-file "$ENV_FILE" \
    -f "$NEXT_COMPOSE_FILE" \
    config --quiet

  cp -f -- "$COMPOSE_FILE" "$ROLLBACK_COMPOSE_FILE"
  mv -f -- "$NEXT_COMPOSE_FILE" "$COMPOSE_FILE"
  compose_switched=1

  BACKEND_IMAGE="$image_ref" compose pull node redis
  BACKEND_IMAGE="$image_ref" compose up \
    -d \
    --no-build \
    --wait \
    --wait-timeout 120 \
    redis

  log "starting candidate ${candidate_container} on loopback port ${candidate_port}"
  BACKEND_IMAGE="$image_ref" compose run \
    --detach \
    --no-TTY \
    --no-deps \
    --pull never \
    --name "$candidate_container" \
    --publish "127.0.0.1:${candidate_port}:3000" \
    node >/dev/null
  candidate_started=1
  docker update --restart unless-stopped "$candidate_container" >/dev/null

  wait_for_candidate
  [[ "$(docker inspect --format '{{.Config.User}}' "$candidate_container")" == "node" ]] || \
    fail "candidate is not running as the node user"
  [[ "$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$candidate_container")" == "true" ]] || \
    fail "candidate root filesystem is writable"
  docker inspect --format '{{json .HostConfig.CapDrop}}' "$candidate_container" | grep -Fq '"ALL"' || \
    fail "candidate did not drop all Linux capabilities"
  docker port "$candidate_container" 3000/tcp | grep -Fxq "127.0.0.1:${candidate_port}" || \
    fail "candidate port is not bound to the expected loopback slot"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$candidate_container" | \
    grep -Fxq 'NODE_ENV=production' || fail "candidate NODE_ENV is not production"
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$candidate_container" | \
    grep -Fxq 'CORS_ORIGIN=https://games.penguincookie.ca' || fail "candidate CORS origin is not canonical"

  log "switching Nginx from port ${active_port} to ${candidate_port}"
  nginx_switched=1
  sudo -n "$NGINX_SWITCH_HELPER" "$candidate_port"
  [[ "$(sudo -n "$NGINX_SWITCH_HELPER" --current)" == "$candidate_port" ]] || \
    fail "Nginx did not persist the candidate upstream"
  https_health_check || fail "candidate failed the post-cutover HTTPS health check through Nginx"

  local state_tmp
  state_tmp="$(mktemp "${DEPLOY_ROOT}/.deployment-state.XXXXXX")"
  {
    printf 'ACTIVE_CONTAINER=%s\n' "$candidate_container"
    printf 'ACTIVE_PORT=%s\n' "$candidate_port"
    printf 'ACTIVE_IMAGE=%s\n' "$image_ref"
    printf 'ROLLBACK_IMAGE=%s\n' "$previous_image"
    printf 'ROLLBACK_REFERENCE=%s\n' "$rollback_reference"
    printf 'DEPLOYED_AT=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "$state_tmp"
  chmod 0600 "$state_tmp"
  mv -f -- "$state_tmp" "${DEPLOY_ROOT}/deployment-state.env"

  rm -f -- "$ROLLBACK_COMPOSE_FILE"
  deployment_succeeded=1
  trap - EXIT
  log "cutover succeeded; candidate is healthy through Nginx"

  # Cleanup happens only after the new slot is committed. A cleanup failure
  # must not roll a healthy deployment back to a partially removed container.
  set +e
  docker stop --time 20 "$previous_container" >/dev/null 2>&1
  docker rm "$previous_container" >/dev/null 2>&1
  while IFS= read -r old_rollback; do
    [[ -z "$old_rollback" || "$old_rollback" == "$previous_image" ]] && continue
    docker image rm "$old_rollback" >/dev/null 2>&1 || true
  done < <(docker image ls --format '{{.Repository}}:{{.Tag}}' --filter 'reference=games-arena-backend:rollback-*')
  set -e

  log "active=${candidate_container} port=${candidate_port} image=${image_ref}"
}

trap on_exit EXIT
main "$@"
