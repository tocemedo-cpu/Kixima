#!/bin/sh
# Entrypoint do microserviço: aplica o schema à base de dados PRÓPRIA e arranca.
set -e

echo "[entrypoint] A aplicar o schema Prisma (db push) na base de dados de integração..."
npx prisma db push --skip-generate

echo "[entrypoint] A iniciar o KIXIMA Integration Service..."
exec node dist/main.js
