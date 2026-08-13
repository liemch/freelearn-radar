#!/usr/bin/env bash
# Quick TCP check: can this machine reach Neon PostgreSQL (port 5432)?
set -euo pipefail

HOST="${1:-ep-blue-haze-aznpldbe.c-3.ap-southeast-1.aws.neon.tech}"
PORT="${2:-5432}"

echo "Checking ${HOST}:${PORT} ..."

if command -v nc >/dev/null 2>&1; then
  if nc -z -w 5 "$HOST" "$PORT" 2>/dev/null; then
    echo "OK: port ${PORT} is reachable."
    exit 0
  fi
else
  if timeout 5 bash -c "echo > /dev/tcp/${HOST}/${PORT}" 2>/dev/null; then
    echo "OK: port ${PORT} is reachable."
    exit 0
  fi
fi

echo "FAIL: cannot reach ${HOST}:${PORT} (ETIMEDOUT)."
echo ""
echo "Common causes:"
echo "  - ISP/office firewall blocks outbound PostgreSQL (5432)"
echo "  - VPN interfering with DB connections"
echo ""
echo "Workaround A (recommended): USE_NEON_HTTP=1 npm run db:migrate:run"
echo "Workaround B: paste scripts/neon-bootstrap.sql into Neon SQL Editor"
exit 1
