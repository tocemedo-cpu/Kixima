// src/services/feedbackService.js
// Avaliações da homepage corporativa (secção "Avaliações Verificadas").
//
// Só quem tem sessão e empresa na KIXIMA pode avaliar — nunca anónimo. É
// exatamente isso que torna o selo "Verificado" real: a autoria vem sempre de
// req.user (nome/empresa nunca são digitados à mão), e o alvo da avaliação
// (fornecedor, produto, pedido, entrega, pagamento, atendimento) tem de ser
// algo que a empresa do autor realmente viveu — validado em resolverAlvo()
// antes de guardar. "Experiência geral" é a única categoria sem alvo.
//
// Uma avaliação só aparece na home depois de aprovada pelo Admin do Sistema
// (Suporte); a média mostrada conta sempre TODAS as aprovadas, não só as
// exibidas na parede.
const prisma = require('../config/database');
const { NotFoundError, ValidationError } = require('../utils/errors');
const paginacao = require('../utils/paginacao');

const CATEGORIAS = ['FORNECEDOR', 'PRODUTO', 'SERVICO', 'PEDIDO', 'ENTREGA', 'PAGAMENTO', 'ATENDIMENTO', 'EXPERIENCIA_GERAL'];
const MENSAGEM_MAX = 700;
const OPCOES_LIMITE = 30; // por categoria — o suficiente para escolher sem paginar um dropdown

function limpar(valor, max) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}

// Usado por minhas() e pela moderação do Admin do Sistema — inclui
// `approved`, para quem tem de saber em que estado a avaliação está.
const SUMMARY = { id: true, user: { select: { name: true } }, company: { select: { name: true } }, categoria: true, targetLabel: true, rating: true, message: true, verified: true, approved: true, createdAt: true };
// A parede pública nunca mostra `approved` — é um detalhe interno de
// moderação, não algo para expor a quem só lê a homepage.
const PUBLIC_SUMMARY = { id: true, user: { select: { name: true } }, company: { select: { name: true } }, categoria: true, targetLabel: true, rating: true, message: true, verified: true, createdAt: true };

/**
 * Opções reais para o dropdown de "sobre o que é esta avaliação", por
 * categoria — construídas a partir do histórico real da empresa do
 * utilizador (como compradora OU fornecedora, conforme o lado em que
 * participou), nunca inventadas. Ordenadas por mais recente.
 */
async function opcoes({ companyId, userId }) {
  if (!companyId) return { FORNECEDOR: [], PRODUTO: [], SERVICO: [], PEDIDO: [], ENTREGA: [], PAGAMENTO: [], ATENDIMENTO: [] };

  const [pedidos, tickets] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { OR: [{ buyerCompanyId: companyId }, { supplierCompanyId: companyId }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, reference: true, createdAt: true, deliveredAt: true, receivedAt: true,
        buyerCompanyId: true, supplierCompanyId: true,
        buyerCompany: { select: { id: true, name: true } },
        supplierCompany: { select: { id: true, name: true } },
        items: { select: { product: { select: { id: true, name: true, kind: true } } } },
        invoice: { select: { payment: { select: { id: true, reference: true, status: true, processedAt: true } } } },
      },
    }),
    prisma.supportTicket.findMany({
      where: { OR: [{ companyId }, { userId }] },
      orderBy: { createdAt: 'desc' },
      take: OPCOES_LIMITE,
      select: { id: true, reference: true, subject: true, createdAt: true },
    }),
  ]);

  const fornecedores = new Map();
  const produtos = new Map();
  const servicos = new Map();
  const entregas = [];
  const pagamentos = [];

  const pedidosOpts = pedidos.map((po) => {
    const souComprador = po.buyerCompanyId === companyId;
    const contraparte = souComprador ? po.supplierCompany : po.buyerCompany;
    if (contraparte && !fornecedores.has(contraparte.id)) {
      fornecedores.set(contraparte.id, { id: contraparte.id, label: contraparte.name });
    }
    for (const item of po.items) {
      const p = item.product;
      if (!p) continue;
      const alvo = p.kind === 'SERVICO' ? servicos : produtos;
      if (!alvo.has(p.id)) alvo.set(p.id, { id: p.id, label: p.name });
    }
    if (po.deliveredAt || po.receivedAt) {
      entregas.push({ id: po.id, label: `${po.reference} — ${contraparte?.name || ''}` });
    }
    const pagamento = po.invoice?.payment;
    if (pagamento && pagamento.status === 'PROCESSADO') {
      pagamentos.push({ id: pagamento.id, label: `${pagamento.reference} — ${po.reference}` });
    }
    return { id: po.id, label: `${po.reference} — ${contraparte?.name || ''}` };
  });

  return {
    FORNECEDOR: [...fornecedores.values()].slice(0, OPCOES_LIMITE),
    PRODUTO: [...produtos.values()].slice(0, OPCOES_LIMITE),
    SERVICO: [...servicos.values()].slice(0, OPCOES_LIMITE),
    PEDIDO: pedidosOpts.slice(0, OPCOES_LIMITE),
    ENTREGA: entregas.slice(0, OPCOES_LIMITE),
    PAGAMENTO: pagamentos.slice(0, OPCOES_LIMITE),
    ATENDIMENTO: tickets.map((t) => ({ id: t.id, label: `${t.reference} — ${t.subject}` })),
  };
}

/**
 * Confirma que o alvo escolhido pertence mesmo ao histórico da empresa do
 * autor (nunca confiar num id vindo do cliente) e devolve o rótulo a
 * guardar como snapshot. Atira ValidationError se não encontrar nada —
 * silenciosamente aceitar um id qualquer tornaria o selo "Verificado" uma
 * mentira.
 */
