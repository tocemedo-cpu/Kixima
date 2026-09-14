// tests/agt-chave-privada-arquivo.test.js
// config/env.js passou a aceitar a chave privada RSA (PEM) da AGT também a
// partir de um ficheiro local (src/chave/chavePrivada.pem), não só da
// variável AGT_JWS_PRIVATE_KEY_BASE64 — ver lerChavePrivadaAgt() em env.js.
// src/chave/ está no .gitignore (nunca é comitado); o ficheiro é sempre
// posto ali manualmente, nunca gerado por código.
//
// CUIDADO: este teste escreve mesmo o ficheiro real em disco (é o único jeito
// de testar fs.readFileSync do caminho real). O ficheiro pode legitimamente já
// existir (vazio) como placeholder à espera da chave real — por isso o
// beforeAll só recusa continuar se encontrar conteúdo a sério ali (sinal de um
// cleanup falhado de outra execução), e cada teste restaura o conteúdo
// original (ou apaga, se não existia) em vez de apagar sempre.
const fs = require('fs');
const path = require('path');

const CAMINHO = path.join(__dirname, '../src/chave/chavePrivada.pem');
const CONTEUDO_FALSO = '-----BEGIN PRIVATE KEY-----\nCONTEUDO-DE-TESTE-NAO-E-UMA-CHAVE-REAL\n-----END PRIVATE KEY-----\n';

let conteudoOriginal = null; // null = ficheiro não existia antes do teste

beforeAll(() => {
  if (fs.existsSync(CAMINHO)) {
    conteudoOriginal = fs.readFileSync(CAMINHO, 'utf8');
    if (conteudoOriginal.trim() !== '') {
      throw new Error(
        `${CAMINHO} já tem conteúdo antes do teste começar (não está vazio) — não é seguro `
        + 'sobrescrever. Verifique se não é a chave real e, se for apenas lixo de um cleanup '
        + 'falhado, apague-o manualmente antes de correr este teste.',
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

  test('sem variável e sem ficheiro (ou ficheiro vazio), fica vazia (RECUSA-SE A FINGIR — nunca um valor inventado)', () => {
    const original = process.env.AGT_JWS_PRIVATE_KEY_BASE64;
    delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;

    try {
      restaurar();
      if (fs.existsSync(CAMINHO)) {
        expect(fs.readFileSync(CAMINHO, 'utf8').trim()).toBe('');
      }
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
