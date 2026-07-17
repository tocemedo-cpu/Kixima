# KIXIMA backend — Node.js + Express + Prisma
FROM node:20-alpine

# O Prisma precisa de openssl no Alpine.
RUN apk add --no-cache openssl

WORKDIR /app

# Instala dependências primeiro (melhor cache). Mantém as devDependencies porque
# a CLI do Prisma (prisma generate / db push) vive nelas.
COPY package*.json ./
RUN npm ci

# Gera o Prisma Client a partir do schema.
COPY prisma ./prisma
RUN npx prisma generate

# Código da aplicação.
COPY src ./src

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# db push aplica o schema à base de dados no arranque (adequado para
# demo/staging; em produção a sério, preferir migrações versionadas).
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/server.js"]
