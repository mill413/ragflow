#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly PROJECT_ROOT
readonly ENV_FILE="${SCRIPT_DIR}/.env"
readonly LOCAL_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.local.yml"
readonly TEST_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

readonly COLOR_RED=$'\033[0;31m'
readonly COLOR_GREEN=$'\033[0;32m'
readonly COLOR_YELLOW=$'\033[1;33m'
readonly COLOR_RESET=$'\033[0m'

log_info() {
  printf '%s%s%s\n' "${COLOR_GREEN}" "$*" "${COLOR_RESET}"
}

log_warn() {
  printf '%s%s%s\n' "${COLOR_YELLOW}" "$*" "${COLOR_RESET}" >&2
}

die() {
  printf '%sError: %s%s\n' "${COLOR_RED}" "$*" "${COLOR_RESET}" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: docker/manage.sh <command> [arguments]

Commands:
  build [IMAGE]                     Build the RAGFlow image.
  deploy <local|dev|test> [options] Deploy an environment.
  stop <local|dev|test> [--volumes] Stop an environment.
  restart <local|dev|test> [options]
                                    Recreate an environment.
  status <local|dev|test>           Show container status.
  logs <local|dev|test> [SERVICE]   Follow environment or service logs.
  images [--optional]               List images used by the deployment.
  export [ARCHIVE] [--optional]     Export images to .tar.gz or .tar.
  import <ARCHIVE>                  Import images from .tar.gz or .tar.
  config <local|dev|test>           Render the resolved Compose config.
  help                              Show this help.

Deploy/restart options:
  --kibana                          Enable the Kibana profile.
  --sandbox                         Enable the Sandbox profile.
  --pull                            Pull referenced images before deployment.
  --no-detach                       Run Compose in the foreground.

Image selection:
  By default, the image is tagged as ragflow-local:<version>.<git-hash>.
  RAGFLOW_IMAGE overrides the image used by build and test deployment.
  RAGFLOW_LOCAL_IMAGE can override the image used by local deployment.

Examples:
  docker/manage.sh build
  docker/manage.sh deploy local
  docker/manage.sh deploy test --kibana
  docker/manage.sh export ragflow-images.tar.gz --optional
  docker/manage.sh import ragflow-images.tar.gz
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

read_env_value() {
  local key="$1"
  awk -F= -v key="${key}" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "${ENV_FILE}"
}

initialize_image_names() {
  local configured_image
  local git_commit
  local ragflow_version
  local versioned_image

  configured_image="$(read_env_value RAGFLOW_IMAGE)"
  ragflow_version="$(sed -n 's/^version = "\([^"]*\)"/\1/p' "${PROJECT_ROOT}/pyproject.toml" | head -n 1)"
  git_commit="$(git -C "${PROJECT_ROOT}" rev-parse --short=9 HEAD)"
  [[ -n "${ragflow_version}" ]] || die "unable to read the RAGFlow version from pyproject.toml"
  [[ -n "${git_commit}" ]] || die "unable to resolve the current Git commit"

  versioned_image="ragflow-local:${ragflow_version}.${git_commit}"
  export RAGFLOW_IMAGE="${RAGFLOW_IMAGE:-${configured_image:-${versioned_image}}}"
  export RAGFLOW_LOCAL_IMAGE="${RAGFLOW_LOCAL_IMAGE:-${RAGFLOW_IMAGE}}"
}

normalize_environment() {
  case "$1" in
    local | dev)
      printf 'local\n'
      ;;
    test)
      printf 'test\n'
      ;;
    *)
      die "unknown environment '$1'; expected local, dev, or test"
      ;;
  esac
}

compose_file_for() {
  case "$1" in
    local)
      printf '%s\n' "${LOCAL_COMPOSE_FILE}"
      ;;
    test)
      printf '%s\n' "${TEST_COMPOSE_FILE}"
      ;;
    *)
      die "unsupported environment: $1"
      ;;
  esac
}

compose() {
  local environment="$1"
  shift
  docker compose --env-file "${ENV_FILE}" -f "$(compose_file_for "${environment}")" "$@"
}

assert_local_ragflow_is_limited() {
  require_command python3

  compose local config --format json | python3 -c '
import json
import sys

config = json.load(sys.stdin)
service = config.get("services", {}).get("ragflow", {})
memory = int(service.get("mem_limit", 0))
cpus = float(service.get("cpus", 0))
if memory <= 0 or cpus <= 0:
    raise SystemExit("local ragflow must define positive mem_limit and cpus")
'
}

profile_arguments=()
pull_before_deploy=0
detach_argument=(--detach)

parse_deploy_options() {
  profile_arguments=()
  pull_before_deploy=0
  detach_argument=(--detach)

  while (($#)); do
    case "$1" in
      --kibana)
        profile_arguments+=(--profile kibana)
        ;;
      --sandbox)
        profile_arguments+=(--profile sandbox)
        ;;
      --pull)
        pull_before_deploy=1
        ;;
      --no-detach)
        detach_argument=()
        ;;
      *)
        die "unknown deployment option: $1"
        ;;
    esac
    shift
  done
}

build_image() {
  local image_name="${1:-${RAGFLOW_IMAGE}}"
  local git_commit
  git_commit="$(git -C "${PROJECT_ROOT}" rev-parse --short=9 HEAD)"

  require_command docker
  log_info "Building ${image_name} from commit ${git_commit}"
  docker build \
    --build-arg "GIT_COMMIT=${git_commit}" \
    --tag "${image_name}" \
    --file "${PROJECT_ROOT}/Dockerfile" \
    "${PROJECT_ROOT}"
}

