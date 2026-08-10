// scripts/sentry-test.js
// Envia um evento de teste ao Sentry com a configuração atual (SENTRY_DSN) — para
// confirmares que o rastreio está a chegar ao teu projeto. Sem DSN, avisa e sai.
// Correr:  npm run sentry:test
const { Sentry, enabled, captureException } = require('../src/config/sentry');
const config = require('../src/config/env');

async function main() {
  if (!enabled) {
    console.error('✗ Sentry DESLIGADO — a variável SENTRY_DSN não está definida.');
    console.error('  Define SENTRY_DSN (backend) e volta a correr: npm run sentry:test');
    process.exit(1);
  }
  console.log(`Ambiente: ${config.env}`);
  console.log('A enviar um evento de teste ao Sentry…');

  Sentry.captureMessage('KIXIMA — evento de teste (sentry:test)', 'info');
  captureException(new Error('KIXIMA — erro de teste (sentry:test)'), {
    method: 'CLI', originalUrl: 'npm run sentry:test',
  });

  const delivered = await Sentry.flush(8000);
  if (delivered) {
    console.log('✓ Evento enviado. Confirma em Sentry → Issues (pode levar alguns segundos).');
  } else {
    console.error('✗ Não foi possível entregar o evento (flush falhou). Verifica o DSN e a rede.');
    process.exit(2);
  }
}

main().catch((e) => { console.error('✗ Erro:', e.message); process.exit(1); });
