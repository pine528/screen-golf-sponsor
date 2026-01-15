#!/bin/bash
#
# 배포 후 스모크 테스트
# 사용법: ./scripts/smoke-test.sh [BASE_URL]
#
# 예시:
#   ./scripts/smoke-test.sh                          # 로컬 (localhost:4000)
#   ./scripts/smoke-test.sh http://api.example.com   # 운영 서버
#

set -e

BASE_URL="${1:-http://localhost:4000}"
PASSED=0
FAILED=0

echo "======================================"
echo "  Smoke Test - $BASE_URL"
echo "======================================"
echo ""

# 헬퍼 함수
check_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local expected_status="$4"

  printf "%-40s" "Testing $name..."

  status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$endpoint" \
    -H "Content-Type: application/json" \
    --max-time 10 2>/dev/null || echo "000")

  if [ "$status" = "$expected_status" ]; then
    echo "✅ PASS (HTTP $status)"
    ((PASSED++))
  else
    echo "❌ FAIL (Expected $expected_status, got $status)"
    ((FAILED++))
  fi
}

check_json_field() {
  local name="$1"
  local endpoint="$2"
  local field="$3"
  local expected="$4"

  printf "%-40s" "Testing $name..."

  response=$(curl -s -X GET "$BASE_URL$endpoint" \
    -H "Content-Type: application/json" \
    --max-time 10 2>/dev/null || echo "{}")

  value=$(echo "$response" | grep -o "\"$field\":[^,}]*" | head -1 | cut -d':' -f2 | tr -d '"' | tr -d ' ')

  if [ "$value" = "$expected" ]; then
    echo "✅ PASS ($field=$value)"
    ((PASSED++))
  else
    echo "❌ FAIL (Expected $field=$expected, got $value)"
    ((FAILED++))
  fi
}

echo "=== 1. Basic Health Checks ==="
check_endpoint "API Health" "GET" "/api/health" "200"
check_json_field "Health Status" "/api/health" "success" "true"

echo ""
echo "=== 2. Public Endpoints ==="
check_endpoint "Events List" "GET" "/api/events" "200"
check_endpoint "Auctions List" "GET" "/api/auctions" "200"
check_endpoint "Athletes List" "GET" "/api/athletes" "200"

echo ""
echo "=== 3. Auth Endpoints (Unauthenticated) ==="
check_endpoint "Login (No Creds)" "POST" "/api/auth/login" "400"
check_endpoint "Register (No Data)" "POST" "/api/auth/register" "400"

echo ""
echo "=== 4. Protected Endpoints (Should 401) ==="
check_endpoint "Contracts (No Auth)" "GET" "/api/contracts" "401"
check_endpoint "Notifications (No Auth)" "GET" "/api/notifications" "401"
check_endpoint "Wallet (No Auth)" "GET" "/api/wallet/my" "401"

echo ""
echo "======================================"
echo "  Results: $PASSED passed, $FAILED failed"
echo "======================================"

if [ $FAILED -gt 0 ]; then
  echo ""
  echo "❌ Smoke test FAILED"
  exit 1
else
  echo ""
  echo "✅ Smoke test PASSED"
  exit 0
fi
