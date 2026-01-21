#!/bin/bash
# PostgreSQL 복구 스크립트
# 사용법: ./restore.sh <s3_path_or_local_file> [--force]
#
# 예시:
#   ./restore.sh /tmp/backups/screengolf_20240115_0330.sqlc.gz
#   ./restore.sh s3://my-bucket/daily/screengolf_20240115_0330.sqlc.gz --force
#
# 필수 환경변수:
#   DATABASE_URL - PostgreSQL 연결 문자열

set -euo pipefail

# 색상 출력
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

log_error() {
  echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# 인수 확인
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup_file_or_s3_path> [--force]"
  echo ""
  echo "Examples:"
  echo "  $0 /tmp/backups/screengolf_20240115_0330.sqlc.gz"
  echo "  $0 s3://bucket/daily/screengolf_20240115.sqlc.gz --force"
  exit 1
fi

BACKUP_PATH="$1"
FORCE="${2:-}"
RESTORE_FILE="/tmp/restore_$(date +%s).sqlc"

# 필수 환경변수 확인
if [[ -z "${DATABASE_URL:-}" ]]; then
  log_error "DATABASE_URL environment variable is required"
  exit 1
fi

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              DATABASE RESTORE - DANGER ZONE                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 운영 안전 확인 (--force가 없으면)
if [[ "$FORCE" != "--force" ]]; then
  echo -e "${RED}WARNING: This will OVERWRITE the current database!${NC}"
  echo ""
  echo "Target database: $(echo $DATABASE_URL | sed 's/:[^:@]*@/:****@/')"
  echo "Backup source: $BACKUP_PATH"
  echo ""
  echo -e "${YELLOW}This action is IRREVERSIBLE.${NC}"
  echo ""
  read -p "Type 'RESTORE' to confirm: " CONFIRM
  if [[ "$CONFIRM" != "RESTORE" ]]; then
    log_warn "Restore aborted by user."
    exit 1
  fi
  echo ""
fi

# 복구 전 현재 상태 스냅샷
log_info "Taking pre-restore snapshot of critical tables..."
PRE_SNAPSHOT="/tmp/pre_restore_$(date +%s).json"
psql "$DATABASE_URL" -t -c "
SELECT json_build_object(
  'timestamp', NOW(),
  'wallet_count', (SELECT COUNT(*) FROM wallet),
  'ledger_tx_count', (SELECT COUNT(*) FROM ledger_tx),
  'escrow_count', (SELECT COUNT(*) FROM escrow)
)
" 2>/dev/null > "$PRE_SNAPSHOT" || echo '{"error": "snapshot failed"}' > "$PRE_SNAPSHOT"
log_info "Pre-restore snapshot saved: $PRE_SNAPSHOT"

# S3 또는 로컬 파일 처리
if [[ "$BACKUP_PATH" == s3://* ]]; then
  log_info "Downloading from S3..."
  if ! aws s3 cp "$BACKUP_PATH" "${RESTORE_FILE}.gz"; then
    log_error "S3 download failed!"
    exit 1
  fi
  log_info "Download completed."
else
  if [[ ! -f "$BACKUP_PATH" ]]; then
    log_error "Backup file not found: $BACKUP_PATH"
    exit 1
  fi
  cp "$BACKUP_PATH" "${RESTORE_FILE}.gz"
fi

# 압축 해제
log_info "Decompressing backup..."
gunzip -c "${RESTORE_FILE}.gz" > "$RESTORE_FILE"
BACKUP_SIZE=$(du -h "$RESTORE_FILE" | cut -f1)
log_info "Backup size (uncompressed): $BACKUP_SIZE"

# 복구 실행
log_info "Starting database restore..."
log_warn "This may take several minutes depending on database size."
echo ""

if pg_restore -d "$DATABASE_URL" --clean --if-exists --no-owner --no-privileges "$RESTORE_FILE" 2>&1 | tee /tmp/restore_log_$(date +%s).log; then
  log_info "pg_restore completed."
else
  # pg_restore는 warning도 exit code 1을 반환할 수 있음
  log_warn "pg_restore finished with warnings (this may be normal)."
fi

# 정리
rm -f "$RESTORE_FILE" "${RESTORE_FILE}.gz"

# 복구 후 검증
log_info "Verifying restore..."
POST_SNAPSHOT="/tmp/post_restore_$(date +%s).json"
psql "$DATABASE_URL" -t -c "
SELECT json_build_object(
  'timestamp', NOW(),
  'wallet_count', (SELECT COUNT(*) FROM wallet),
  'ledger_tx_count', (SELECT COUNT(*) FROM ledger_tx),
  'escrow_count', (SELECT COUNT(*) FROM escrow)
)
" 2>/dev/null > "$POST_SNAPSHOT" || echo '{"error": "verification failed"}' > "$POST_SNAPSHOT"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    RESTORE COMPLETED                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Pre-restore snapshot: $PRE_SNAPSHOT"
echo "Post-restore snapshot: $POST_SNAPSHOT"
echo ""
log_info "Please verify the application is working correctly."
log_info "Run smoke tests: ./scripts/smoke-test.sh"

exit 0
