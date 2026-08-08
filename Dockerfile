# KIXIMA — imagem única (serviço único): compila o frontend e serve-o
# a partir do backend na mesma origem (/api + SPA). Usa este Dockerfile na
# RAIZ do repositório (contexto = raiz), para que o frontend/dist entre mesmo
# na imagem. Um Dockerfile dentro de backend/ não consegue copiar o frontend.

# ---------------------------------------------------------------------------
# Etapa 1 — compilar o frontend (Vite -> frontend/dist)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /fe
# DSN do Sentry do frontend (opcional). O Vite embute VITE_* no build; define
# este build-arg no Render (Environment) para ativar o rastreio no browser.
ARG VITE_SENTRY_DSN=""
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Etapa 2 — backend Node + Express + Prisma, servindo também o SPA
# ---------------------------------------------------------------------------
FROM node:20-alpine
# O Prisma precisa de openssl no Alpine.
RUN apk add --no-cache openssl
WORKDIR /app

# Dependências do backend (mantém devDependencies: a CLI do Prisma vive nelas).
COPY backend/package*.json ./
RUN npm ci

# Prisma Client.
COPY backend/prisma ./prisma
RUN npx prisma generate

# Código do backend.
COPY backend/src ./src

# Frontend compilado da etapa 1 — copiado para dentro da imagem.
COPY --from=frontend /fe/dist ./frontend/dist

ENV NODE_ENV=production
ENV FRONTEND_DIST=/app/frontend/dist
# O Render injeta a porta em $PORT; o servidor usa process.env.PORT.
EXPOSE 4000

# Corre como utilizador não-root (o node:alpine já traz o utilizador "node").
# Garante a pasta de uploads e a posse dos ficheiros pela conta node.
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

# `migrate deploy` aplica as migrações versionadas (prisma/migrations) à base de
# dados via ligação DIRETA (DIRECT_URL). Depois carrega o catálogo de demonstração
# (idempotente, desligável com SKIP_CATALOG_SEED=1) e inicia a API+SPA.
# IMPORTANTE (1ª vez, base já existente): fazer o baseline uma única vez —
#   npx prisma migrate resolve --applied 0_init
# (ver DEPLOY.md). Sem isso, o 1º `migrate deploy` falha com P3005.
CMD ["sh", "-c", "npx prisma migrate deploy && (node prisma/seed.catalog.js || echo 'catalogo: seed ignorado') && node src/server.js"]
