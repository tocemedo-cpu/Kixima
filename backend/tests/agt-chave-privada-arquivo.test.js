// tests/agt-chave-privada-arquivo.test.js
// config/env.js passou a aceitar a chave privada RSA (PEM) da AGT também a
// partir de um ficheiro local (src/chave/chavePrivada.pem), não só da
// variável AGT_JWS_PRIVATE_KEY_BASE64 — ver lerChavePrivadaAgt() em env.js.
// src/chave/ está no .gitignore (nunca é comitado); o ficheiro é sempre
// posto ali manualmente, nunca gerado por código.
//
// CUIDADO: este teste escreve mesmo o ficheiro real em disco (é o único jeito
// de testar fs.readFileSync do caminho real) — por isso cria-o e apaga-o
// dentro do MESMO teste, num try/finally, para nunca deixar rasto que
// contamine os testes "sem configuração" de outros ficheiros (esses assumem
// que nem a variável nem o ficheiro existem).
const fs = require('fs');
const path = require('path');

const CAMINHO = path.join(__dirname, '../src/chave/chavePrivada.pem');
const CONTEUDO_FALSO = '-----BEGIN PRIVATE KEY-----\nCONTEUDO-DE-TESTE-NAO-E-UMA-CHAVE-REAL\n-----END PRIVATE KEY-----\n';

beforeAll(() => {
  // Confirma que não há nada gravado ali de uma execução anterior falhada —
  // se houver, o teste para em vez de mascarar um cleanup que falhou antes.
  if (fs.existsSync(CAMINHO)) {
    throw new Error(`${CAMINHO} já existe antes do teste começar — apague-o manualmente antes de correr este teste.`);
  }
});

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
      fs.rmSync(CAMINHO, { force: true });
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
      fs.rmSync(CAMINHO, { force: true });
      if (original === undefined) delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;
      else process.env.AGT_JWS_PRIVATE_KEY_BASE64 = original;
      jest.resetModules();
    }
  });

  test('sem variável e sem ficheiro, fica vazia (RECUSA-SE A FINGIR — nunca um valor inventado)', () => {
    const original = process.env.AGT_JWS_PRIVATE_KEY_BASE64;
    delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;

    try {
      expect(fs.existsSync(CAMINHO)).toBe(false);
      jest.resetModules();
      // eslint-disable-next-line global-require
      const config = require('../src/config/env');
      expect(config.agt.jwsPrivateKeyPem).toBe('');
    } finally {
      if (original === undefined) delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;
      else process.env.AGT_JWS_PRIVATE_KEY_BASE64 = original;
      jest.resetModules();
    }
  });
});
