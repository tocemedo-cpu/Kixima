# KIXIMA — imagem única (serviço único): compila o frontend e serve-o
# a partir do backend na mesma origem (/api + SPA). Usa este Dockerfile na
# RAIZ do repositório (contexto = raiz), para que o frontend/dist entre mesmo
# na imagem. Um Dockerfile dentro de backend/ não consegue copiar o frontend.

# ---------------------------------------------------------------------------
# Etapa 1 — compilar o frontend (Vite -> frontend/dist)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /fe
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

# db push aplica o schema à base de dados no arranque; depois inicia a API+SPA.
# Nota: em produção robusta, preferir migrações versionadas (prisma migrate deploy).
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/server.js"]
