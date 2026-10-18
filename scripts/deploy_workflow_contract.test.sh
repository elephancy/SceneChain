#!/bin/sh
set -eu

# The private controller polls verified main CI; this repository never publishes releases.
test ! -e .github/workflows/deploy-hetzner.yml
test ! -e .github/hetzner-release.json
for workflow in .github/workflows/*.yml
do
  if grep -Eiq 'HetznerReleaseGateway|id-token:[[:space:]]*write|HETZNER_|DEPLOY_(HOST|USER|PATH|KEY)|SSH_PRIVATE_KEY|secrets:[[:space:]]*inherit' "$workflow"; then
    echo "Application CI must not publish production releases or carry deployment credentials." >&2
    exit 1
  fi
done

# Preserve the complete application CI and container/security verification gates.
for check in \
  'name: SceneChain CI' \
  'mvn --batch-mode verify' \
  'npm run lint' \
  'npm test' \
  'npm run build' \
  'npm audit --audit-level=high' \
  'targets: backend,frontend' \
  'backend.tags=scenechain-backend:latest' \
  'frontend.tags=scenechain-frontend:latest' \
  'load: true' \
  'docker compose up -d --no-build' \
  'severity-cutoff: high' \
  'sh ./scripts/security_negative_test.sh' \
  'sh ./scripts/smoke_test.sh'
do
  grep -Fq "$check" .github/workflows/ci.yml
done

for retired in \
  deploy/Caddyfile.example \
  deploy/Caddyfile.hetzner.example \
  deploy/docker-compose.hetzner.yml \
  scripts/deploy_hetzner.sh
do
  grep -Fq 'Retired:' "$retired" || grep -Fq 'is retired' "$retired"
  if grep -Eiq '/opt/|reverse_proxy|external:[[:space:]]*true|docker compose|ssh|scp|rsync' "$retired"; then
    echo "Retired deployment material still exposes host behavior: $retired" >&2
    exit 1
  fi
done

echo "Private deployment controller boundary passed."
