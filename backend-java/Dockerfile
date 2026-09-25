# KIXIMA — imagem do backend JAVA (Spring Boot) para o M8: o MESMO desenho de
# serviço único do Dockerfile da raiz (Node), só que com o jar no lugar do
# Express. Um contentor serve a API em /api e o frontend compilado (SPA) na
# mesma origem — sem CORS nem proxy — e por isso o contexto de build tem de
# ser a RAIZ do repositório (render.yaml: dockerContext "." +
# dockerfilePath ./backend-java/Dockerfile), para o frontend/ entrar na imagem.
#
# O schema continua a ser do Prisma (backend/prisma/migrations): esta imagem
# não corre migrações (Flyway fica desligado, ver application.yml). Durante a
# janela de rollback os dois serviços apontam à MESMA base do Supabase.

# ---------------------------------------------------------------------------
# Etapa 1 — compilar o frontend (Vite -> frontend/dist), igual à do Node
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /fe
# DSN do Sentry do frontend (opcional). O Vite embute VITE_* no build; define
# este build-arg no Render (Environment) para ativar o rastreio no browser.
ARG VITE_SENTRY_DSN=""
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
# O backend Java só fala STOMP (WebSocketConfig): o SPA desta imagem tem de
# ser compilado com o transporte STOMP — o Vite embute a flag no build. A
# imagem do Node (Dockerfile da raiz) fica com o Socket.IO por omissão.
ENV VITE_REALTIME=stomp
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Etapa 2 — compilar o jar (Maven + Temurin 21)
# ---------------------------------------------------------------------------
FROM maven:3.9-eclipse-temurin-21 AS backend
WORKDIR /build
# Primeiro só o pom.xml: a camada com o ~/.m2 fica em cache e um commit que só
# toca em src/ não volta a descarregar as dependências todas.
COPY backend-java/pom.xml ./
RUN mvn -B -q -DskipTests dependency:go-offline
COPY backend-java/src ./src
# -DskipTests: a suite precisa do Postgres kixima_test semeado (ver o job
# backend-java-tests no CI) — não corre dentro de um build de imagem.
RUN mvn -B -q -DskipTests package

# ---------------------------------------------------------------------------
# Etapa 3 — runtime: JRE 21 em Alpine, sem Maven nem fontes
# ---------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine
# postgresql17-client: o pg_dump da cópia de segurança automática (BACKUP_CRON)
#   e do botão "Copiar agora" — BackupService corre `pg_dump` como processo
#   externo, tal como o backupJob.js do Node. Sem ele o job arranca e falha
#   todas as noites e a Prontidão marca a ferramenta como em falta.
#   A versão é explícita pela mesma razão que na imagem Node: o pg_dump
#   RECUSA-SE a copiar um servidor mais recente do que ele, e o Supabase corre
#   o PostgreSQL 15 ou 17 conforme a idade do projeto; um cliente 17 copia os
#   dois. O fallback evita que uma remoção do pacote no Alpine quebre o build.
RUN (apk add --no-cache postgresql17-client || apk add --no-cache postgresql-client)

# Utilizador não-root (a imagem JRE não traz nenhum, ao contrário do node:alpine).
RUN addgroup -S kixima && adduser -S kixima -G kixima
WORKDIR /app

COPY --from=backend /build/target/kixima-backend-*.jar ./app.jar
# Frontend compilado da etapa 1 — copiado para dentro da imagem.
COPY --from=frontend /fe/dist ./frontend/dist
# Pasta de uploads (STORAGE_PROVIDER=local, só fora de produção) e posse dos ficheiros.
RUN mkdir -p /app/uploads && chown -R kixima:kixima /app

ENV SPRING_PROFILES_ACTIVE=prod
ENV FRONTEND_DIST=/app/frontend/dist
# Flags da JVM para um contentor pequeno (plano free do Render: 512 MB, CPU
# partilhada). MaxRAMPercentage=75 dimensiona o heap pela memória do
# contentor (o resto fica para metaspace, threads e o pg_dump), em vez do 25%
# por omissão que desperdiçaria três quartos da RAM. UseSerialGC: com 1 CPU e
# <2 GB a JVM já escolheria o Serial por ergonomia — fixá-lo evita que um plano
# maior mude o coletor sem ninguém reparar, e é o que menos memória e threads
# gasta. ExitOnOutOfMemoryError: um processo sem memória morre e o Render
# reinicia-o, em vez de ficar vivo a falhar o /ready. Sobrepõe-se com JAVA_OPTS
# no painel sem reconstruir a imagem.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom"
# O Render injeta a porta em $PORT; application.yml lê ${PORT:4001}.
EXPOSE 4001

USER kixima
# `exec` para o java ser o PID 1 e receber o SIGTERM do Render diretamente
# (o Spring fecha o pool e termina os pedidos em curso).
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
