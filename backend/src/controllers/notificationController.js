const prisma = require('../config/database');
const paginacao = require('../utils/paginacao');

async function list(req, res) {
  // Estava aqui um `take: 50` fixo. Quem tivesse 60 notificações via 50 e não
  // tinha como saber das outras 10 — nem a interface, que recebia um array sem
  // contagem. Uma notificação é precisamente o tipo de coisa em que o
  // desaparecimento silencioso custa: ninguém procura o que não sabe que
  // existe.
  const p = paginacao.parametros(req.query);
  const where = { OR: [{ userId: req.user.id }, { companyId: req.user.companyId }] };

  const [total, itens, porLer] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take,
    }),
    // O contador do sino tem de contar TODAS as por ler, não só as desta
    // página — senão o número no ícone muda ao mudar de página, e passa a
    // parecer um erro.
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);

  res.json({ ...paginacao.envelope(itens, total, p), porLer });
}

async function markRead(req, res) {
  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { readAt: new Date() },
  });
  res.json(notification);
}

module.exports = { list, markRead };
