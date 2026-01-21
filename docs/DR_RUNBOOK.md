# Disaster Recovery Runbook

> 스크린골프 스폰서 플랫폼 장애 복구 매뉴얼

---

## 백업/복구 절차 요약 (12줄)

```
1. 일일 백업: 03:30 KST 자동 실행 (GitHub Actions)
2. 백업 파일: screengolf_YYYYMMDD_HHMMSS.sqlc.gz
3. 저장소: S3 버킷 (daily/weekly/monthly 폴더)
4. 보관: 일일 14일, 주간 8주, 월간 12개월
5. 복구: ./scripts/db/restore.sh s3://bucket/daily/file.sqlc.gz --force
6. 검증: ./scripts/db/verify-backup.sh (매주 일요일 자동)
7. 핵심 테이블: Wallet, LedgerTx, Escrow, TopupPayment, RefundRequest, WithdrawalRequest
8. 돈 데이터 보호: LedgerTx는 절대 DELETE/UPDATE 금지
9. 롤백: ./scripts/release/rollback.sh 참조
10. 대사: /admin/reconciliation에서 수동 실행
11. 알림: 백업 실패 시 Slack 알림
12. 테스트: 분기별 복구 리허설 필수
```

---

## 핵심 연락처

| 역할 | 담당 | 연락처 |
|------|------|--------|
| 기술 리드 | (이름) | (연락처) |
| DBA | (이름) | (연락처) |
| 인프라 | (이름) | (연락처) |
| 고객 지원 | (이름) | (연락처) |

---

## 장애 시나리오별 대응 절차

### 시나리오 1: API 500 에러 지속

**증상**:
- 전체 API 요청에 500 에러 발생
- Health check 실패

**10분 내 대응 절차**:

```bash
# 1. 상태 확인 (1분)
curl -s ${API_URL}/api/health | jq
docker-compose logs backend --tail=50

# 2. 최근 배포 확인 (1분)
git log --oneline -5
# 최근 배포가 원인인지 확인

# 3. 빠른 롤백 결정 (2분)
# 최근 배포 후 발생 → 롤백 진행
./scripts/release/rollback.sh --docker
# 또는 Render: Dashboard → Deploys → Rollback

# 4. DB 연결 확인 (1분)
psql $DATABASE_URL -c "SELECT 1"

# 5. 서비스 재시작 (롤백 불필요시) (2분)
docker-compose restart backend

# 6. 검증 (2분)
./scripts/smoke-test.sh

# 7. 알림 (1분)
# Slack/팀에 상황 공유
```

**에스컬레이션**: 10분 내 해결 불가 시 → 기술 리드 호출

---

### 시나리오 2: 마이그레이션 실패

**증상**:
- 배포 시 마이그레이션 단계에서 실패
- 앱 시작 불가

**10분 내 대응 절차**:

```bash
# 1. 마이그레이션 상태 확인 (2분)
npx prisma migrate status

# 2. 오류 로그 확인 (2분)
docker-compose logs backend | grep -i "migration\|error"

# 3. 마이그레이션 롤백 (데이터 손실 없는 경우) (3분)
npx prisma migrate resolve --rolled-back <migration_name>

# 4. 이전 코드로 롤백 (3분)
./scripts/release/rollback.sh --docker
```

**주의사항**:
- 데이터를 삭제하는 마이그레이션은 롤백 불가
- 새 컬럼 추가 후 코드 롤백 → 해당 컬럼 무시됨 (안전)
- 컬럼 삭제 후 롤백 → 데이터 손실 (복구 필요)

**복잡한 경우**:
```bash
# 전체 DB 복구 (데이터 손실 시)
./scripts/db/restore.sh s3://bucket/daily/latest.sqlc.gz --force
```

---

### 시나리오 3: 데이터 불일치 (잔액 오차)

**증상**:
- 대사 보고서에서 불일치 발견
- 고객 불만 (잔액 오류)

**10분 내 대응 절차**:

```bash
# 1. 불일치 범위 파악 (2분)
# /admin/reconciliation 페이지에서 최근 대사 결과 확인

# 2. 영향받는 지갑 식별 (3분)
psql $DATABASE_URL -c "
SELECT w.id, w.balance, w.user_id,
       (SELECT SUM(amount) FROM ledger_tx WHERE wallet_id = w.id) as ledger_sum
FROM wallet w
WHERE w.balance != (SELECT COALESCE(SUM(amount), 0) FROM ledger_tx WHERE wallet_id = w.id)
LIMIT 10;
"

# 3. 즉시 조치 (2분)
# 불일치가 소수이면 → 수동 조정 검토
# 불일치가 다수이면 → 서비스 점검 모드 전환 고려

# 4. 원인 분석 (3분+)
# 최근 트랜잭션 로그 검토
psql $DATABASE_URL -c "
SELECT * FROM ledger_tx
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;
"
```

