#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="${1:-orbit:local}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PULL_ARGS=()

if [[ "${PULL_BASE:-0}" == "1" ]]; then
  PULL_ARGS+=(--pull)
fi

echo "==> Building image: ${IMAGE_TAG}"
docker build --progress plain "${PULL_ARGS[@]}" \
  -f "${REPO_ROOT}/apps/web/Dockerfile" \
  -t "${IMAGE_TAG}" \
  "${REPO_ROOT}"

echo "==> Done"
echo "   Image: ${IMAGE_TAG}"
