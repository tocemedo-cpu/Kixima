// src/services/feedbackService.js
// Avaliações públicas da homepage corporativa (secção "Avaliações").
//
// "Feedback real, não decorativo" — a promessa feita na própria secção. Por
// isso: nunca há testemunhos escritos à mão, uma avaliação só aparece na home
// depois de aprovada pelo Admin do Sistema, e a média mostrada conta TODAS as
// aprovadas, não só as poucas exibidas na parede de avaliações.
const prisma = require('../config/database');
const { NotFoundError, ValidationError } = require('../utils/errors');
const paginacao = require('../utils/paginacao');

const ROLES = ['Comprador', 'Fornecedor', 'Parceiro', 'Outro'];
const MENSAGEM_MAX = 700;

function limpar(valor, max) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}

/**
 * Submissão pública do formulário.
 *
 * `website` é o campo-armadilha ("honeypot"): invisível para uma pessoa,
 * irresistível para um robô de spam. Se vier preenchido, devolve sucesso sem
 * guardar nada — um robô que recebe erro tenta de outra forma; um que recebe
 * "sucesso" desiste, e a mensagem falsa nunca chega à base de dados.
 */
async function criar(dados = {}) {
  if (limpar(dados.website, 100)) {
    return { recebido: true };
  }

  const name = limpar(dados.name, 80);
  const company = limpar(dados.company, 120);
  const role = limpar(dados.role, 30);
  const message = limpar(dados.message, MENSAGEM_MAX);
  const rating = Number(dados.rating);

  if (!name || !company || !message) {
    throw new ValidationError('Preencha o nome, a empresa e o feedback.');
  }
  if (!ROLES.includes(role)) {
    throw new ValidationError(`Perfil inválido. Escolha um de: ${ROLES.join(', ')}.`);
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError('Selecione uma classificação entre 1 e 5.');
  }
  if (dados.consent !== true) {
    throw new ValidationError('É necessário autorizar a análise do feedback.');
  }

  const criado = await prisma.feedback.create({
    data: { name, company, role, rating, message },
  });
  return { recebido: true, id: criado.id };
}

/**
 * O que a homepage pública mostra: as avaliações aprovadas mais recentes
 * (limitadas, para a parede não crescer sem fim) e a média de TODAS as
 * aprovadas — não só as exibidas, para o número não mentir por omissão.
 */
async function publicar() {
  const where = { approved: true };
  const [recentes, agregados] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, name: true, company: true, role: true, rating: true, message: true },
    }),
    prisma.feedback.aggregate({ where, _avg: { rating: true }, _count: true }),
  ]);

  return {
    feedback: recentes,
    total: agregados._count,
    average: agregados._count ? Number(agregados._avg.rating.toFixed(1)) : 0,
  };
}

/** Fila de moderação do Admin do Sistema — tudo, aprovado ou não, mais recente primeiro. */
async function listarAdmin({ page, limit, status } = {}) {
  const p = paginacao.parametros({ page, limit });
  const where = status === 'pendente' ? { approved: false } : status === 'aprovado' ? { approved: true } : {};

  const [total, itens] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({ where, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }),
  ]);
  return paginacao.envelope(itens, total, p);
}

async function aprovar(id) {
  const existe = await prisma.feedback.findUnique({ where: { id } });
  if (!existe) throw new NotFoundError('Avaliação');
  return prisma.feedback.update({ where: { id }, data: { approved: true } });
}

/** Rejeitar É remover — não há um terceiro estado "rejeitado" a mostrar a ninguém. */
async function remover(id) {
  const existe = await prisma.feedback.findUnique({ where: { id } });
  if (!existe) throw new NotFoundError('Avaliação');
  await prisma.feedback.delete({ where: { id } });
}

module.exports = { ROLES, criar, publicar, listarAdmin, aprovar, remover };