**장기 조치**:
1. 불일치 원인 식별 (버그, 동시성 이슈, 외부 장애)
2. 수동 조정 LedgerTx 생성 (ADMIN 승인 필수)
3. 고객 안내

**중요**: LedgerTx는 **절대로 DELETE/UPDATE 금지**. 조정은 반드시 새 레코드 추가로만 처리.

---

## 핵심 테이블 보호 정책

### "돈 데이터" 테이블

| 테이블 | 설명 | DELETE | UPDATE |
|--------|------|--------|--------|
| `wallet` | 지갑 잔액 | 금지 | balance만 허용 |
| `ledger_tx` | 원장 (불변) | **절대 금지** | **절대 금지** |
| `escrow` | 에스크로 | 금지 | status만 허용 |
| `topup_payments` | 충전 내역 | 금지 | status만 허용 |
| `refund_requests` | 환불 요청 | 금지 | status만 허용 |
| `withdrawal_requests` | 출금 요청 | 금지 | status만 허용 |

### LedgerTx 불변성 규칙

```sql
-- LedgerTx에 대한 DELETE/UPDATE 트리거 (권장)
CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'LedgerTx modification is not allowed. This is an immutable audit log.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_ledger_update
  BEFORE UPDATE OR DELETE ON ledger_tx
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();
```

---

## 복구 명령어 빠른 참조

### 백업

```bash
# 수동 백업
./scripts/db/backup.sh full

# S3로 직접 백업
pg_dump -Fc $DATABASE_URL | gzip | aws s3 cp - s3://bucket/manual/backup.sqlc.gz
```

### 복구

```bash
# S3에서 복구
./scripts/db/restore.sh s3://bucket/daily/screengolf_20240115.sqlc.gz --force

# 로컬 파일에서 복구
./scripts/db/restore.sh /path/to/backup.sqlc.gz --force
```

### 검증

```bash
# 백업 무결성 검증
./scripts/db/verify-backup.sh /path/to/backup.sqlc.gz

# 핵심 테이블 빠른 체크
psql $DATABASE_URL -c "
SELECT
  (SELECT COUNT(*) FROM wallet) as wallets,
  (SELECT COUNT(*) FROM ledger_tx) as ledger_entries,
  (SELECT COUNT(*) FROM escrow) as escrows;
"
```

---

## 점검 모드 (Maintenance Mode)

### 활성화

```bash
# 1. 환경변수로 점검 모드 활성화
export MAINTENANCE_MODE=true
docker-compose restart backend

# 2. 또는 Render/Fly.io 환경변수 설정
# MAINTENANCE_MODE=true
```

### 점검 중 표시

앱에서 `MAINTENANCE_MODE=true` 시:
- 모든 API 요청에 `503 Service Unavailable` 반환
- Health check는 정상 응답 (인프라 모니터링용)

### 비활성화

```bash
export MAINTENANCE_MODE=false
docker-compose restart backend
```

---

## 분기별 복구 리허설 체크리스트

**목표**: 실제 복구가 가능한지 검증

- [ ] 최신 백업 다운로드
- [ ] 스테이징 환경에 복구
- [ ] 핵심 테이블 row count 확인
- [ ] Smoke test 통과
- [ ] 랜덤 사용자 데이터 검증
- [ ] 복구 소요 시간 기록
- [ ] 이슈 발견 시 문서화

**기록**:
| 날짜 | 복구 시간 | 데이터 크기 | 이슈 |
|------|-----------|-------------|------|
| YYYY-MM-DD | X분 | Y GB | (내용) |

---

## 환경변수 참조

| 변수 | 용도 | 필수 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 연결 | 예 |
| `S3_BACKUP_BUCKET` | 백업 S3 버킷 | 예 (백업용) |
| `AWS_ACCESS_KEY_ID` | AWS 인증 | 예 (S3 사용 시) |
| `AWS_SECRET_ACCESS_KEY` | AWS 인증 | 예 (S3 사용 시) |
| `AWS_DEFAULT_REGION` | AWS 리전 | 아니오 (기본: ap-northeast-2) |
| `SLACK_WEBHOOK_URL` | 알림 | 아니오 |
| `MAINTENANCE_MODE` | 점검 모드 | 아니오 |

---

## 관련 문서

- [PROJECT_STATE.md](./PROJECT_STATE.md) - 프로젝트 현재 상태
- [scripts/db/backup.sh](../src/backend/scripts/db/backup.sh) - 백업 스크립트
- [scripts/db/restore.sh](../src/backend/scripts/db/restore.sh) - 복구 스크립트
- [scripts/release/rollback.sh](../src/backend/scripts/release/rollback.sh) - 롤백 가이드

---

*마지막 업데이트: 2025-01-21*
