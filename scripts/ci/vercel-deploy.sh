#!/usr/bin/env bash
set -euo pipefail

target="${1:-preview}"
deploy_url_file="${2:-}"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[vercel-deploy] Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

require_env "VERCEL_TOKEN"
require_env "VERCEL_ORG_ID"
require_env "VERCEL_PROJECT_ID"

if [[ "${target}" != "preview" && "${target}" != "staging" && "${target}" != "production" ]]; then
  echo "[vercel-deploy] Usage: scripts/ci/vercel-deploy.sh <preview|staging|production> [deploy_url_file]" >&2
  exit 1
fi

vercel_env="preview"
deploy_args=()
alias_domain=""

if [[ "${target}" == "production" ]]; then
  vercel_env="production"
  deploy_args+=(--prod)
  alias_domain="${VERCEL_PRODUCTION_DOMAIN:-}"
elif [[ "${target}" == "staging" ]]; then
  alias_domain="${VERCEL_STAGING_DOMAIN:-}"
fi

pull_args=(
  --yes
  --environment "${vercel_env}"
  --token "${VERCEL_TOKEN}"
  --scope "${VERCEL_ORG_ID}"
)

build_args=(
  --token "${VERCEL_TOKEN}"
  --scope "${VERCEL_ORG_ID}"
)

if [[ "${target}" == "production" ]]; then
  build_args+=(--prod)
fi

deploy_cmd=(
  npx --yes vercel@latest deploy --prebuilt
  --token "${VERCEL_TOKEN}"
  --scope "${VERCEL_ORG_ID}"
)
deploy_cmd+=("${deploy_args[@]}")

echo "[vercel-deploy] Pulling Vercel environment (${vercel_env})..."
npx --yes vercel@latest pull "${pull_args[@]}"

echo "[vercel-deploy] Building prebuilt deployment artifact..."
npx --yes vercel@latest build "${build_args[@]}"

echo "[vercel-deploy] Deploying (${target})..."
deploy_output="$("${deploy_cmd[@]}" 2>&1 | tee /dev/stderr)"

deployment_url="$(printf '%s\n' "${deploy_output}" | grep -Eo 'https://[^[:space:]]+' | tail -n 1)"

if [[ -z "${deployment_url}" ]]; then
  echo "[vercel-deploy] Failed to parse deployment URL from Vercel CLI output." >&2
  exit 1
fi

if [[ -n "${alias_domain}" ]]; then
  echo "[vercel-deploy] Assigning alias ${alias_domain} -> ${deployment_url}"
  npx --yes vercel@latest alias set \
    "${deployment_url}" \
    "${alias_domain}" \
    --token "${VERCEL_TOKEN}" \
    --scope "${VERCEL_ORG_ID}"
fi

if [[ -n "${deploy_url_file}" ]]; then
  mkdir -p "$(dirname "${deploy_url_file}")"
  printf '%s\n' "${deployment_url}" > "${deploy_url_file}"
fi

echo "##vso[task.setvariable variable=VERCEL_DEPLOYMENT_URL]${deployment_url}"
echo "[vercel-deploy] Deployment URL: ${deployment_url}"
