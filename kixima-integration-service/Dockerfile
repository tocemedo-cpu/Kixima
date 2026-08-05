# =====================================================================
# KIXIMA Integration Service — imagem de produção (NestJS + Prisma)
# =====================================================================

# --- Etapa de build ---
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- Etapa de runtime ---
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY package*.json ./
# Reutiliza node_modules do build (inclui @prisma/client gerado e a CLI Prisma).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh
EXPOSE 4100
CMD ["./docker/entrypoint.sh"]
