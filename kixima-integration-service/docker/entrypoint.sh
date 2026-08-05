#!/bin/sh
# Entrypoint do microserviço: aplica as migrações à base de dados PRÓPRIA e arranca.
set -e

echo "[entrypoint] A aplicar migrações Prisma (migrate deploy) na base de dados de integração..."
if ! npx prisma migrate deploy; then
  echo "[entrypoint] migrate deploy falhou; a tentar 'db push' como recurso..."
  npx prisma db push --skip-generate
fi

echo "[entrypoint] A iniciar o KIXIMA Integration Service..."
exec node dist/main.js
