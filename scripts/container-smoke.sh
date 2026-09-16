#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
cd "$repo_dir"

if [ -f .env.local ]; then
  compose_env_file=.env.local
else
  compose_env_file=.env.local.example
fi

health_url=http://127.0.0.1:5000/health

cleanup() {
  docker compose --env-file "$compose_env_file" down --remove-orphans
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker compose --env-file "$compose_env_file" up -d --build --wait

HEALTH_URL="$health_url" node --input-type=module -e '
const healthUrl = process.env.HEALTH_URL;

if (!healthUrl) {
  throw new Error("HEALTH_URL is required");
}

const response = await fetch(healthUrl);
const body = await response.json();

if (!response.ok || body.status !== "ok") {
  throw new Error(`health check failed with status ${response.status}`);
}
'
