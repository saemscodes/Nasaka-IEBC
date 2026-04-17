#!/usr/bin/env bash
# =============================================================================
# NASAKA IEBC Geocoding & Enrichment Pipeline — Full Sequential Runner
# Phase 5 v3 | CEKA / Nasaka IEBC
#
# Usage:
#   bash scraper/run_pipeline.sh [--skip-isochrones] [--dry-run]
#
# Flags:
#   --skip-isochrones    Skip Step 6 (ORS isochrones, ~10 hrs). Run later manually.
#   --dry-run            Validate env + runtimes only. No API calls, no DB writes.
#
# All steps are resumable: re-run the full script after failures.
# Logs are written to scraper/logs/pipeline_<timestamp>.log
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
TIMESTAMP=$(date +"%Y%m%dT%H%M%S")
LOG_FILE="${LOG_DIR}/pipeline_${TIMESTAMP}.log"
SKIP_ISOCHRONES=false
DRY_RUN=false

mkdir -p "${LOG_DIR}"

# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------
for arg in "$@"; do
  case $arg in
    --skip-isochrones) SKIP_ISOCHRONES=true ;;
    --dry-run)         DRY_RUN=true ;;
  esac
done

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log() {
  local level="$1"; shift
  local msg="$*"
  local ts; ts=$(date +"%Y-%m-%dT%H:%M:%S")
  printf "[%s] [%-5s] %s\n" "${ts}" "${level}" "${msg}" | tee -a "${LOG_FILE}"
}

log_step() {
  printf "\n" | tee -a "${LOG_FILE}"
  log "STEP" "================================================================"
  log "STEP" "$*"
  log "STEP" "================================================================"
}

# ---------------------------------------------------------------------------
# Environment validation
# ---------------------------------------------------------------------------
check_env() {
  log "INFO" "Validating environment variables..."
  local missing=()

  # Must-have for geocoding
  for var in SUPABASE_DB_POOLED_URL GOOGLE_MAPS_API_KEY; do
    [[ -z "${!var:-}" ]] && missing+=("$var")
  done

  # At least one LLM key needed for String B Tier 2
  local has_llm=false
  for var in VITE_GROK_API_KEY VITE_GEMINI_API_KEY OPENAI_API_KEY; do
    [[ -n "${!var:-}" ]] && has_llm=true
  done
  [[ "$has_llm" == "false" ]] && missing+=("VITE_GROK_API_KEY or VITE_GEMINI_API_KEY or OPENAI_API_KEY (at least one required)")

  # ORS key warning (not fatal — ORS works with key or without on low volume)
  if [[ -z "${ORS_API_KEY:-}" ]]; then
    log "WARN" "ORS_API_KEY not set. Step 6 (isochrones) will use anonymous ORS access (lower quota)."
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    log "ERROR" "Missing required environment variables:"
    for v in "${missing[@]}"; do log "ERROR" "  - $v"; done
    log "ERROR" "Set them in .env or export them before running."
    exit 1
  fi

  log "INFO" "Environment OK."
}

