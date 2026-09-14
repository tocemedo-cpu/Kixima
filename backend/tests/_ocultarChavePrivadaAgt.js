// tests/_ocultarChavePrivadaAgt.js
// Esconde temporariamente a chave privada real da AGT (src/chave/chavePrivada.pem,
// posta ali manualmente, fora do git) enquanto correm os testes do caminho
// "sem configuração" — sem isto, esses testes deixam de testar o que dizem
// testar, porque a chave real fica sempre disponível em disco.
//
// Chamar oculta() na PRIMEIRA linha do ficheiro de teste, antes de qualquer
// outro require (incluindo require('./helpers'), que já carrega a app e por
// tabela config/env.js). Chamar restaurar(...) num afterAll.
//
// maxWorkers é 1 (ver jest.config.js) — os ficheiros de teste correm em série,
// nunca em paralelo, por isso não há corrida entre ficheiros a esconder/repor
// o mesmo ficheiro real.
const fs = require('fs');
const path = require('path');

const CAMINHO_REAL = path.join(__dirname, '../src/chave/chavePrivada.pem');
const CAMINHO_OCULTO = path.join(__dirname, '../src/chave/.chavePrivada.pem.oculta-para-teste');

function oculta() {
  if (fs.existsSync(CAMINHO_OCULTO)) {
    throw new Error(
      `${CAMINHO_OCULTO} já existe — sinal de um cleanup falhado de uma execução anterior de `
      + 'testes; apague-o (ou renomeie-o de volta) manualmente antes de correr os testes.',
    );
  }
  if (fs.existsSync(CAMINHO_REAL)) {
    fs.renameSync(CAMINHO_REAL, CAMINHO_OCULTO);
    return true;
  }
  return false;
}

function restaurar(estavaPresente) {
  if (estavaPresente) fs.renameSync(CAMINHO_OCULTO, CAMINHO_REAL);
}

module.exports = { oculta, restaurar };