async function resolverAlvo({ categoria, targetId, companyId, userId }) {
  if (categoria === 'EXPERIENCIA_GERAL') return { targetId: null, targetLabel: null };

  if (!targetId) throw new ValidationError('Escolha a que se refere esta avaliação.');

  const naoEncontrado = () => new ValidationError('Não encontrámos esse registo no histórico da sua empresa.');

  if (categoria === 'FORNECEDOR') {
    const po = await prisma.purchaseOrder.findFirst({
      where: {
        OR: [
          { buyerCompanyId: companyId, supplierCompanyId: targetId },
          { supplierCompanyId: companyId, buyerCompanyId: targetId },
        ],
      },
      select: { buyerCompany: { select: { id: true, name: true } }, supplierCompany: { select: { id: true, name: true } }, buyerCompanyId: true },
    });
    if (!po) throw naoEncontrado();
    const contraparte = po.buyerCompanyId === companyId ? po.supplierCompany : po.buyerCompany;
    return { targetId, targetLabel: contraparte.name };
  }

  if (categoria === 'PRODUTO' || categoria === 'SERVICO') {
    const item = await prisma.purchaseOrderItem.findFirst({
      where: {
        productId: targetId,
        purchaseOrder: { OR: [{ buyerCompanyId: companyId }, { supplierCompanyId: companyId }] },
      },
      select: { product: { select: { name: true, kind: true } } },
    });
    if (!item || item.product.kind !== categoria) throw naoEncontrado();
    return { targetId, targetLabel: item.product.name };
  }

  if (categoria === 'PEDIDO' || categoria === 'ENTREGA') {
    const po = await prisma.purchaseOrder.findFirst({
      where: {
        id: targetId,
        OR: [{ buyerCompanyId: companyId }, { supplierCompanyId: companyId }],
      },
      select: { reference: true, buyerCompanyId: true, buyerCompany: { select: { name: true } }, supplierCompany: { select: { name: true } }, deliveredAt: true, receivedAt: true },
    });
    if (!po) throw naoEncontrado();
    if (categoria === 'ENTREGA' && !po.deliveredAt && !po.receivedAt) throw naoEncontrado();
    const contraparte = po.buyerCompanyId === companyId ? po.supplierCompany : po.buyerCompany;
    return { targetId, targetLabel: `${po.reference} — ${contraparte?.name || ''}` };
  }

  if (categoria === 'PAGAMENTO') {
    const pagamento = await prisma.payment.findFirst({
      where: {
        id: targetId,
        status: 'PROCESSADO',
        invoice: { purchaseOrder: { OR: [{ buyerCompanyId: companyId }, { supplierCompanyId: companyId }] } },
      },
      select: { reference: true, invoice: { select: { purchaseOrder: { select: { reference: true } } } } },
    });
    if (!pagamento) throw naoEncontrado();
    return { targetId, targetLabel: `${pagamento.reference} — ${pagamento.invoice?.purchaseOrder?.reference || ''}` };
  }

  if (categoria === 'ATENDIMENTO') {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: targetId, OR: [{ companyId }, { userId }] },
      select: { reference: true, subject: true },
    });
    if (!ticket) throw naoEncontrado();
    return { targetId, targetLabel: `${ticket.reference} — ${ticket.subject}` };
  }

  throw naoEncontrado();
}

/** Submissão pelo utilizador autenticado — nome e empresa vêm sempre da sessão. */
async function criar({ userId, companyId, categoria, targetId, rating, message }) {
  if (!companyId) throw new ValidationError('É necessário pertencer a uma empresa para enviar uma avaliação.');
  if (!CATEGORIAS.includes(categoria)) throw new ValidationError(`Categoria inválida. Escolha uma de: ${CATEGORIAS.join(', ')}.`);

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    throw new ValidationError('Selecione uma classificação entre 1 e 5.');
  }

  const mensagemLimpa = limpar(message, MENSAGEM_MAX);
  if (!mensagemLimpa) throw new ValidationError('Escreva um comentário.');

  const alvo = await resolverAlvo({ categoria, targetId, companyId, userId });

  const criado = await prisma.feedback.create({
    data: {
      userId, companyId, categoria,
      targetId: alvo.targetId, targetLabel: alvo.targetLabel,
      rating: ratingNum, message: mensagemLimpa,
      verified: true,
    },
  });
  return { recebido: true, id: criado.id };
}

/** As avaliações do próprio utilizador (qualquer estado) — para acompanhar o que já enviou. */
async function minhas({ userId }) {
  return prisma.feedback.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: SUMMARY,
  });
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
      select: PUBLIC_SUMMARY,
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
    prisma.feedback.findMany({ where, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take, select: SUMMARY }),
  ]);
  return paginacao.envelope(itens, total, p);
}

async function aprovar(id) {
  const existe = await prisma.feedback.findUnique({ where: { id } });
  if (!existe) throw new NotFoundError('Avaliação');
  return prisma.feedback.update({ where: { id }, data: { approved: true }, select: SUMMARY });
}

/** Rejeitar É remover — não há um terceiro estado "rejeitado" a mostrar a ninguém. */
async function remover(id) {
  const existe = await prisma.feedback.findUnique({ where: { id } });
  if (!existe) throw new NotFoundError('Avaliação');
  await prisma.feedback.delete({ where: { id } });
}

module.exports = { CATEGORIAS, opcoes, criar, minhas, publicar, listarAdmin, aprovar, remover };
