#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# run-apps.sh — Build, start, and manage PrivaAgent containers
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
    log "Building Docker images (--progress=plain shows full install output)..."
    DOCKER_BUILDKIT=1 $COMPOSE build --pull --progress=plain "$@"
}

cmd_up() {
    log "Starting all services..."
    $COMPOSE up -d "$@"
    echo ""
    log "Services started:"
    log "  Frontend  → http://localhost:${FRONTEND_PORT_EXPOSE:-3030}"
    [[ -n "${BACKEND_PORT_EXPOSE:-}" ]] && log "  API (Host)→ http://localhost:${BACKEND_PORT_EXPOSE}"
    echo ""
    log "Use './run-apps.sh logs' to tail logs."
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
    echo ""
    echo -e "${CYAN}Access URLs:${NC}"
    echo "  Frontend  → http://localhost:${FRONTEND_PORT_EXPOSE:-3030}"
    [[ -n "${BACKEND_PORT_EXPOSE:-}" ]] && echo "  API (Host)→ http://localhost:${BACKEND_PORT_EXPOSE}"
}

cmd_shell() {
    local service="${1:-core}"
    log "Opening shell in '$service'..."
    $COMPOSE exec "$service" sh 2>/dev/null || $COMPOSE exec "$service" bash
}

# ── Web UI ────────────────────────────────────────────────────────────────────

cmd_web() {
    log "Starting web UI (backend + frontend)..."
    $COMPOSE up -d backend frontend
    echo ""
    log "Web UI started:"
    log "  Frontend → http://localhost:3030"
    log "  API      → http://localhost:8088/api"
}

cmd_web_dev() {
    echo -e "${CYAN}Starting frontend in dev mode (hot-reload)...${NC}"
    echo ""
    # Start backend via Docker
    log "Starting backend container..."
    $COMPOSE up -d backend
    echo ""
    # Start frontend locally
    if [[ ! -d "frontend/node_modules" ]]; then
        log "Installing frontend dependencies..."
        (cd frontend && npm install)
    fi
    log "Starting React dev server at http://localhost:3030 ..."
    (cd frontend && npm run dev)
}

cmd_web_build() {
    log "Rebuilding web services (backend + frontend)..."
    DOCKER_BUILDKIT=1 $COMPOSE build --pull --progress=plain backend frontend
    log "Build complete. Run './run-apps.sh web' to start."
}

cmd_build_core() {
    log "Rebuilding PrivaAgent Python core (shows full pip install progress)..."
    DOCKER_BUILDKIT=1 $COMPOSE build --no-cache --progress=plain core
    log "Core build complete. Run './run-apps.sh start' to start."
}

cmd_rebuild() {
    local services=("${@}")
    if [[ ${#services[@]} -eq 0 ]]; then
        # rebuild all
        log "Rebuilding all images..."
        DOCKER_BUILDKIT=1 $COMPOSE build --pull --progress=plain
        log "Restarting all services..."
        $COMPOSE up -d --force-recreate
    else
        log "Rebuilding: ${services[*]}"
        DOCKER_BUILDKIT=1 $COMPOSE build --pull --progress=plain "${services[@]}"
        log "Restarting: ${services[*]}"
        $COMPOSE up -d --force-recreate --no-deps "${services[@]}"
    fi
    echo ""
    log "Rebuild complete."
    log "  Frontend  → http://localhost:${FRONTEND_PORT_EXPOSE:-3030}"
    [[ -n "${BACKEND_PORT_EXPOSE:-}" ]] && log "  API (Host)→ http://localhost:${BACKEND_PORT_EXPOSE}"
}

cmd_web_logs() {
    log "Tailing backend + frontend logs..."
    $COMPOSE logs -f --tail=100 backend frontend
}

# ── Examples ──────────────────────────────────────────────────────────────────

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
    $COMPOSE run --rm core python "$example"
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
    echo -e "${CYAN}PrivaAgent Docker Manager${NC}"
    echo ""
    echo "Usage: $0 <command> [args...]"
    echo ""
    echo -e "${CYAN}General:${NC}"
    echo "  build             Build all Docker images"
    echo "  up                Start all services (detached)"
    echo "  down              Stop all services"
    echo "  restart [svc]     Restart services"
    echo "  logs [svc]        Tail logs (all or specific service)"
    echo "  status            Show running containers + access URLs"
    echo "  shell [svc]       Open a shell (default: core)"
    echo "  run-example       List or run a specific example script"
    echo "  clean             Remove containers, networks, and volumes"
    echo ""
    echo -e "${CYAN}Web UI:${NC}"
    echo "  web               Start backend + frontend (Docker)"
    echo "  web-dev           Start backend (Docker) + frontend dev server (hot-reload)"
    echo "  web-build         Rebuild web images only"
    echo "  web-logs          Tail backend + frontend logs"
    echo "  build-core        Rebuild Python core image with full pip progress output"
    echo "  rebuild [svc...]  Rebuild image(s) then restart — all if none specified"
    echo ""
    echo -e "${CYAN}Services:${NC}"
    echo "  core              Python PrivaAgent runtime"
    echo "  backend           Go/Fiber REST API  (port 8088)"
    echo "  frontend          React dashboard    (port 3030)"
    echo "  redis             Redis memory backend"
    echo "  jaeger            Tracing UI           (port 16686)"
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo "  $0 web                          # start web UI only"
    echo "  $0 web-dev                      # frontend hot-reload dev mode"
    echo "  $0 up                           # start everything"
    echo "  $0 logs backend           # tail backend logs"
    echo "  $0 shell backend          # shell into backend container"
    echo "  $0 run-example examples/workflows/multiagent_conversation/main.py"
    echo "  $0 down"
}

# ─── Main ────────────────────────────────────────────────────────────────────

main() {
    check_deps
    ensure_env
    # Load env vars for script logic (e.g. BACKEND_PORT_EXPOSE)
    if [[ -f "$ENV_FILE" ]]; then
        set -a
        source "$ENV_FILE"
        set +a
    fi

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
        web)          cmd_web ;;
        web-dev)      cmd_web_dev ;;
        web-build)    cmd_web_build ;;
        web-logs)     cmd_web_logs ;;
        build-core)   cmd_build_core ;;
        rebuild)      cmd_rebuild "$@" ;;
        help|--help|-h|*) usage ;;
    esac
}

main "$@"
