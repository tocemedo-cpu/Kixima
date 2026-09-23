// src/services/uploadAccessService.js
// Quem pode ver um ficheiro servido por /api/uploads/:filename.
//
// Todos os ficheiros carregados (fotos de produto, documentos de
// credenciamento, comprovativos de pagamento, anexos de chat) vivem na MESMA
// pasta em modo 'local' (ver storageService.js) — o nome do ficheiro sozinho
// não diz se é público ou privado. A verificação de posse é sobre o REGISTO
// da base de dados que referencia esse ficheiro, não sobre o ficheiro em si.
//
// Por omissão nega-se: um ficheiro que não é referenciado por nenhuma tabela
// conhecida não é servido a ninguém que não seja Admin do Sistema — mais vale
// um 404 num caso raro (upload ainda não gravado, ou órfão) do que servir
// algo às cegas.
const prisma = require('../config/database');
const supportChatService = require('./supportChatService');
const conversationService = require('./conversationService');

function urlPara(filename) {
  return `/api/uploads/${filename}`;
}

// Materiais de marketing/catálogo e imagens de perfil: pensados para serem
// vistos por qualquer visitante do marketplace, com ou sem sessão.
async function encontraPublico(url) {
  const [capa, galeria, docProduto, avatar, ajuda] = await Promise.all([
    prisma.product.findFirst({ where: { imageUrl: url }, select: { id: true } }),
    prisma.productImage.findFirst({ where: { url }, select: { id: true } }),
    prisma.productDocument.findFirst({ where: { fileUrl: url }, select: { id: true } }),
    prisma.user.findFirst({ where: { avatarUrl: url }, select: { id: true } }),
    prisma.supportCategoryImage.findFirst({ where: { imageUrl: url }, select: { key: true } }),
  ]);
  return Boolean(capa || galeria || docProduto || avatar || ajuda);
}

// Documentos e comprovativos privados: exige que a empresa do utilizador seja
// a dona do registo. Devolve `null` se o URL não corresponde a nenhum destes
// (para o chamador continuar a procurar, ou negar por omissão).
async function encontraPrivadoPorEmpresa(url) {
  const doc = await prisma.companyDocument.findFirst({ where: { fileUrl: url }, select: { companyId: true } });
  if (doc) return doc.companyId;

  const subscricao = await prisma.planoCobranca.findFirst({ where: { comprovativoUrl: url }, select: { companyId: true } });
  if (subscricao) return subscricao.companyId;

  const addon = await prisma.addonCobranca.findFirst({ where: { comprovativoUrl: url }, select: { companyId: true } });
  if (addon) return addon.companyId;

  return null;
}

// O comprovativo de pagamento é visível às DUAS empresas da transação — quem
// pagou (comprador) e quem recebe (fornecedor) — nunca só a uma.
async function encontraDonosDoPagamento(url) {
  const pagamento = await prisma.payment.findFirst({
    where: { proofUrl: url },
    select: {
      invoice: {
        select: {
          purchaseOrder: { select: { buyerCompanyId: true, supplierCompanyId: true } },
          contract: { select: { clientCompanyId: true, supplierCompanyId: true } },
        },
      },
    },
  });
  if (!pagamento) return null;
  const buyerCompanyId = pagamento.invoice.purchaseOrder?.buyerCompanyId ?? pagamento.invoice.contract?.clientCompanyId ?? null;
  const supplierCompanyId = pagamento.invoice.purchaseOrder?.supplierCompanyId ?? pagamento.invoice.contract?.supplierCompanyId ?? null;
  return [buyerCompanyId, supplierCompanyId].filter(Boolean);
}

/**
 * Resolve o acesso de `user` (pode ser null — pedido sem sessão) ao ficheiro
 * `filename`. Devolve:
 *   { publico: true }                — serve a qualquer pedido, com ou sem sessão
 *   { permitido: true|false }        — só faz sentido com sessão; decide 401 vs 403
 */
async function resolverAcesso(filename, user) {
  const url = urlPara(filename);

  if (await encontraPublico(url)) return { publico: true };
  if (user?.role === 'ADMIN_SISTEMA') return { permitido: true };
  if (!user) return { permitido: false };

  const companyDono = await encontraPrivadoPorEmpresa(url);
  if (companyDono) return { permitido: companyDono === user.companyId };

  const donosPagamento = await encontraDonosDoPagamento(url);
  if (donosPagamento) return { permitido: donosPagamento.includes(user.companyId) };

  const mensagemSuporte = await prisma.supportMessage.findFirst({ where: { attachmentUrl: url }, select: { ticketId: true } });
  if (mensagemSuporte) {
    try {
      await supportChatService.ticketComAcesso(mensagemSuporte.ticketId, user);
      return { permitido: true };
    } catch {
      return { permitido: false };
    }
  }

  const mensagemConversa = await prisma.conversationMessage.findFirst({ where: { attachmentUrl: url }, select: { conversationId: true } });
  if (mensagemConversa) {
    try {
      await conversationService.conversationComAcesso(mensagemConversa.conversationId, user);
      return { permitido: true };
    } catch {
      return { permitido: false };
    }
  }

  // Nenhuma tabela conhecida referencia este ficheiro (cópias de segurança
  // nunca são servidas por aqui, ou um registo ainda não foi gravado) — nega-se.
  return { permitido: false };
}

module.exports = { resolverAcesso };
