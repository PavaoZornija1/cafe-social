#!/usr/bin/env bash
# Pull latest code and rebuild API on the VM.
# Expects /opt/cafe-social (or this repo checkout) to be a git clone; .env stays local.
set -euo pipefail
cd "$(dirname "$0")/../.."
git fetch --depth 1 origin main
git reset --hard origin/main
cd deploy/oracle
test -f .env
docker compose up -d --build
curl -fsS "https://${API_DOMAIN:-api.cafe-social.com}/api/health" || curl -fsS http://127.0.0.1/api/health || true
