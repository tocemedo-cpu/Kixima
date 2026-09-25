#!/usr/bin/env bash
# Replay de contrato Node × Java sobre a MESMA cópia da base (plano, secção 4.2).
#
#   paridade/correr.sh            # grava os dois lados e compara
#   paridade/correr.sh comparar   # só compara as gravações existentes
#   paridade/correr.sh carga      # carga indicativa (paridade/carga.mjs) nos dois lados, base limpa em cada um
#
# Cada lado arranca sobre a base acabada de restaurar do mesmo dump, corre o
# cenário (paridade/cenario.json) e é desligado; a base é restaurada no fim.
# Variáveis: DUMP (pg_dump -Fc da base de teste), PGHOST/PGUSER/PGPASSWORD/PGDATABASE,
# NODE_DIR (../backend), PORTA_NODE (4000), PORTA_JAVA (4001).
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/.." && pwd)"
NODE_DIR="${NODE_DIR:-$RAIZ/../backend}"
DUMP="${DUMP:?defina DUMP com o caminho do pg_dump -Fc da base de teste}"
export PGHOST="${PGHOST:-localhost}" PGUSER="${PGUSER:-kixima}" PGPASSWORD="${PGPASSWORD:-kixima}" PGDATABASE="${PGDATABASE:-kixima_test}"
PORTA_NODE="${PORTA_NODE:-4000}"
PORTA_JAVA="${PORTA_JAVA:-4001}"
JAR="$RAIZ/target/kixima-backend-0.1.0-SNAPSHOT.jar"
LOGS="${LOGS:-$AQUI/gravacoes}"
mkdir -p "$LOGS"

restaurar() {
  pg_restore --clean --if-exists -d "$PGDATABASE" "$DUMP" 2>&1 | grep -v "does not exist\|^pg_restore: warning" || true
}

esperar() { # url
  for _ in $(seq 1 90); do
    if curl -sf "$1" >/dev/null; then return 0; fi
    sleep 1
  done
  echo "servidor não respondeu em $1" >&2
  return 1
}

parar() { # pid
  kill "$1" 2>/dev/null || true
  for _ in $(seq 1 20); do kill -0 "$1" 2>/dev/null || return 0; sleep 0.5; done
  kill -9 "$1" 2>/dev/null || true
}

if [ "${1:-gravar}" = "gravar" ]; then
  [ -f "$JAR" ] || (cd "$RAIZ" && mvn -q -o package -DskipTests)

  echo "== Node ($PORTA_NODE)"
  restaurar
  (cd "$NODE_DIR" && NODE_ENV=test PORT="$PORTA_NODE" node -r ./tests/env.js src/server.js >"$LOGS/node-server.log" 2>&1) &
  PID_NODE=$!
  esperar "http://localhost:$PORTA_NODE/health"
  node "$AQUI/replay.mjs" gravar --alvo "http://localhost:$PORTA_NODE" --saida "$AQUI/gravacoes/node.json"
  parar "$PID_NODE"

  echo "== Java ($PORTA_JAVA)"
  restaurar
  java -jar "$JAR" --spring.profiles.active=test --server.port="$PORTA_JAVA" >"$LOGS/java-server.log" 2>&1 &
  PID_JAVA=$!
  esperar "http://localhost:$PORTA_JAVA/ready"
  node "$AQUI/replay.mjs" gravar --alvo "http://localhost:$PORTA_JAVA" --saida "$AQUI/gravacoes/java.json"
  parar "$PID_JAVA"

  restaurar
fi

if [ "${1:-gravar}" = "carga" ]; then
  [ -f "$JAR" ] || (cd "$RAIZ" && mvn -q -o package -DskipTests)
  DURACAO="${DURACAO:-15}"; CONCORRENCIA="${CONCORRENCIA:-20}"

  echo "== Node ($PORTA_NODE)"
  restaurar
  (cd "$NODE_DIR" && NODE_ENV=test PORT="$PORTA_NODE" node -r ./tests/env.js src/server.js >"$LOGS/node-server.log" 2>&1) &
  PID_NODE=$!
  esperar "http://localhost:$PORTA_NODE/health"
  node "$AQUI/carga.mjs" --alvo "http://localhost:$PORTA_NODE" --duracao "$DURACAO" --concorrencia "$CONCORRENCIA" | tee "$LOGS/carga-node.md"
  parar "$PID_NODE"

  echo "== Java ($PORTA_JAVA)"
  restaurar
  java -jar "$JAR" --spring.profiles.active=test --server.port="$PORTA_JAVA" >"$LOGS/java-server.log" 2>&1 &
  PID_JAVA=$!
  esperar "http://localhost:$PORTA_JAVA/ready"
  # Aquecimento: o JIT e os caches do Hibernate distorcem os primeiros segundos.
  node "$AQUI/carga.mjs" --alvo "http://localhost:$PORTA_JAVA" --duracao 5 --concorrencia "$CONCORRENCIA" >/dev/null
  node "$AQUI/carga.mjs" --alvo "http://localhost:$PORTA_JAVA" --duracao "$DURACAO" --concorrencia "$CONCORRENCIA" | tee "$LOGS/carga-java.md"
  parar "$PID_JAVA"

  restaurar
  exit 0
fi

echo "== Comparação"
node "$AQUI/replay.mjs" comparar "$AQUI/gravacoes/node.json" "$AQUI/gravacoes/java.json" --tolerar-decimais
