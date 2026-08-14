#!/usr/bin/env bash
# FreeLearn Radar — Vercel environment setup helper.
#
# Usage:
#   # 1) Print env vars to paste into Vercel Dashboard
#   ADMIN_EMAIL=you@example.com APP_URL=https://your-app.vercel.app \
#     DATABASE_URL='postgresql://...' ./scripts/vercel-setup.sh print
#
#   # 2) Push env vars via Vercel API (requires token + project id/name)
#   VERCEL_TOKEN=... VERCEL_PROJECT=freelearn-radar \
#     ADMIN_EMAIL=you@example.com APP_URL=https://your-app.vercel.app \
#     DATABASE_URL='postgresql://...' ./scripts/vercel-setup.sh push
#
#   # 3) Show post-deploy migrate/seed commands
#   DATABASE_URL='postgresql://...' ADMIN_EMAIL=you@example.com \
#     ADMIN_BOOTSTRAP_PASSWORD='...' ./scripts/vercel-setup.sh post-deploy

set -euo pipefail

MODE="${1:-print}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

random_secret() {
  local bytes="$1"
  openssl rand -base64 "$bytes" | tr -d '\n'
}

resolve_auth_secret() {
  if [[ -n "${AUTH_SECRET:-}" ]]; then
    printf '%s' "$AUTH_SECRET"
    return
  fi
  random_secret 32
}

resolve_cron_secret() {
  if [[ -n "${CRON_SECRET:-}" ]]; then
    printf '%s' "$CRON_SECRET"
    return
  fi
  random_secret 24
}

resolve_admin_password() {
  if [[ -n "${ADMIN_BOOTSTRAP_PASSWORD:-}" ]]; then
    printf '%s' "$ADMIN_BOOTSTRAP_PASSWORD"
    return
  fi
  random_secret 18
}

validate_required() {
  local missing=0
  for var in "$@"; do
    if [[ -z "${!var:-}" ]]; then
      echo "Missing required env var: $var" >&2
      missing=1
    fi
  done
  if [[ "$missing" -eq 1 ]]; then
    exit 1
  fi
}

print_neon_steps() {
  cat <<'EOF'

=== Bước 1: Tạo PostgreSQL trên Vercel (Neon) ===

1. Mở Vercel Dashboard → chọn project freelearn-radar
2. Tab "Storage" → "Create Database" → chọn "Neon"
3. Chọn region gần user (Singapore / Tokyo nếu target VN)
4. Sau khi tạo xong, Vercel tự inject biến DATABASE_URL vào project
5. Copy giá trị DATABASE_URL (Settings → Environment Variables)

Nếu chưa thấy DATABASE_URL:
- Storage → Neon database → tab ".env.local" / "Connection string"
- Dùng pooled connection string (recommended cho serverless)

EOF
}

declare -A ENV_VARS

