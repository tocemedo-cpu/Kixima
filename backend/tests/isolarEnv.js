// tests/isolarEnv.js — corre em cada ficheiro de teste (setupFilesAfterEnv).
//
// Com maxWorkers: 1 todos os ficheiros correm no MESMO processo, e o
// process.env é partilhado: uma suite que injecta AGT_JWS_PRIVATE_KEY_BASE64
// ou credenciais da sandbox à carga do módulo (agt-sandbox-client,
// agt-serie-payload, …) deixava a AGT "configurada" para todas as suites
// seguintes — que passavam a assinar e a submeter facturas a sério, e falhavam
// por razões que nada tinham a ver com elas. Só se via na ordem do CI (sem
// cache do Jest), nunca na ordem local.
//
// Fotografia do ambiente à entrada de cada ficheiro, reposta à saída: o que a
// suite acrescentou desaparece, o que alterou volta ao valor inicial.
const inicial = { ...process.env };

afterAll(() => {
  for (const chave of Object.keys(process.env)) {
    if (!(chave in inicial)) delete process.env[chave];
  }
  for (const [chave, valor] of Object.entries(inicial)) {
    if (process.env[chave] !== valor) process.env[chave] = valor;
  }
});
