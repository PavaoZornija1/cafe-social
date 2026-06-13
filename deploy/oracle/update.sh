#!/usr/bin/env bash
# Pull latest code and rebuild API on the VM.
set -euo pipefail
cd "$(dirname "$0")/../.."
git pull origin main
cd deploy/oracle
docker compose up -d --build