load_env_vars() {
  validate_required ADMIN_EMAIL APP_URL DATABASE_URL

  local auth_secret cron_secret admin_password
  auth_secret="$(resolve_auth_secret)"
  cron_secret="$(resolve_cron_secret)"
  admin_password="$(resolve_admin_password)"

  if [[ ${#auth_secret} -lt 32 ]]; then
    echo "AUTH_SECRET must be at least 32 characters" >&2
    exit 1
  fi
  if [[ ${#cron_secret} -lt 16 ]]; then
    echo "CRON_SECRET must be at least 16 characters" >&2
    exit 1
  fi

  ENV_VARS[DATABASE_URL]="$DATABASE_URL"
  ENV_VARS[APP_URL]="$APP_URL"
  ENV_VARS[AUTH_SECRET]="$auth_secret"
  ENV_VARS[CRON_SECRET]="$cron_secret"
  ENV_VARS[ADMIN_EMAILS]="$ADMIN_EMAIL"
  ENV_VARS[ADMIN_BOOTSTRAP_PASSWORD]="$admin_password"
  ENV_VARS[SEED_SAMPLE_COURSES]="false"
  ENV_VARS[DISCOVERY_QUERY_LIMIT]="15"
  ENV_VARS[DISCOVERY_RESULT_LIMIT]="5"
  ENV_VARS[AI_ANALYSIS_LIMIT]="30"
  ENV_VARS[MAX_VERIFICATIONS_PER_RUN]="25"
  ENV_VARS[NVIDIA_BASE_URL]="https://integrate.api.nvidia.com/v1"
  ENV_VARS[NVIDIA_MODEL]="nvidia/nemotron-3-super-120b-a12b"

  if [[ -n "${TAVILY_API_KEY:-}" ]]; then
    ENV_VARS[TAVILY_API_KEY]="$TAVILY_API_KEY"
  fi
  if [[ -n "${NVIDIA_API_KEY:-}" ]]; then
    ENV_VARS[NVIDIA_API_KEY]="$NVIDIA_API_KEY"
  fi
}

print_env_table() {
  print_neon_steps

  cat <<EOF
=== Bước 2: Paste vào Vercel → Settings → Environment Variables ===

Target: Production (+ Preview nếu muốn test PR)

EOF

  for key in DATABASE_URL APP_URL AUTH_SECRET CRON_SECRET ADMIN_EMAILS ADMIN_BOOTSTRAP_PASSWORD \
    SEED_SAMPLE_COURSES DISCOVERY_QUERY_LIMIT DISCOVERY_RESULT_LIMIT AI_ANALYSIS_LIMIT \
    MAX_VERIFICATIONS_PER_RUN NVIDIA_BASE_URL NVIDIA_MODEL TAVILY_API_KEY NVIDIA_API_KEY; do
    if [[ -n "${ENV_VARS[$key]+x}" ]]; then
      printf '%-28s %s\n' "$key" "${ENV_VARS[$key]}"
    fi
  done

  cat <<EOF

Lưu ý:
- Lưu ADMIN_BOOTSTRAP_PASSWORD ở nơi an toàn (dùng login /admin/login)
- TAVILY_API_KEY và NVIDIA_API_KEY có thể thêm sau khi có key
- Sau deploy lần đầu, cập nhật APP_URL đúng domain rồi Redeploy

=== Bước 3: Deploy ===

Vercel Dashboard → Deployments → Redeploy (hoặc push commit lên main)

Build settings (mặc định OK):
- Framework: Next.js
- Build Command: npm run build
- Node.js: 22.x (package.json engines)

=== Bước 4: Chạy migration + seed (từ máy local) ===

export DATABASE_URL='${ENV_VARS[DATABASE_URL]}'
export ADMIN_EMAILS='${ENV_VARS[ADMIN_EMAILS]}'
export ADMIN_BOOTSTRAP_PASSWORD='${ENV_VARS[ADMIN_BOOTSTRAP_PASSWORD]}'

npm install
npm run db:migrate:run
npm run db:seed

=== Bước 5: Smoke test ===

curl "${ENV_VARS[APP_URL]}/api/health"
curl "${ENV_VARS[APP_URL]}/api/health?deep=1"
curl -H "Authorization: Bearer ${ENV_VARS[CRON_SECRET]}" "${ENV_VARS[APP_URL]}/api/cron/discover"

Mở ${ENV_VARS[APP_URL]}/admin/login và đăng nhập bằng ${ENV_VARS[ADMIN_EMAILS]}

EOF
}

push_env_to_vercel() {
  require_cmd curl
  validate_required VERCEL_TOKEN VERCEL_PROJECT

  local team_query=""
  if [[ -n "${VERCEL_TEAM_ID:-}" ]]; then
    team_query="?teamId=${VERCEL_TEAM_ID}"
  fi

  for key in "${!ENV_VARS[@]}"; do
    local value="${ENV_VARS[$key]}"
    local payload
    payload=$(printf '{"key":"%s","value":"%s","type":"encrypted","target":["production","preview"]}' \
      "$key" "$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\\"/g')")

    echo "Setting $key ..."
    curl -fsS -X POST \
      "https://api.vercel.com/v10/projects/${VERCEL_PROJECT}/env${team_query}" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$payload" >/dev/null
  done

  echo "Done. Redeploy project on Vercel to apply new env vars."
}

print_post_deploy() {
  validate_required DATABASE_URL ADMIN_EMAIL ADMIN_BOOTSTRAP_PASSWORD

  cat <<EOF
Run these commands locally after Vercel deploy succeeds:

export DATABASE_URL='${DATABASE_URL}'
export ADMIN_EMAILS='${ADMIN_EMAIL}'
export ADMIN_BOOTSTRAP_PASSWORD='${ADMIN_BOOTSTRAP_PASSWORD}'

npm install
npm run db:migrate:run
npm run db:seed
EOF
}

case "$MODE" in
  print)
    require_cmd openssl
    load_env_vars
    print_env_table
    ;;
  push)
    require_cmd openssl
    load_env_vars
    push_env_to_vercel
    ;;
  post-deploy)
    print_post_deploy
    ;;
  neon)
    print_neon_steps
    ;;
  *)
    echo "Usage: $0 {print|push|post-deploy|neon}" >&2
    exit 1
    ;;
esac
