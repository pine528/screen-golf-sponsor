#!/bin/bash
# 배포 전 사전 점검 스크립트
# 사용법: ./preflight.sh
#
# 모든 체크가 통과해야 배포 진행 가능
#
# 필수 환경변수:
#   DATABASE_URL - PostgreSQL 연결 문자열
#   JWT_SECRET - JWT 시크릿 (기본값 사용 금지)

set -euo pipefail

# 색상 출력
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_pass() {
  echo -e "  ${GREEN}✓${NC} $1"
}

log_fail() {
  echo -e "  ${RED}✗${NC} $1"
}

log_warn() {
  echo -e "  ${YELLOW}!${NC} $1"
}

log_skip() {
  echo -e "  ${CYAN}-${NC} $1 (skipped)"
}

# 결과 추적
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0

check_pass() {
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
}

check_fail() {
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
}

check_warn() {
  CHECKS_WARNED=$((CHECKS_WARNED + 1))
}

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              PREFLIGHT CHECK                                   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ===================================================
# 1. 필수 환경변수 확인
# ===================================================
echo -e "${CYAN}[1/6] Environment Variables${NC}"

REQUIRED_ENVS=("DATABASE_URL" "JWT_SECRET")
PRODUCTION_ENVS=("PORTONE_API_KEY" "PORTONE_API_SECRET")

for var in "${REQUIRED_ENVS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    log_fail "$var: NOT SET"
    check_fail
  else
    log_pass "$var: Set"
    check_pass
  fi
done

# 운영 환경 추가 체크
if [[ "${NODE_ENV:-}" == "production" ]]; then
  for var in "${PRODUCTION_ENVS[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      log_fail "$var: NOT SET (required in production)"
      check_fail
    else
      log_pass "$var: Set"
      check_pass
    fi
  done

  # JWT_SECRET 기본값 체크
  if [[ "${JWT_SECRET:-}" == "default-secret-change-me" ]]; then
    log_fail "JWT_SECRET: Using default value in production!"
    check_fail
  fi
fi

echo ""

# ===================================================
# 2. 데이터베이스 연결 확인
# ===================================================
echo -e "${CYAN}[2/6] Database Connection${NC}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  log_skip "DATABASE_URL not set"
else
  if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
    log_pass "Database connection: OK"
    check_pass
  else
    log_fail "Database connection: FAILED"
    check_fail
  fi
fi

echo ""

# ===================================================
# 3. Pending Migrations 확인
# ===================================================
echo -e "${CYAN}[3/6] Pending Migrations${NC}"

# prisma CLI 확인
if command -v npx &> /dev/null; then
  # Prisma migrate status 실행
  MIGRATE_OUTPUT=$(npx prisma migrate status 2>&1 || true)

  if echo "$MIGRATE_OUTPUT" | grep -q "Database schema is up to date"; then
    log_pass "Database schema: Up to date"
    check_pass
  elif echo "$MIGRATE_OUTPUT" | grep -q "Following migration have not yet been applied"; then
    PENDING_COUNT=$(echo "$MIGRATE_OUTPUT" | grep -c "not yet been applied" || echo "1")
    log_fail "Pending migrations found!"
    log_warn "Run 'npx prisma migrate deploy' before deployment"
    check_fail
  elif echo "$MIGRATE_OUTPUT" | grep -q "error"; then
    log_warn "Could not check migration status"
    check_warn
  else
    log_pass "Migration check: OK"
    check_pass
  fi
else
  log_skip "npx not available"
fi

echo ""

# ===================================================
# 4. TypeScript 빌드 확인
# ===================================================
echo -e "${CYAN}[4/6] TypeScript Build${NC}"

if [[ -d "dist" ]]; then
  # dist 폴더 존재 확인
  DIST_FILES=$(find dist -name "*.js" 2>/dev/null | head -5)
  if [[ -n "$DIST_FILES" ]]; then
    log_pass "Build output: Found in dist/"
    check_pass

    # index.js 확인
    if [[ -f "dist/index.js" ]]; then
      log_pass "Entry point: dist/index.js exists"
      check_pass
    else
      log_fail "Entry point: dist/index.js not found"
      check_fail
    fi
  else
    log_fail "Build output: dist/ is empty"
    check_fail
  fi
else
  log_fail "Build output: dist/ directory not found"
  log_warn "Run 'npm run build' before deployment"
  check_fail
fi

echo ""

# ===================================================
# 5. Health Endpoint 확인 (실행 중인 경우)
# ===================================================
echo -e "${CYAN}[5/6] Health Check${NC}"

API_URL="${API_URL:-http://localhost:4000}"

if curl -sf "${API_URL}/api/health" > /dev/null 2>&1; then
  HEALTH_RESPONSE=$(curl -s "${API_URL}/api/health")
  log_pass "Health endpoint: OK"
  check_pass

  # 상세 상태 확인
  if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    log_pass "API status: Healthy"
    check_pass
  fi
else
  log_skip "Server not running at ${API_URL}"
fi

echo ""

# ===================================================
# 6. 디스크 공간 확인
# ===================================================
echo -e "${CYAN}[6/6] Disk Space${NC}"

# 현재 디렉토리의 디스크 사용량 확인
DISK_USAGE=$(df -h . 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%' || echo "0")
if [[ "$DISK_USAGE" -gt 90 ]]; then
  log_fail "Disk usage: ${DISK_USAGE}% (critical!)"
  check_fail
elif [[ "$DISK_USAGE" -gt 80 ]]; then
  log_warn "Disk usage: ${DISK_USAGE}% (warning)"
  check_warn
else
  log_pass "Disk usage: ${DISK_USAGE}%"
  check_pass
fi

echo ""

# ===================================================
# 결과 요약
# ===================================================
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   PREFLIGHT SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"

echo ""
echo "  Passed:  $CHECKS_PASSED"
echo "  Failed:  $CHECKS_FAILED"
echo "  Warned:  $CHECKS_WARNED"
echo ""

if [[ $CHECKS_FAILED -gt 0 ]]; then
  echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║              PREFLIGHT FAILED                                  ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "Please fix the failed checks before deploying."
  exit 1
else
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║              PREFLIGHT PASSED                                  ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  if [[ $CHECKS_WARNED -gt 0 ]]; then
    echo "Note: $CHECKS_WARNED warning(s) found. Please review before proceeding."
  fi
  echo "Ready to deploy!"
  exit 0
fi
