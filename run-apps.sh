#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# run-apps.sh — Build, start, and manage AgentScope containers
# ─────────────────────────────────────────────────────────────────────────────

COMPOSE="docker compose"
ENV_FILE=".env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ─── Helpers ─────────────────────────────────────────────────────────────────

check_deps() {
    for cmd in docker; do
        if ! command -v "$cmd" &>/dev/null; then
            err "'$cmd' is not installed or not in PATH."
            exit 1
        fi
    done
    if ! docker compose version &>/dev/null; then
        err "Docker Compose v2 plugin not found. Install it first."
        exit 1
    fi
}

ensure_env() {
    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f ".env.example" ]]; then
            warn ".env not found — copying from .env.example"
            cp .env.example "$ENV_FILE"
            warn "Edit $ENV_FILE and add your API keys, then re-run."
        else
            warn ".env not found and no .env.example available."
        fi
    fi
}

# ─── Commands ────────────────────────────────────────────────────────────────

cmd_build() {
    log "Building Docker image..."
    $COMPOSE build --pull "$@"
}

cmd_up() {
    log "Starting all services..."
    $COMPOSE up -d "$@"
    log "Services started. Use './run-apps.sh logs' to tail logs."
}

cmd_down() {
    log "Stopping all services..."
    $COMPOSE down "$@"
}

cmd_restart() {
    log "Restarting services..."
    $COMPOSE restart "$@"
}

cmd_logs() {
    $COMPOSE logs -f --tail=100 "$@"
}

cmd_status() {
    $COMPOSE ps
}

cmd_shell() {
    local service="${1:-agentscope}"
    log "Opening shell in '$service'..."
    $COMPOSE exec "$service" bash
}

cmd_run_example() {
    local example="${1:-}"
    if [[ -z "$example" ]]; then
        echo -e "${CYAN}Available workflow examples:${NC}"
        ls examples/workflows/
        echo ""
        echo -e "${CYAN}Available agent examples:${NC}"
        ls examples/agent/
        echo ""
        echo "Usage: $0 run-example <example-path>"
        echo "       e.g.: $0 run-example examples/workflows/multiagent_conversation/main.py"
        exit 0
    fi
    log "Running example: $example"
    $COMPOSE run --rm agentscope python "$example"
}

cmd_clean() {
    warn "This will remove containers, networks, and volumes. Continue? [y/N]"
    read -r confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        $COMPOSE down -v --remove-orphans
        log "Cleaned up."
    else
        log "Aborted."
    fi
}

usage() {
    echo -e "${CYAN}AgentScope Docker Manager${NC}"
    echo ""
    echo "Usage: $0 <command> [args...]"
    echo ""
    echo "Commands:"
    echo "  build           Build the Docker image"
    echo "  up              Start all services (detached)"
    echo "  down            Stop all services"
    echo "  restart         Restart services"
    echo "  logs [svc]      Tail logs (all services or a specific one)"
    echo "  status          Show running containers"
    echo "  shell [svc]     Open a bash shell (default: agentscope)"
    echo "  run-example     List or run a specific example script"
    echo "  clean           Remove containers, networks, and volumes"
    echo ""
    echo "Examples:"
    echo "  $0 build"
    echo "  $0 up"
    echo "  $0 logs agentscope"
    echo "  $0 shell agentscope"
    echo "  $0 run-example examples/workflows/multiagent_conversation/main.py"
    echo "  $0 down"
}

# ─── Main ────────────────────────────────────────────────────────────────────

main() {
    check_deps
    ensure_env

    local cmd="${1:-help}"
    shift || true

    case "$cmd" in
        build)        cmd_build "$@" ;;
        up|start)     cmd_up "$@" ;;
        down|stop)    cmd_down "$@" ;;
        restart)      cmd_restart "$@" ;;
        logs)         cmd_logs "$@" ;;
        status|ps)    cmd_status ;;
        shell|exec)   cmd_shell "$@" ;;
        run-example)  cmd_run_example "$@" ;;
        clean)        cmd_clean ;;
        help|--help|-h|*) usage ;;
    esac
}

main "$@"
