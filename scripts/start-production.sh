#!/bin/sh
set -eu

required_vars="DATABASE_URL REDIS_URL JWT_SECRET"

for var_name in $required_vars; do
  eval "var_value=\${$var_name:-}"

  if [ -z "$var_value" ]; then
    echo "Missing required environment variable: $var_name" >&2
    exit 1
  fi
done

echo "Running Prisma schema sync..."
npx prisma db push

echo "Starting backend..."
node dist/src/main.js
