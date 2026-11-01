#!/bin/sh
set -e
npx prisma db push --skip-generate
# SEED_ON_START=true mengisi data contoh (MENGHAPUS data lama). Matikan setelah run pertama.
if [ "$SEED_ON_START" = "true" ]; then node prisma/seed.js; fi
exec node src/server.js
