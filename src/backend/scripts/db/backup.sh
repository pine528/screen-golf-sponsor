#!/bin/bash
# PostgreSQL 일일 백업 스크립트
# 사용법: ./backup.sh [full|incremental]
#
# 필수 환경변수:
#   DATABASE_URL - PostgreSQL 연결 문자열
#
# 선택 환경변수:
#   S3_BACKUP_BUCKET - S3 버킷명 (없으면 로컬만 저장)
#   BACKUP_LOCAL_DIR - 로컬 백업 경로 (기본: /tmp/backups)
#   AWS_DEFAULT_REGION - AWS 리전 (기본: ap-northeast-2)

set -euo pipefail

# 설정
BACKUP_TYPE="${1:-full}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
APP_NAME="screengolf"
BACKUP_FILE="${APP_NAME}_${TIMESTAMP}.sqlc.gz"
S3_BUCKET="${S3_BACKUP_BUCKET:-}"
LOCAL_DIR="${BACKUP_LOCAL_DIR:-/tmp/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

# 색상 출력
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

log_error() {
  echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# 필수 환경변수 확인
if [[ -z "${DATABASE_URL:-}" ]]; then
  log_error "DATABASE_URL environment variable is required"
  exit 1
fi

# 로컬 디렉토리 생성
mkdir -p "$LOCAL_DIR"

log_info "=== PostgreSQL Backup Started ==="
log_info "Backup type: $BACKUP_TYPE"
log_info "Output file: $BACKUP_FILE"

# pg_dump 실행 (custom format + gzip 압축)
log_info "Running pg_dump..."
if pg_dump -Fc "$DATABASE_URL" 2>/dev/null | gzip > "${LOCAL_DIR}/${BACKUP_FILE}"; then
  BACKUP_SIZE=$(du -h "${LOCAL_DIR}/${BACKUP_FILE}" | cut -f1)
  log_info "Local backup created: ${LOCAL_DIR}/${BACKUP_FILE} (${BACKUP_SIZE})"
else
  log_error "pg_dump failed!"
  exit 1
fi

# S3 업로드 (버킷이 설정된 경우)
if [[ -n "$S3_BUCKET" ]]; then
  log_info "Uploading to S3..."

  # 요일에 따른 폴더 결정
  DAY_OF_WEEK=$(date +%u)  # 1=월, 7=일
  DAY_OF_MONTH=$(date +%d)

  # 일일 백업
  if aws s3 cp "${LOCAL_DIR}/${BACKUP_FILE}" "s3://${S3_BUCKET}/daily/${BACKUP_FILE}"; then
    log_info "Uploaded to s3://${S3_BUCKET}/daily/${BACKUP_FILE}"
  else
    log_error "S3 upload failed!"
    exit 1
  fi

  # 주간 백업 (일요일)
  if [[ "$DAY_OF_WEEK" == "7" ]]; then
    aws s3 cp "${LOCAL_DIR}/${BACKUP_FILE}" "s3://${S3_BUCKET}/weekly/${BACKUP_FILE}"
    log_info "Weekly backup: s3://${S3_BUCKET}/weekly/${BACKUP_FILE}"
  fi

  # 월간 백업 (1일)
  if [[ "$DAY_OF_MONTH" == "01" ]]; then
    aws s3 cp "${LOCAL_DIR}/${BACKUP_FILE}" "s3://${S3_BUCKET}/monthly/${BACKUP_FILE}"
    log_info "Monthly backup: s3://${S3_BUCKET}/monthly/${BACKUP_FILE}"
  fi
fi

# 오래된 로컬 백업 정리
log_info "Cleaning up old local backups (older than $RETENTION_DAYS days)..."
find "$LOCAL_DIR" -name "${APP_NAME}_*.sqlc.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

# 핵심 테이블 row count 기록 (검증용)
log_info "Recording critical table stats..."
STATS_FILE="${LOCAL_DIR}/${APP_NAME}_${TIMESTAMP}_stats.json"

# DATABASE_URL에서 연결 정보 추출하여 psql 실행
STATS=$(psql "$DATABASE_URL" -t -c "
SELECT json_build_object(
  'timestamp', NOW(),
  'tables', json_build_object(
    'wallet', (SELECT COUNT(*) FROM wallet),
    'ledger_tx', (SELECT COUNT(*) FROM ledger_tx),
    'escrow', (SELECT COUNT(*) FROM escrow),
    'topup_payments', (SELECT COUNT(*) FROM topup_payments),
    'refund_requests', (SELECT COUNT(*) FROM refund_requests),
    'withdrawal_requests', (SELECT COUNT(*) FROM withdrawal_requests)
  )
)
" 2>/dev/null || echo '{"error": "stats query failed"}')

echo "$STATS" > "$STATS_FILE"
log_info "Stats saved to: $STATS_FILE"

log_info "=== Backup Completed Successfully ==="
log_info "File: ${LOCAL_DIR}/${BACKUP_FILE}"
log_info "Size: ${BACKUP_SIZE:-unknown}"

exit 0
