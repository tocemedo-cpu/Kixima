// scripts/agt-diagnostico.js
// Mostra no terminal o que está mesmo configurado para a AGT — sem nunca
// imprimir a chave privada nem a senha da Sandbox em claro (só se estão
// definidas, e quantos caracteres têm, como qualquer diagnóstico decente de
// segredos). Útil depois de mexer em .env/src/chave/chavePrivada.pem, para
// confirmar que ficou como se queria sem ter de arrancar o servidor todo.
//
// Correr:  npm run agt:diagnostico
const fs = require('fs');
const path = require('path');
const config = require('../src/config/env');
const { getEndpoint } = require('../src/config/agt');
const agtSigningService = require('../src/services/agtSigningService');
const agtSandboxClient = require('../src/services/agtSandboxClient');

const CAMINHO_CHAVE_ARQUIVO = path.join(__dirname, '../src/chave/chavePrivada.pem');
const CAMINHO_SECRET_FILE_RENDER = '/etc/secrets/chavePrivada.pem';
const ENDPOINTS = ['registarFactura', 'solicitarSerie', 'obterEstado', 'consultarFactura', 'listarFacturas', 'listarSeries'];

function mascarado(valor) {
  if (!valor) return '(não definido)';
  return `${'*'.repeat(Math.min(String(valor).length, 8))} (${String(valor).length} caracteres)`;
}

function visivel(valor) {
  return valor ? valor : '(não definido)';
}

function pareceUmPem(texto) {
  return /-----BEGIN [A-Z ]+-----/.test(texto) && /-----END [A-Z ]+-----/.test(texto);
}

// Diz de onde VEIO a chave que config.agt.jwsPrivateKeyPem acabou por ter —
// nem sempre é a fonte com maior prioridade: AGT_JWS_PRIVATE_KEY_BASE64 pode
// estar definida mas corrompida (caso real confirmado: cortada por um painel
// de variáveis, ~2300 caracteres, decodifica para algo que não é um PEM) —
// nesse caso env.js ignora-a e cai para o ficheiro, e é isso que este
// diagnóstico tem de mostrar, não a prioridade "em teoria".
function fonteDaChavePrivada() {
  const base64 = String(process.env.AGT_JWS_PRIVATE_KEY_BASE64 || '').trim();
  if (base64) {
    const decodificado = Buffer.from(base64, 'base64').toString('utf8');
    if (pareceUmPem(decodificado)) return 'variável de ambiente (AGT_JWS_PRIVATE_KEY_BASE64)';
    return `AGT_JWS_PRIVATE_KEY_BASE64 está definida (${base64.length} caracteres) MAS NÃO DECODIFICA PARA UM PEM VÁLIDO — `
      + 'provável corte pelo painel de variáveis (visto no Render com valores deste tamanho); ignorada, a procurar '
      + 'um ficheiro a seguir';
  }
  if (fs.existsSync(CAMINHO_SECRET_FILE_RENDER) && fs.readFileSync(CAMINHO_SECRET_FILE_RENDER, 'utf8').trim()) {
    return `Secret File do Render (${CAMINHO_SECRET_FILE_RENDER})`;
  }
  if (fs.existsSync(CAMINHO_CHAVE_ARQUIVO) && fs.readFileSync(CAMINHO_CHAVE_ARQUIVO, 'utf8').trim()) {
    return `ficheiro local (${CAMINHO_CHAVE_ARQUIVO})`;
  }
  return 'nenhuma (nem variável válida, nem ficheiro)';
}

console.log('=== Diagnóstico AGT ===\n');

console.log(`Ambiente (AGT_ENV): ${config.agt.environment || 'hml'} (omissão: hml)`);
console.log('\nURLs por ambiente atual (src/config/agt.js):');
for (const nome of ENDPOINTS) {
  console.log(`  ${nome.padEnd(16)} ${getEndpoint(nome)}`);
}

console.log('\nSoftware (identidade no payload assinado, não é segredo):');
console.log(`  softwareId               = ${visivel(config.agt.softwareId)}`);
console.log(`  softwareVersion          = ${visivel(config.agt.softwareVersion)}`);
console.log(`  softwareValidationNumber = ${visivel(config.agt.softwareValidationNumber)}`);

console.log('\nChave privada JWS (RS256) — nunca impressa em claro:');
console.log(`  fonte  = ${fonteDaChavePrivada()}`);
console.log(`  estado = ${config.agt.jwsPrivateKeyPem ? `definida (${config.agt.jwsPrivateKeyPem.length} caracteres)` : '(não definida)'}`);

console.log('\nCredenciais da Sandbox REST (HTTP Basic) — senha nunca impressa em claro:');
console.log(`  AGT_SANDBOX_USERNAME = ${visivel(config.agt.sandboxUsername)}`);
console.log(`  AGT_SANDBOX_PASSWORD = ${mascarado(config.agt.sandboxPassword)}`);

console.log('\n--- agtSigningService (assina o envelope schema v1.2 — /agt-payload, /agt-serie-payload) ---');
const estadoAssinatura = agtSigningService.estado();
console.log(`  disponível = ${estadoAssinatura.disponivel}`);
if (!estadoAssinatura.disponivel) console.log(`  em falta   = ${estadoAssinatura.emFalta.join(', ')}`);

console.log('\n--- agtSandboxClient (Sandbox REST — registarFactura, solicitarSerie, ...) ---');
const estadoSandbox = agtSandboxClient.estado();
console.log(`  disponível = ${estadoSandbox.disponivel}`);
if (!estadoSandbox.disponivel) console.log(`  em falta   = ${estadoSandbox.emFalta.join(', ')}`);

console.log(`\n${estadoAssinatura.disponivel && estadoSandbox.disponivel ? '✓ Tudo configurado.' : '✗ Ainda falta configuração — ver "em falta" acima.'}`);
