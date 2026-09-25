// Proxy de desenvolvimento do Angular (ng serve). O backend DEFINITIVO é o
// Java/Spring Boot — já serve o mesmo contrato de 246 rotas que o Node (ver
// docs/migracao-java/M7-PARIDADE.md, "Inventário mecânico de rotas": 246/246
// em comum). A porta 4001 é a porta por omissão do backend-java
// (backend-java/src/main/resources/application.yml: server.port=${PORT:4001}).
//
// Para apontar temporariamente ao Node (porta 4000, ex.: para comparar
// comportamento durante a transição), corra:
//   KIXIMA_API_TARGET=http://localhost:4000 npm start
const alvo = process.env.KIXIMA_API_TARGET || 'http://localhost:4001';

export default {
  '/api': { target: alvo, secure: false, changeOrigin: true },
  // STOMP nativo do Spring (ver backend-java/.../realtime/*, e o adaptador
  // já portado em frontend/src/realtime/stompAdapter.js, que serve de
  // referência direta para o equivalente Angular).
  '/ws': { target: alvo, secure: false, changeOrigin: true, ws: true },
};