deploy_environment() {
  local environment
  environment="$(normalize_environment "$1")"
  shift
  parse_deploy_options "$@"

  if [[ "${environment}" == "local" ]]; then
    assert_local_ragflow_is_limited
  fi

  if ((pull_before_deploy)); then
    log_info "Pulling images for ${environment}"
    compose "${environment}" "${profile_arguments[@]}" pull
  fi

  log_info "Deploying ${environment}"
  compose "${environment}" "${profile_arguments[@]}" up "${detach_argument[@]}" --remove-orphans
}

stop_environment() {
  local environment
  local remove_volumes=0
  environment="$(normalize_environment "$1")"
  shift

  while (($#)); do
    case "$1" in
      --volumes)
        remove_volumes=1
        ;;
      *)
        die "unknown stop option: $1"
        ;;
    esac
    shift
  done

  local down_arguments=(--profile kibana --profile sandbox down --remove-orphans)
  if ((remove_volumes)); then
    log_warn "Removing ${environment} containers and named volumes"
    down_arguments+=(--volumes)
  else
    log_info "Stopping ${environment}; named volumes will be preserved"
  fi
  compose "${environment}" "${down_arguments[@]}"
}

restart_environment() {
  local environment="$1"
  shift
  stop_environment "${environment}"
  deploy_environment "${environment}" "$@"
}

list_images() {
  local include_optional=0
  if [[ "${1:-}" == "--optional" ]]; then
    include_optional=1
    shift
  fi
  (($# == 0)) || die "unknown images option: $1"

  local optional_arguments=()
  if ((include_optional)); then
    optional_arguments=(--profile kibana --profile sandbox)
  fi

  {
    compose local "${optional_arguments[@]}" config --images
    compose test "${optional_arguments[@]}" config --images
    if ((include_optional)); then
      printf '%s\n' \
        "${SANDBOX_BASE_PYTHON_IMAGE:-infiniflow/sandbox-base-python:latest}" \
        "${SANDBOX_BASE_NODEJS_IMAGE:-infiniflow/sandbox-base-nodejs:latest}"
    fi
  } | awk 'NF && !seen[$0]++' | sort
}

export_images() {
  local archive=""
  local include_optional=0

  while (($#)); do
    case "$1" in
      --optional)
        include_optional=1
        ;;
      -* )
        die "unknown export option: $1"
        ;;
      *)
        [[ -z "${archive}" ]] || die "only one archive path can be specified"
        archive="$1"
        ;;
    esac
    shift
  done

  archive="${archive:-ragflow-images-$(date +%Y%m%d-%H%M%S).tar.gz}"
  [[ ! -e "${archive}" ]] || die "archive already exists: ${archive}"

  local image_arguments=()
  if ((include_optional)); then
    image_arguments=(--optional)
  fi

  local images=()
  mapfile -t images < <(list_images "${image_arguments[@]}")
  ((${#images[@]} > 0)) || die "no images resolved from Compose"

  local image_name
  for image_name in "${images[@]}"; do
    docker image inspect "${image_name}" >/dev/null 2>&1 || die "image is not available locally: ${image_name}"
  done

  local partial_archive="${archive}.partial"
  rm -f "${partial_archive}"
  trap 'rm -f "${partial_archive}"' EXIT

  log_info "Exporting ${#images[@]} images to ${archive}"
  case "${archive}" in
    *.tar.gz | *.tgz)
      docker save "${images[@]}" | gzip -1 >"${partial_archive}"
      ;;
    *.tar)
      docker save --output "${partial_archive}" "${images[@]}"
      ;;
    *)
      die "archive must end in .tar.gz, .tgz, or .tar"
      ;;
  esac

  mv "${partial_archive}" "${archive}"
  trap - EXIT
  log_info "Export complete: ${archive}"
}

import_images() {
  local archive="$1"
  [[ -f "${archive}" ]] || die "archive not found: ${archive}"

  log_info "Importing images from ${archive}"
  case "${archive}" in
    *.tar.gz | *.tgz)
      gzip -dc "${archive}" | docker load
      ;;
    *.tar)
      docker load --input "${archive}"
      ;;
    *)
      die "archive must end in .tar.gz, .tgz, or .tar"
      ;;
  esac
}

main() {
  require_command docker
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required"
  [[ -f "${ENV_FILE}" ]] || die "environment file not found: ${ENV_FILE}"
  initialize_image_names

  local command="${1:-help}"
  if (($#)); then
    shift
  fi

  case "${command}" in
    build)
      (($# <= 1)) || die "build accepts at most one image name"
      build_image "${1:-}"
      ;;
    deploy)
      (($# >= 1)) || die "deploy requires an environment"
      deploy_environment "$@"
      ;;
    stop)
      (($# >= 1)) || die "stop requires an environment"
      stop_environment "$@"
      ;;
    restart)
      (($# >= 1)) || die "restart requires an environment"
      restart_environment "$@"
      ;;
    status)
      (($# == 1)) || die "status requires exactly one environment"
      compose "$(normalize_environment "$1")" ps
      ;;
    logs)
      (($# >= 1 && $# <= 2)) || die "logs requires an environment and optional service"
      local environment
      environment="$(normalize_environment "$1")"
      shift
      compose "${environment}" logs --follow --tail 200 "$@"
      ;;
    images)
      list_images "$@"
      ;;
    export)
      export_images "$@"
      ;;
    import)
      (($# == 1)) || die "import requires exactly one archive"
      import_images "$1"
      ;;
    config)
      (($# == 1)) || die "config requires exactly one environment"
      compose "$(normalize_environment "$1")" config
      ;;
    help | --help | -h)
      usage
      ;;
    *)
      die "unknown command: ${command}"
      ;;
  esac
}

main "$@"
