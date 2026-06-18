#!/usr/bin/env sh
# Manual update for the on-site box — pull the latest images and redeploy.
# (Watchtower does this automatically every 2 min; this is the manual trigger.)
set -e
cd "$(dirname "$0")"
docker compose -f docker-compose.box.yml --env-file .env.local pull
docker compose -f docker-compose.box.yml --env-file .env.local up -d
docker image prune -f
echo "Box updated."
