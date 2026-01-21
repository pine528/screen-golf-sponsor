#!/bin/bash
# 롤백 절차 안내 스크립트
# 사용법: ./rollback.sh [--docker|--render|--fly]
#
# 각 배포 환경에 맞는 롤백 절차를 안내합니다.

# 색상 출력
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

MODE="${1:---docker}"

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              ROLLBACK PROCEDURE GUIDE                          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

case "$MODE" in
  --docker)
    echo -e "${YELLOW}=== Docker Compose Rollback ===${NC}"
    echo ""
    echo "1. 현재 실행 중인 이미지 확인:"
    echo -e "   ${CYAN}docker ps --format \"table {{.Image}}\t{{.Status}}\"${NC}"
    echo ""
    echo "2. 사용 가능한 이미지 태그 확인:"
    echo -e "   ${CYAN}docker images | grep screengolf | head -10${NC}"
    echo ""
    echo "3. docker-compose.prod.yml 수정 (이전 태그로):"
    echo -e "   ${CYAN}backend:${NC}"
    echo -e "   ${CYAN}  image: screengolf-api:<previous_tag>${NC}"
    echo ""
    echo "4. 컨테이너 재시작:"
    echo -e "   ${CYAN}docker-compose -f docker-compose.prod.yml up -d backend${NC}"
    echo ""
    echo "5. 검증:"
    echo -e "   ${CYAN}./scripts/smoke-test.sh${NC}"
    echo ""
    echo -e "${RED}주의: 마이그레이션 롤백이 필요한 경우${NC}"
    echo -e "   ${CYAN}npx prisma migrate resolve --rolled-back <migration_name>${NC}"
    ;;

  --render)
    echo -e "${YELLOW}=== Render Rollback ===${NC}"
    echo ""
    echo "1. Render Dashboard 접속:"
    echo "   https://dashboard.render.com"
    echo ""
    echo "2. 해당 서비스 선택"
    echo ""
    echo "3. 'Deploys' 탭 클릭"
    echo ""
    echo "4. 롤백할 배포 선택 (이전 성공한 배포)"
    echo ""
    echo "5. '...' 메뉴 → 'Rollback to this deploy' 클릭"
    echo ""
    echo "6. 확인 후 배포 대기"
    echo ""
    echo -e "${YELLOW}CLI를 통한 롤백 (render.yaml 기반):${NC}"
    echo ""
    echo "  # 특정 커밋으로 롤백"
    echo -e "  ${CYAN}git revert HEAD~1  # 또는 특정 커밋${NC}"
    echo -e "  ${CYAN}git push origin main${NC}"
    echo ""
    echo "  # 자동 배포가 트리거됨"
    ;;

  --fly)
    echo -e "${YELLOW}=== Fly.io Rollback ===${NC}"
    echo ""
    echo "1. 최근 릴리스 목록 확인:"
    echo -e "   ${CYAN}flyctl releases list${NC}"
    echo ""
    echo "2. 이전 버전으로 롤백:"
    echo -e "   ${CYAN}flyctl deploy --image registry.fly.io/screen-golf-sponsor-api:<version>${NC}"
    echo ""
    echo "3. 또는 특정 릴리스 번호로 롤백:"
    echo -e "   ${CYAN}flyctl releases rollback <version_number>${NC}"
    echo ""
    echo "4. 롤백 확인:"
    echo -e "   ${CYAN}flyctl status${NC}"
    echo ""
    echo "5. 헬스체크:"
    echo -e "   ${CYAN}flyctl checks list${NC}"
    ;;

  *)
    echo "Usage: $0 [--docker|--render|--fly]"
    echo ""
    echo "Options:"
    echo "  --docker  Docker Compose 환경 롤백 가이드"
    echo "  --render  Render.com 롤백 가이드"
    echo "  --fly     Fly.io 롤백 가이드"
    exit 1
    ;;
esac

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   COMMON POST-ROLLBACK STEPS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. 서비스 헬스체크:"
echo -e "   ${CYAN}curl -s \${API_URL}/api/health | jq${NC}"
echo ""
echo "2. Smoke 테스트 실행:"
echo -e "   ${CYAN}./scripts/smoke-test.sh${NC}"
echo ""
echo "3. 핵심 테이블 검증 (선택):"
echo -e "   ${CYAN}psql \$DATABASE_URL -c \"SELECT COUNT(*) FROM wallet\"${NC}"
echo -e "   ${CYAN}psql \$DATABASE_URL -c \"SELECT COUNT(*) FROM ledger_tx\"${NC}"
echo ""
echo "4. 로그 확인:"
echo -e "   ${CYAN}docker-compose logs -f backend --tail=100${NC}"
echo "   또는"
echo -e "   ${CYAN}flyctl logs${NC}"
echo ""
echo "5. 팀에 롤백 완료 알림"
echo ""

echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   DATABASE ROLLBACK (if needed)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${RED}WARNING: 데이터베이스 롤백은 데이터 손실이 발생할 수 있습니다!${NC}"
echo ""
echo "1. 마이그레이션 롤백 (스키마만):"
echo -e "   ${CYAN}npx prisma migrate resolve --rolled-back <migration_name>${NC}"
echo ""
echo "2. 전체 데이터 복구 (백업에서):"
echo -e "   ${CYAN}./scripts/db/restore.sh s3://bucket/daily/backup.sqlc.gz${NC}"
echo ""
echo "3. 대사 실행 (데이터 불일치 시):"
echo -e "   ${CYAN}curl -X POST \${API_URL}/api/admin/reconciliation/run${NC}"
echo ""

echo -e "${GREEN}롤백 가이드 완료. 문제가 지속되면 DR_RUNBOOK.md를 참조하세요.${NC}"
echo ""
