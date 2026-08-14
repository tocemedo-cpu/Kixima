// src/services/apiKeyService.js
// Chaves de API do catálogo (plano Pro).
//
// PARA QUE SERVEM: um fornecedor com catálogo grande mantém preços e stock no
// seu próprio sistema. Copiá-los à mão para a KIXIMA garante que ficam
// desatualizados — e preço desatualizado num marketplace não é um detalhe, é o
// comprador a encomendar por um valor que já não existe e a confiança a
// quebrar-se na primeira ordem.
//
// O QUE ISTO É, EM TERMOS DE SEGURANÇA: uma credencial que contorna o login E a
// verificação em dois passos. Um sistema não introduz um código de 6 dígitos.
// Não há como contornar isso — o que há é limitar o estrago:
//
//   1. o ALCANCE é estritamente o catálogo da própria empresa. Uma chave roubada
//      não chega a ordens, pagamentos, utilizadores nem documentos;
//   2. guarda-se o HASH. Quem leia a base de dados não fica com acesso a nada;
//   3. mostra-se UMA vez. Não há ecrã que a volte a revelar;
//   4. revoga-se sem apagar, para o histórico de uso continuar a existir;
//   5. cada uso fica com carimbo, para se poder ver uma chave que ninguém usa —
//      e essas são as que se revogam.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const planService = require('./planService');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');

const PREFIXO = 'kxm';
// Máximo de chaves ativas por empresa. Não é um limite comercial: é para a
// lista continuar a ser legível, porque uma lista de trinta chaves é uma lista
// que ninguém revê.
const MAXIMO_ATIVAS = 5;

// 32 bytes de aleatoriedade criptográfica. O prefixo serve para a pessoa
// reconhecer a chave numa lista; o resto é o segredo.
function gerar() {
  const publico = crypto.randomBytes(4).toString('hex');
  const segredo = crypto.randomBytes(32).toString('base64url');
  return { prefixo: `${PREFIXO}_${publico}`, chave: `${PREFIXO}_${publico}.${segredo}` };
}

// Separa a chave apresentada nas suas duas partes, sem lançar em lixo.
function partir(apresentada) {
  const [prefixo, segredo] = String(apresentada || '').split('.');
  if (!prefixo || !segredo || !prefixo.startsWith(`${PREFIXO}_`)) return null;
  return { prefixo, segredo };
}

async function listar(companyId) {
  const chaves = await prisma.apiKey.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, nome: true, prefixo: true, ultimoUso: true, revogadaEm: true, createdAt: true },
  });
  // A chave inteira não existe aqui — nem podia.
  return chaves.map((c) => ({ ...c, ativa: !c.revogadaEm }));
}

async function criar(company, { nome }, criadaPor = null) {
  planService.assertFeature(company, 'apiCatalogo', 'API de catálogo');
  if (!String(nome || '').trim()) {
    throw new BusinessRuleError('Dê um nome à chave (ex.: "ERP da produção") — é por ele que a vai reconhecer para revogar.');
  }
  const ativas = await prisma.apiKey.count({ where: { companyId: company.id, revogadaEm: null } });
  if (ativas >= MAXIMO_ATIVAS) {
    throw new BusinessRuleError(
      `Já tem ${MAXIMO_ATIVAS} chaves ativas. Revogue uma antes de criar outra — `
      + 'uma lista longa de chaves é uma lista que ninguém revê.',
    );
  }

  const { prefixo, chave } = gerar();
  const criada = await prisma.apiKey.create({
    data: { companyId: company.id, nome: String(nome).trim(), prefixo, hash: await bcrypt.hash(chave, 10), criadaPor },
    select: { id: true, nome: true, prefixo: true, createdAt: true },
  });

  // A chave inteira sai daqui uma única vez, e nunca mais.
  return {
    ...criada,
    chave,
    aviso: 'Guarde esta chave agora. Não voltará a ser mostrada — se a perder, revogue-a e crie outra.',
  };
}

async function revogar(companyId, id) {
  const chave = await prisma.apiKey.findFirst({ where: { id, companyId } });
  if (!chave) throw new NotFoundError('Chave de API');
  if (chave.revogadaEm) return { id, revogadaEm: chave.revogadaEm };
  // Revoga, não apaga: quem quiser saber o que aquela chave andou a fazer tem
  // de continuar a poder identificá-la no trilho de auditoria.
  const r = await prisma.apiKey.update({ where: { id }, data: { revogadaEm: new Date() } });
  return { id, revogadaEm: r.revogadaEm };
}

/**
 * Autentica uma chave apresentada. Devolve a empresa, ou null.
 *
 * A comparação é feita só contra a chave cujo PREFIXO bate certo — comparar
 * contra todas seria um bcrypt por chave existente a cada pedido.
 */
async function autenticar(apresentada) {
  const partes = partir(apresentada);
  if (!partes) return null;

  const registo = await prisma.apiKey.findUnique({
    where: { prefixo: partes.prefixo },
    include: { company: true },
  });
  if (!registo || registo.revogadaEm) return null;
  if (!(await bcrypt.compare(String(apresentada), registo.hash))) return null;

  // A chave é do plano Pro. Se a empresa descer de plano, a chave deixa de
  // valer — senão o Pro pagava-se uma vez e ficava para sempre.
  if (!planService.hasFeature(registo.company?.plan, 'apiCatalogo')) return null;
  if (registo.company?.status !== 'APROVADA' || registo.company?.active === false) return null;

  // Carimbo de uso, para se ver uma chave que ninguém usa. Sem esperar pela
  // escrita: um pedido de leitura não deve ficar mais lento por causa disto.
  prisma.apiKey.update({ where: { id: registo.id }, data: { ultimoUso: new Date() } }).catch(() => {});

  return { empresa: registo.company, chaveId: registo.id, prefixo: registo.prefixo };
}

module.exports = { criar, listar, revogar, autenticar, MAXIMO_ATIVAS };
