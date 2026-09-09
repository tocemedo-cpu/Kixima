// scripts/agt-solicitar-serie.js
// Gera o pedido "Solicitar Série" (spec DS.120, 4.5) — pré-requisito para
// poder emitir documentos com uma série própria; o `seriesCode` que a AGT
// devolver na resposta é o que passa a entrar no `documentNo` dos
// documentos desse tipo (ver agt-certificacao-c1-fr.js, que ainda usa a
// série fictícia "CERT-FR" até este pedido ser feito e respondido).
//
// Uso: node scripts/agt-solicitar-serie.js <documentType> [establishmentNumber] [seriesYear] [ficheiro-saida.json]
// Exemplo: node scripts/agt-solicitar-serie.js FR 1 2026
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TAX_REGISTRATION_NUMBER = process.env.AGT_HOMOLOGACAO_NIF || 'SUBSTITUIR-PELO-NIF-REAL-DE-HOMOLOGACAO';

if (!process.env.AGT_JWS_PRIVATE_KEY_BASE64) {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
  console.error('[aviso] AGT_JWS_PRIVATE_KEY_BASE64 não estava definida — gerada uma chave de TESTE só para este ficheiro ficar assinado estruturalmente. Substituir pela chave real de homologação antes de submeter.');
}
if (!process.env.AGT_SOFTWARE_VALIDATION_NUMBER) {
  process.env.AGT_SOFTWARE_VALIDATION_NUMBER = 'SUBSTITUIR-PELO-SOFTWAREVALIDATIONNUMBER-DE-HOMOLOGACAO';
}

const agtSeriesService = require('../src/services/agtSeriesService');

const documentType = process.argv[2];
if (!documentType) {
  console.error('Uso: node scripts/agt-solicitar-serie.js <documentType> [establishmentNumber] [seriesYear] [ficheiro-saida.json]');
  process.exit(1);
}
const establishmentNumber = process.argv[3] || '1';
const seriesYear = process.argv[4] || String(new Date().getFullYear());
const destino = process.argv[5] || path.join(__dirname, '..', `agt-solicitar-serie-${documentType}.json`);

const pedido = agtSeriesService.construirPedidoSerie({
  taxRegistrationNumber: TAX_REGISTRATION_NUMBER, seriesYear, documentType, establishmentNumber,
});

fs.writeFileSync(destino, JSON.stringify(pedido, null, 2), 'utf8');
console.error(`Escrito: ${destino}`);
