// tests/agt-chave-privada-arquivo.test.js
// config/env.js passou a aceitar a chave privada RSA (PEM) da AGT também a
// partir de um ficheiro local (src/chave/chavePrivada.pem), não só da
// variável AGT_JWS_PRIVATE_KEY_BASE64 — ver lerChavePrivadaAgt() em env.js.
// src/chave/ está no .gitignore (nunca é comitado); o ficheiro é sempre
// posto ali manualmente, nunca gerado por código.
//
// As chaves usadas aqui têm de ser RSA A SÉRIO (geradas só para o teste,
// nunca a chave real): desde que env.js passou a validar com
// crypto.createPrivateKey (não só as marcações -----BEGIN/END-----), texto
// placeholder já não passa em nenhuma das 3 fontes — é exatamente o
// comportamento que se quer confirmar.
//
// CUIDADO: este teste escreve mesmo o ficheiro real em disco (é o único jeito
// de testar fs.readFileSync do caminho real). O ficheiro pode legitimamente já
// ter a chave privada real (posta ali manualmente) — por isso o beforeAll
// guarda qualquer conteúdo que lá esteja e cada teste restaura-o (ou apaga o
// ficheiro, se não existia) em vez de apagar sempre. Só recusa continuar se
// encontrar CHAVE_FICHEIRO já lá (sinal de um cleanup falhado de outra
// execução deste mesmo ficheiro de teste).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function gerarChaveTeste() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey;
}

const CAMINHO = path.join(__dirname, '../src/chave/chavePrivada.pem');
const CHAVE_FICHEIRO = gerarChaveTeste();
const CHAVE_VARIAVEL = gerarChaveTeste();

let conteudoOriginal = null; // null = ficheiro não existia antes do teste

beforeAll(() => {
  if (fs.existsSync(CAMINHO)) {
    conteudoOriginal = fs.readFileSync(CAMINHO, 'utf8');
    if (conteudoOriginal === CHAVE_FICHEIRO) {
      throw new Error(
        `${CAMINHO} contém o conteúdo de teste (CHAVE_FICHEIRO) — sinal de um cleanup falhado de `
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
      fs.writeFileSync(CAMINHO, CHAVE_FICHEIRO, 'utf8');
      jest.resetModules();
      // eslint-disable-next-line global-require
      const config = require('../src/config/env');
      expect(config.agt.jwsPrivateKeyPem).toBe(CHAVE_FICHEIRO);
    } finally {
      restaurar();
      if (original === undefined) delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;
      else process.env.AGT_JWS_PRIVATE_KEY_BASE64 = original;
      jest.resetModules();
    }
  });

  test('a variável de ambiente tem prioridade sobre o ficheiro, quando ambos existem (e ambos são válidos)', () => {
    const original = process.env.AGT_JWS_PRIVATE_KEY_BASE64;
    process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(CHAVE_VARIAVEL).toString('base64');

    try {
      fs.writeFileSync(CAMINHO, CHAVE_FICHEIRO, 'utf8');
      jest.resetModules();
      // eslint-disable-next-line global-require
      const config = require('../src/config/env');
      expect(config.agt.jwsPrivateKeyPem).toBe(CHAVE_VARIAVEL);
    } finally {
      restaurar();
      if (original === undefined) delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;
      else process.env.AGT_JWS_PRIVATE_KEY_BASE64 = original;
      jest.resetModules();
    }
  });

  test('AGT_JWS_PRIVATE_KEY_BASE64 cortado/corrompido (não decodifica para uma chave real) cai para o ficheiro, em vez de produzir lixo', () => {
    // Caso real: um painel de variáveis de ambiente (confirmado no Render)
    // corta valores deste tamanho (~2300 caracteres) sem avisar — o Base64
    // fica presente mas decodifica para algo que não é uma chave válida.
    // Antes desta validação, esse valor cortado passava direto para
    // crypto.sign() e rebentava lá dentro com um erro OpenSSL sem contexto
    // nenhum ("DECODER routines::unsupported"). Reproduzido localmente
    // truncando o Base64 de uma chave real — mesmo erro exato.
    const original = process.env.AGT_JWS_PRIVATE_KEY_BASE64;
    const base64Completo = Buffer.from(CHAVE_VARIAVEL).toString('base64');
    process.env.AGT_JWS_PRIVATE_KEY_BASE64 = base64Completo.slice(0, -50); // cortado

    try {
      fs.writeFileSync(CAMINHO, CHAVE_FICHEIRO, 'utf8');
      jest.resetModules();
      // eslint-disable-next-line global-require
      const config = require('../src/config/env');
      expect(config.agt.jwsPrivateKeyPem).toBe(CHAVE_FICHEIRO);
    } finally {
      restaurar();
      if (original === undefined) delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;
      else process.env.AGT_JWS_PRIVATE_KEY_BASE64 = original;
      jest.resetModules();
    }
  });

  test('texto com as marcações -----BEGIN/END----- mas que não é uma chave real é rejeitado, mesmo sem estar cortado', () => {
    // Diferente do teste de corte: aqui o Base64 é válido e completo, mas o
    // que decodifica tem as fences certas e lixo no meio — pareceUmPem()
    // sozinho deixaria passar; crypto.createPrivateKey() é que apanha isto.
    const original = process.env.AGT_JWS_PRIVATE_KEY_BASE64;
    const textoComFencesMasInvalido = '-----BEGIN PRIVATE KEY-----\nCONTEUDO-QUE-NAO-E-UMA-CHAVE-REAL\n-----END PRIVATE KEY-----\n';
    process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(textoComFencesMasInvalido).toString('base64');

    try {
      fs.writeFileSync(CAMINHO, CHAVE_FICHEIRO, 'utf8');
      jest.resetModules();
      // eslint-disable-next-line global-require
      const config = require('../src/config/env');
      expect(config.agt.jwsPrivateKeyPem).toBe(CHAVE_FICHEIRO);
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
      if (original === undefined) delete process.env.AGT_JWS_PRIVATE_KEY_BASE64;
      else process.env.AGT_JWS_PRIVATE_KEY_BASE64 = original;
      jest.resetModules();
    }
  });
});
