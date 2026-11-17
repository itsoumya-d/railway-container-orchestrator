#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${1:-http://127.0.0.1:4000}"

echo "Starting smoke tests against ${TARGET_URL}..."

# 1. Health check
echo "Checking /health..."
HEALTH_RES=$(curl -fsS "${TARGET_URL}/health")
if [[ "${HEALTH_RES}" != *'"ok":true'* ]]; then
  echo "FAIL: Unexpected health response: ${HEALTH_RES}"
  exit 1
fi
echo "PASS: /health returned ok:true"

# 2. GraphQL root query check
echo "Checking /graphql query..."
GQL_RES=$(curl -fsS -X POST "${TARGET_URL}/graphql" \
  -H "Content-Type: application/json" \
  -d '{"operation":"projects"}')

if [[ "${GQL_RES}" != *'data'* ]]; then
  echo "FAIL: Unexpected GraphQL response: ${GQL_RES}"
  exit 1
fi
echo "PASS: /graphql executed successfully"

echo "All smoke tests PASSED!"
