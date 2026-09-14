// tests/agt-chave-privada-arquivo.test.js
// config/env.js passou a aceitar a chave privada RSA (PEM) da AGT também a
// partir de um ficheiro local (src/chave/chavePrivada.pem), não só da
// variável AGT_JWS_PRIVATE_KEY_BASE64 — ver lerChavePrivadaAgt() em env.js.
// src/chave/ está no .gitignore (nunca é comitado); o ficheiro é sempre
// posto ali manualmente, nunca gerado por código.
//
// CUIDADO: este teste escreve mesmo o ficheiro real em disco (é o único jeito
// de testar fs.readFileSync do caminho real). O ficheiro pode legitimamente já
// ter a chave privada real (posta ali manualmente) — por isso o beforeAll
// guarda qualquer conteúdo que lá esteja e cada teste restaura-o (ou apaga o
// ficheiro, se não existia) em vez de apagar sempre. Só recusa continuar se
// encontrar CONTEUDO_FALSO já lá (sinal de um cleanup falhado de outra
// execução deste mesmo ficheiro de teste).
const fs = require('fs');
const path = require('path');

const CAMINHO = path.join(__dirname, '../src/chave/chavePrivada.pem');
const CONTEUDO_FALSO = '-----BEGIN PRIVATE KEY-----\nCONTEUDO-DE-TESTE-NAO-E-UMA-CHAVE-REAL\n-----END PRIVATE KEY-----\n';

let conteudoOriginal = null; // null = ficheiro não existia antes do teste

beforeAll(() => {
  if (fs.existsSync(CAMINHO)) {
    conteudoOriginal = fs.readFileSync(CAMINHO, 'utf8');
    if (conteudoOriginal === CONTEUDO_FALSO) {
      throw new Error(
        `${CAMINHO} contém o conteúdo de teste (CONTEUDO_FALSO) — sinal de um cleanup falhado de `
        + 'uma execução anterior deste ficheiro de teste; restaure o conteúdo real (ou apague o '
        + 'ficheiro) manualmente antes de correr este teste.',
      );
    }
  }
});

afterAll(() => {
  if (conteudoOriginal === null) fs.rmSync(CAMINHO, { force: true });
  else fs.writeFileSync(CAMINHO, conteudoOriginal, 'utf8');
});

function restaurar() {
  if (conteudoOriginal === null) fs.rmSync(CAMINHO, { force: true });
  else fs.writeFileSync(CAMINHO, conteudoOriginal, 'utf8');
}

describe('config/env.js — chave privada AGT a partir de ficheiro', () => {
  test('sem AGT_JWS_PRIVATE_KEY_BASE64, lê src/chave/chavePrivada.pem quando existe', () => {
    const original = process.env.AGT_JWS_PRIVATE_KEY_BASE64;
    delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;

    try {
      fs.writeFileSync(CAMINHO, CONTEUDO_FALSO, 'utf8');
      jest.resetModules();
      // eslint-disable-next-line global-require
      const config = require('../src/config/env');
      expect(config.agt.jwsPrivateKeyPem).toBe(CONTEUDO_FALSO);
    } finally {
      restaurar();
      if (original === undefined) delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;
      else process.env.AGT_JWS_PRIVATE_KEY_BASE64 = original;
      jest.resetModules();
    }
  });

  test('a variável de ambiente tem prioridade sobre o ficheiro, quando ambos existem', () => {
    const original = process.env.AGT_JWS_PRIVATE_KEY_BASE64;
    const chaveDaVariavel = '-----BEGIN PRIVATE KEY-----\nVEM-DA-VARIAVEL\n-----END PRIVATE KEY-----';
    process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(chaveDaVariavel).toString('base64');

    try {
      fs.writeFileSync(CAMINHO, CONTEUDO_FALSO, 'utf8');
      jest.resetModules();
      // eslint-disable-next-line global-require
      const config = require('../src/config/env');
      expect(config.agt.jwsPrivateKeyPem).toBe(chaveDaVariavel);
    } finally {
      restaurar();
      if (original === undefined) delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;
      else process.env.AGT_JWS_PRIVATE_KEY_BASE64 = original;
      jest.resetModules();
    }
  });

  test('sem variável e sem ficheiro, fica vazia (RECUSA-SE A FINGIR — nunca um valor inventado)', () => {
    const original = process.env.AGT_JWS_PRIVATE_KEY_BASE64;
    delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;

    try {
      // Remove mesmo o ficheiro (pode haver uma chave real guardada, restaurada
      // no finally abaixo) para testar a ausência total de configuração a sério.
      fs.rmSync(CAMINHO, { force: true });
      jest.resetModules();
      // eslint-disable-next-line global-require
      const config = require('../src/config/env');
      expect(config.agt.jwsPrivateKeyPem).toBe('');
    } finally {
      restaurar();
      if (original === undefined) delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;
      else process.env.AGT_JWS_PRIVATE_KEY_BASE64 = original;
      jest.resetModules();
    }
  });
});
