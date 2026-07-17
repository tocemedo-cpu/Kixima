const prisma = require('../config/database');

async function list(req, res) {
  const notifications = await prisma.notification.findMany({
    where: {
      OR: [{ userId: req.user.id }, { companyId: req.user.companyId }],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
}

async function markRead(req, res) {
  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { readAt: new Date() },
  });
  res.json(notification);
}

module.exports = { list, markRead };
