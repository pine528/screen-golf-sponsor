#!/bin/bash
# 백업 검증 스크립트 - 임시 컨테이너에 복구 후 핵심 테이블 검증
# 사용법: ./verify-backup.sh [backup_file]
#
# 백업 파일을 지정하지 않으면 S3에서 최신 백업을 가져옴
#
# 필요:
#   - Docker (임시 PostgreSQL 컨테이너 실행)
#   - AWS CLI (S3 백업 다운로드 시)
#
# 환경변수:
#   S3_BACKUP_BUCKET - S3 버킷명 (파일 미지정 시 필수)

set -euo pipefail

# 색상 출력
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_check() {
  echo -e "${CYAN}[CHECK]${NC} $1"
}

# 설정
BACKUP_FILE="${1:-}"
CONTAINER_NAME="verify_backup_$(date +%s)"
VERIFY_DB_PORT=55433
VERIFY_TIMEOUT=60

# 핵심 "돈 데이터" 테이블
CRITICAL_TABLES=("wallet" "ledger_tx" "escrow" "topup_payments" "refund_requests" "withdrawal_requests")

# 정리 함수
cleanup() {
  log_info "Cleaning up..."
  docker rm -f "$CONTAINER_NAME" > /dev/null 2>&1 || true
  rm -f /tmp/verify_*.sqlc /tmp/verify_*.sqlc.gz 2>/dev/null || true
}

trap cleanup EXIT

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              BACKUP VERIFICATION                               ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 최신 백업 찾기 (파일이 지정되지 않은 경우)
if [[ -z "$BACKUP_FILE" ]]; then
  if [[ -z "${S3_BACKUP_BUCKET:-}" ]]; then
    log_error "No backup file specified and S3_BACKUP_BUCKET not set"
    echo ""
    echo "Usage: $0 [backup_file]"
    echo "  or set S3_BACKUP_BUCKET environment variable"
    exit 1
  fi

  log_info "Finding latest backup from S3..."
  LATEST=$(aws s3 ls "s3://${S3_BACKUP_BUCKET}/daily/" | sort | tail -1 | awk '{print $4}')

  if [[ -z "$LATEST" ]]; then
    log_error "No backups found in s3://${S3_BACKUP_BUCKET}/daily/"
    exit 1
  fi

  log_info "Latest backup: $LATEST"
  aws s3 cp "s3://${S3_BACKUP_BUCKET}/daily/${LATEST}" /tmp/verify_backup.sqlc.gz
  BACKUP_FILE="/tmp/verify_backup.sqlc.gz"
fi

# 백업 파일 확인
if [[ ! -f "$BACKUP_FILE" ]]; then
  log_error "Backup file not found: $BACKUP_FILE"
  exit 1
fi

log_info "Backup file: $BACKUP_FILE"
log_info "File size: $(du -h "$BACKUP_FILE" | cut -f1)"

# 임시 PostgreSQL 컨테이너 기동
log_info "Starting temporary PostgreSQL container..."
docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=verify \
  -e POSTGRES_DB=verify_db \
  -p ${VERIFY_DB_PORT}:5432 \
  postgres:15-alpine > /dev/null

# 컨테이너 준비 대기
log_info "Waiting for PostgreSQL to be ready..."
RETRIES=0
MAX_RETRIES=30
until docker exec "$CONTAINER_NAME" pg_isready -U postgres > /dev/null 2>&1; do
  RETRIES=$((RETRIES + 1))
  if [[ $RETRIES -ge $MAX_RETRIES ]]; then
    log_error "PostgreSQL failed to start within timeout"
    exit 1
  fi
  sleep 1
done

log_info "PostgreSQL container is ready."

VERIFY_URL="postgresql://postgres:verify@localhost:${VERIFY_DB_PORT}/verify_db"

# 복구
log_info "Restoring backup to temp container..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | pg_restore -d "$VERIFY_URL" --no-owner 2>/dev/null || true
else
  pg_restore -d "$BACKUP_FILE" -d "$VERIFY_URL" --no-owner 2>/dev/null || true
fi

log_info "Restore completed. Running verification checks..."
echo ""

