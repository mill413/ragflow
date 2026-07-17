#!/usr/bin/env bash

set -euo pipefail

readonly APP_ENTRYPOINT=/ragflow/entrypoint.sh
readonly WATCH_INTERVAL_SECONDS=2
readonly WATCH_PATHS=(
  /ragflow/admin
  /ragflow/api
  /ragflow/common
  /ragflow/agent
  /ragflow/deepdoc
  /ragflow/mcp
  /ragflow/memory
  /ragflow/rag
  /ragflow/conf/service_conf.yaml.template
)

app_pid=""

fingerprint_sources() {
  find "${WATCH_PATHS[@]}" -type f \
    \( -name '*.py' -o -name '*.yaml' -o -name '*.yml' -o -name '*.json' \) \
    -printf '%T@ %s %p\n' 2>/dev/null \
    | sort \
    | sha256sum \
    | cut -d ' ' -f 1
}

start_app() {
  echo "Starting RAGFlow development backend..."
  setsid "$APP_ENTRYPOINT" "$@" &
  app_pid=$!
}

stop_app() {
  if [[ -z "$app_pid" ]] || ! kill -0 "$app_pid" 2>/dev/null; then
    return
  fi

  kill -TERM -- "-$app_pid" 2>/dev/null || true
  for _ in {1..15}; do
    if ! kill -0 "$app_pid" 2>/dev/null; then
      wait "$app_pid" 2>/dev/null || true
      return
    fi
    sleep 1
  done

  kill -KILL -- "-$app_pid" 2>/dev/null || true
  wait "$app_pid" 2>/dev/null || true
}

shutdown() {
  stop_app
  exit 0
}

trap shutdown INT TERM

fingerprint=$(fingerprint_sources)
start_app "$@"

while true; do
  sleep "$WATCH_INTERVAL_SECONDS"

  if ! kill -0 "$app_pid" 2>/dev/null; then
    wait "$app_pid"
    exit $?
  fi

  next_fingerprint=$(fingerprint_sources)
  if [[ "$next_fingerprint" == "$fingerprint" ]]; then
    continue
  fi

  echo "Backend source change detected; restarting RAGFlow processes..."
  fingerprint="$next_fingerprint"
  stop_app
  start_app "$@"
done
