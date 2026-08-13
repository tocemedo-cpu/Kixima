// src/services/dadosPessoaisService.js
// Direitos do titular dos dados (Lei n.º 22/11 de Proteção de Dados Pessoais).
//
// A lei angolana dá ao titular o direito de ACEDER aos seus dados e de pedir a
// correção ou a eliminação. A plataforma guarda nomes, emails, telefones e o
// histórico de quem fez o quê — e não tinha forma nenhuma de responder a esse
// pedido, nem sequer manualmente.
//
// A TENSÃO CENTRAL, e como se resolve:
// Um utilizador pode pedir para ser esquecido, mas o trilho de auditoria
// financeira TEM de sobreviver — é o registo de quem aprovou que ordem e quem
// autorizou que pagamento, e a lei fiscal exige que se guarde durante anos.
// Apagar a linha do utilizador destruiria a integridade contabilística e
// deixaria ordens sem autor.
//
// Por isso a eliminação é uma ANONIMIZAÇÃO: os dados que identificam a pessoa
// são substituídos, a conta é desativada e o histórico mantém-se, ligado a um
// titular que já não é identificável. É o equilíbrio que a própria lei prevê
// quando há obrigação legal de conservação.
const prisma = require('../config/database');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');

// Tudo o que a plataforma sabe sobre uma pessoa, num único documento.
async function exportar(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true, active: true, avatarUrl: true,
      locale: true, approvalCap: true, createdAt: true, updatedAt: true,
      termsAcceptedAt: true, totpEnabledAt: true,
      company: { select: { id: true, name: true, taxId: true, type: true } },
    },
  });
  if (!user) throw new NotFoundError('Utilizador');

  const [ordensCriadas, ordensAprovadas, pagamentos, acoes, notificacoes] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { createdById: userId },
      select: { reference: true, status: true, totalAmount: true, currency: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.purchaseOrder.findMany({
      where: { approvedById: userId },
      select: { reference: true, status: true, approvedAt: true },
      orderBy: { approvedAt: 'desc' },
    }),
    prisma.payment.findMany({
      where: { processedById: userId },
      select: { amount: true, currency: true, status: true, processedAt: true },
      orderBy: { processedAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { actorId: userId },
      select: { action: true, entityType: true, entityRef: true, ip: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
    prisma.notification.findMany({
      where: { userId },
      select: { type: true, title: true, message: true, readAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
  ]);

  return {
    geradoEm: new Date(),
    aviso: 'Documento com os dados pessoais associados a esta conta na plataforma KIXIMA.',
    conta: user,
    atividade: {
      ordensCriadas,
      ordensAprovadas,
      pagamentosAutorizados: pagamentos,
      registoDeAcoes: acoes,
      notificacoesRecebidas: notificacoes,
    },
    totais: {
      ordensCriadas: ordensCriadas.length,
      ordensAprovadas: ordensAprovadas.length,
      pagamentosAutorizados: pagamentos.length,
      registoDeAcoes: acoes.length,
      notificacoesRecebidas: notificacoes.length,
    },
  };
}

// Marca que identifica uma conta anonimizada, sem revelar quem era.
function marcaAnonima(userId) {
  return `anonimizado-${String(userId).slice(0, 8)}`;
}

/**
 * Anonimiza uma conta a pedido do titular.
 *
 * O que DESAPARECE: nome, email, foto, idioma, segredo de 2FA, e o nome do ator
 * em todos os registos de auditoria.
 * O que FICA: as ordens, faturas, pagamentos e o próprio trilho — sem nome, mas
 * com a ligação intacta. Sem isso não haveria contabilidade que se sustentasse.
 */
async function anonimizar(userId, { motivo } = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('Utilizador');
  if (user.email.startsWith('anonimizado-')) {
    throw new BusinessRuleError('Esta conta já foi anonimizada.');
  }

  const marca = marcaAnonima(userId);
  return prisma.$transaction(async (tx) => {
    // 1. A conta perde tudo o que identifica a pessoa e deixa de poder entrar.
    const anonimo = await tx.user.update({
      where: { id: userId },
      data: {
        name: 'Utilizador anonimizado',
        email: `${marca}@anonimo.kixima`,
        avatarUrl: null,
        locale: null,
        totpSecret: null,
        totpEnabledAt: null,
        active: false,
        // Invalida qualquer sessão ainda aberta.
        tokenVersion: { increment: 1 },
      },
      select: { id: true, name: true, email: true, active: true },
    });

    // 2. O trilho mantém-se — é obrigação legal — mas sem o nome da pessoa.
    //    A ligação (actorId) fica, para o histórico continuar coerente.
    const trilho = await tx.auditLog.updateMany({
      where: { actorId: userId },
      data: { actorName: 'Utilizador anonimizado' },
    });

    // 3. As notificações são correspondência pessoal: essas apagam-se.
    const avisos = await tx.notification.deleteMany({ where: { userId } });

    return {
      utilizador: anonimo,
      registosDeAuditoriaPreservados: trilho.count,
      notificacoesEliminadas: avisos.count,
      motivo: motivo || null,
      anonimizadoEm: new Date(),
      nota: 'As ordens, faturas e pagamentos foram preservados sem identificação do titular, '
        + 'por obrigação legal de conservação contabilística.',
    };
  });
}

module.exports = { exportar, anonimizar };
