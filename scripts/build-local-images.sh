#!/usr/bin/env bash
set -euo pipefail

WEB_TAG="${1:-orbit-web:local}"
API_TAG="${2:-orbit-api:local}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PULL_ARGS=()

if [[ "${PULL_BASE:-0}" == "1" ]]; then
  PULL_ARGS+=(--pull)
fi

echo "==> Building web image: ${WEB_TAG}"
docker build --progress plain "${PULL_ARGS[@]}" \
  -f "${REPO_ROOT}/apps/web/Dockerfile" \
  -t "${WEB_TAG}" \
  "${REPO_ROOT}"

echo "==> Building api image: ${API_TAG}"
docker build --progress plain "${PULL_ARGS[@]}" \
  -f "${REPO_ROOT}/apps/api/Dockerfile" \
  -t "${API_TAG}" \
  "${REPO_ROOT}"

echo "==> Done"
echo "   Web: ${WEB_TAG}"
echo "   API: ${API_TAG}"