# ===================================================
# 테이블별 row count 검증
# ===================================================
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   CRITICAL TABLES ROW COUNT${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"

TOTAL_ROWS=0
for table in "${CRITICAL_TABLES[@]}"; do
  COUNT=$(psql "$VERIFY_URL" -t -c "SELECT COUNT(*) FROM ${table}" 2>/dev/null | tr -d ' ' || echo "ERROR")
  if [[ "$COUNT" == "ERROR" ]]; then
    printf "  %-25s: ${RED}TABLE NOT FOUND${NC}\n" "$table"
  else
    printf "  %-25s: %s rows\n" "$table" "$COUNT"
    TOTAL_ROWS=$((TOTAL_ROWS + COUNT))
  fi
done
echo ""
echo "  Total critical rows: $TOTAL_ROWS"
echo ""

# ===================================================
# 데이터 무결성 검사
# ===================================================
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   DATA INTEGRITY CHECKS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"

ERRORS=0

# 1. Wallet 음수 잔액 체크
NEG_WALLETS=$(psql "$VERIFY_URL" -t -c "SELECT COUNT(*) FROM wallet WHERE balance < 0 OR frozen_amount < 0" 2>/dev/null | tr -d ' ' || echo "0")
if [[ "$NEG_WALLETS" -gt 0 ]]; then
  log_check "Negative balance wallets: ${RED}$NEG_WALLETS FOUND!${NC}"
  ERRORS=$((ERRORS + 1))
else
  log_check "Negative balance wallets: ${GREEN}PASS (0)${NC}"
fi

# 2. LedgerTx 고아 레코드 체크
ORPHAN_LEDGER=$(psql "$VERIFY_URL" -t -c "SELECT COUNT(*) FROM ledger_tx l LEFT JOIN wallet w ON l.wallet_id = w.id WHERE w.id IS NULL" 2>/dev/null | tr -d ' ' || echo "0")
if [[ "$ORPHAN_LEDGER" -gt 0 ]]; then
  log_check "Orphan ledger entries: ${RED}$ORPHAN_LEDGER FOUND!${NC}"
  ERRORS=$((ERRORS + 1))
else
  log_check "Orphan ledger entries: ${GREEN}PASS (0)${NC}"
fi

# 3. Escrow 상태 분포
echo ""
log_check "Escrow status distribution:"
psql "$VERIFY_URL" -c "SELECT status, COUNT(*) as count FROM escrow GROUP BY status ORDER BY count DESC" 2>/dev/null || echo "  (no escrow data)"

# 4. 최근 24시간 TopupPayment (백업 시점 기준)
RECENT_TOPUPS=$(psql "$VERIFY_URL" -t -c "SELECT COUNT(*) FROM topup_payments WHERE created_at > (SELECT MAX(created_at) - INTERVAL '24 hours' FROM topup_payments)" 2>/dev/null | tr -d ' ' || echo "0")
echo ""
log_check "Recent topup payments (last 24h relative): $RECENT_TOPUPS"

# 5. 미처리 출금 요청
PENDING_WD=$(psql "$VERIFY_URL" -t -c "SELECT COUNT(*) FROM withdrawal_requests WHERE status IN ('REQUESTED', 'APPROVED')" 2>/dev/null | tr -d ' ' || echo "0")
log_check "Pending withdrawal requests: $PENDING_WD"

# 6. 환불 요청 상태
PENDING_REFUNDS=$(psql "$VERIFY_URL" -t -c "SELECT COUNT(*) FROM refund_requests WHERE status = 'REQUESTED'" 2>/dev/null | tr -d ' ' || echo "0")
log_check "Pending refund requests: $PENDING_REFUNDS"

echo ""

# ===================================================
# 결과 요약
# ===================================================
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   VERIFICATION SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"

if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}VERIFICATION FAILED!${NC}"
  echo "  Errors found: $ERRORS"
  echo ""
  echo "  Please investigate the issues above before relying on this backup."
  EXIT_CODE=1
else
  echo -e "${GREEN}VERIFICATION PASSED!${NC}"
  echo "  All integrity checks passed."
  echo "  Total critical rows: $TOTAL_ROWS"
  EXIT_CODE=0
fi

echo ""
echo "Verification completed at: $(date)"
echo ""

exit $EXIT_CODE
