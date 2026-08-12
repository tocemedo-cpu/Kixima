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
# openssl: exigido pelo Prisma no Alpine.
# postgresql-client: o pg_dump da cópia de segurança automática (BACKUP_CRON).
#   Sem ele o job arranca e falha todas as noites — a base ficaria sem cópia com
#   a aplicação a dar sinal de estar tudo bem.
RUN apk add --no-cache openssl postgresql-client
WORKDIR /app

# Dependências do backend (mantém devDependencies: a CLI do Prisma vive nelas).
COPY backend/package*.json ./
RUN npm ci

# Prisma Client.
COPY backend/prisma ./prisma
RUN npx prisma generate

# Código do backend.
COPY backend/src ./src

# Scripts de manutenção. O arranque usa scripts/migrate-boot.js — sem esta cópia
# o contentor arranca sem ele e as migrações nunca correm.
COPY backend/scripts ./scripts

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

# Arranque com migrações RECONCILIÁVEIS:
#  - scripts/migrate-boot.js corre `migrate deploy` e, se falhar, MOSTRA o erro
#    real e reconcilia os estados conhecidos (base sem histórico, migração
#    falhada, ficheiro alterado depois de aplicado). Nunca bloqueia o arranque:
#    uma inconsistência no registo não deve deixar o site em baixo.
# Depois o seed do catálogo corre em modo OPT-IN: sem LOAD_DEMO_CATALOG=1 no
# ambiente é um no-op, a não ser que CATALOG_COMPANY=1 esteja definido — nesse
# caso garante só a empresa dona do catálogo (sem recarregar os itens).
# Para remover dados de demonstração já existentes: `npm run demo:remove`.
# Por fim inicia a API+SPA.
CMD ["sh", "-c", "node scripts/migrate-boot.js; (node prisma/seed.catalog.js || echo 'catalogo: seed ignorado') && node src/server.js"]