# ---------------------------------------------------------------------------
# Runtime validation
# ---------------------------------------------------------------------------
check_runtimes() {
  log "INFO" "Checking runtimes..."
  local missing_rt=()
  for cmd in python3 node npx; do
    if ! command -v "$cmd" &>/dev/null; then
      missing_rt+=("$cmd")
    fi
  done

  # ts-node check
  if ! npx ts-node --version &>/dev/null 2>&1; then
    log "WARN" "ts-node not globally available — will use npx ts-node (slower first run)."
  fi

  if [[ ${#missing_rt[@]} -gt 0 ]]; then
    log "ERROR" "Required runtimes not found: ${missing_rt[*]}"
    exit 1
  fi

  log "INFO" "Runtimes OK: python3=$(python3 --version 2>&1), node=$(node --version)"
}

# ---------------------------------------------------------------------------
# Step runner — times each step, tees to log, halts on non-zero exit
# ---------------------------------------------------------------------------
run_step() {
  local step_id="$1"
  local label="$2"
  shift 2
  local cmd=("$@")

  log_step "Step ${step_id}: ${label}"
  log "INFO" "Command: ${cmd[*]}"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN" "Skipping: ${cmd[*]}"
    return 0
  fi

  local start; start=$(date +%s)

  # Run command; capture exit code without triggering set -e
  set +e
  "${cmd[@]}" 2>&1 | tee -a "${LOG_FILE}"
  local exit_code=${PIPESTATUS[0]}
  set -e

  local end; end=$(date +%s)
  local elapsed=$(( end - start ))
  local elapsed_fmt; elapsed_fmt=$(printf '%02d:%02d' $((elapsed/60)) $((elapsed%60)))

  if [[ $exit_code -ne 0 ]]; then
    log "ERROR" "Step ${step_id} FAILED (exit ${exit_code}) after ${elapsed_fmt}"
    log "ERROR" "Pipeline halted. Fix the error above, then re-run."
    log "ERROR" "All scripts are resumable — already-processed records are skipped."
    log "ERROR" "Log file: ${LOG_FILE}"
    exit ${exit_code}
  fi

  log "INFO" "Step ${step_id} DONE in ${elapsed_fmt}"
}

# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
main() {
  log "INFO" "========================================================"
  log "INFO" "NASAKA IEBC Geocoding & Enrichment Pipeline — Phase 5 v3"
  log "INFO" "Run ID:          ${TIMESTAMP}"
  log "INFO" "Log file:        ${LOG_FILE}"
  log "INFO" "Skip isochrones: ${SKIP_ISOCHRONES}"
  log "INFO" "Dry run:         ${DRY_RUN}"
  log "INFO" "Working dir:     ${ROOT_DIR}"
  log "INFO" "========================================================"

  check_env
  check_runtimes

  # Load .env if present (for local runs; GitHub Actions injects env directly)
  if [[ -f "${ROOT_DIR}/.env" ]]; then
    set -o allexport
    source "${ROOT_DIR}/.env"
    set +o allexport
    log "INFO" ".env loaded from ${ROOT_DIR}/.env"
  fi

  # ── Step 0a: Deduplication cluster detection ─────────────────────────────
  run_step "0a" "Deduplication detect clusters + CSV export" \
    python3 "${SCRIPT_DIR}/dedup_prepass.py" --detect-only

  # ── Step 0b: Administrative backfill + 3-tier orphan resolution ──────────
  run_step "0b" "Administrative backfill + orphan resolution (cols 25-30)" \
    python3 "${SCRIPT_DIR}/orphan_resolver.py"

  # ── Step 1: Google Geocoding — String A ──────────────────────────────────
  run_step "1" "Google Geocoding String A (geocoder_v5.ts)" \
    npx ts-node "${SCRIPT_DIR}/geocoder_v5.ts"

  # ── Step 0a (2nd pass): Propagate resolved coords to dedup siblings ───────
  run_step "0a-propagate" "Dedup coordinate propagation to siblings (second pass)" \
    python3 "${SCRIPT_DIR}/dedup_prepass.py" --propagate-only

  # ── Step 2: Google Places — String B Tier 1 ──────────────────────────────
  run_step "2" "Google Places landmark enrichment String B Tier 1 (places_nlp.ts)" \
    npx ts-node "${SCRIPT_DIR}/places_nlp.ts"

  # ── Step 3: Groq/Gemini NLP — String B Tier 2 ────────────────────────────
  run_step "3" "LLM landmark enrichment String B Tier 2 (nlp-enrichment-v2.ts)" \
    npx ts-node "${SCRIPT_DIR}/nlp-enrichment-v2.ts"

  # ── Step 4: Google Elevation Batch ───────────────────────────────────────
  run_step "4" "Google Elevation batch 512/req (elevation_batch.ts)" \
    npx ts-node "${SCRIPT_DIR}/elevation_batch.ts"

  # ── Step 5: Finalize + HITL export + 30-column audit ─────────────────────
  run_step "5" "Finalize geocode_verified + HITL export + 30-col audit (finalize_geocode.py)" \
    python3 "${SCRIPT_DIR}/finalize_geocode.py"

  # ── Step 6 (optional): ORS isochrones + walking_effort ───────────────────
  if [[ "$SKIP_ISOCHRONES" == "true" ]]; then
    log "INFO" ""
    log "INFO" "Step 6 SKIPPED (--skip-isochrones active)."
    log "INFO" "Run manually when ready:"
    log "INFO" "  npx ts-node scraper/isochrone_ors.ts"
    log "INFO" "(~10 hours for full 24,369 records at ORS free tier 40 req/min)"
  else
    run_step "6" "ORS isochrones 15/30/45min + walking_effort (isochrone_ors.ts)" \
      npx ts-node "${SCRIPT_DIR}/isochrone_ors.ts"
  fi

  # ── Summary ───────────────────────────────────────────────────────────────
  log_step "Pipeline Complete"
  log "INFO" "Run ID: ${TIMESTAMP}"
  log "INFO" "Full log: ${LOG_FILE}"
  log "INFO" ""
  log "INFO" "Inspect these output files:"
  log "INFO" "  scraper/dedup_clusters.csv    — duplicate building clusters"
  log "INFO" "  scraper/orphan_inspection.csv — unresolved ward/caw_code orphans (HITL required)"
  log "INFO" "  scraper/hitl_geocode.csv      — low-confidence geocode flags (HITL required)"
  log "INFO" ""
  log "INFO" "Pipeline finished successfully."
}

main "$@"
