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
const ENDPOINTS = ['registarFactura', 'solicitarSerie', 'obterEstado', 'consultarFactura', 'listarFacturas', 'listarSeries'];

function mascarado(valor) {
  if (!valor) return '(não definido)';
  return `${'*'.repeat(Math.min(String(valor).length, 8))} (${String(valor).length} caracteres)`;
}

function visivel(valor) {
  return valor ? valor : '(não definido)';
}

function fonteDaChavePrivada() {
  if (process.env.AGT_JWS_PRIVATE_KEY_BASE64) return 'variável de ambiente (AGT_JWS_PRIVATE_KEY_BASE64)';
  if (fs.existsSync(CAMINHO_CHAVE_ARQUIVO) && fs.readFileSync(CAMINHO_CHAVE_ARQUIVO, 'utf8').trim()) {
    return `ficheiro (${CAMINHO_CHAVE_ARQUIVO})`;
  }
  if (fs.existsSync(CAMINHO_CHAVE_ARQUIVO)) return 'ficheiro existe mas está vazio — conta como não configurado';
  return 'nenhuma (nem variável, nem ficheiro)';
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
