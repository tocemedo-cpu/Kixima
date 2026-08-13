// src/routes/adminRoutes.js
// Administração global — apenas o Admin do Sistema (Permissões e Gestão de
// Atividades de todo o sistema).
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const adminService = require('../services/adminService');
const auditService = require('../services/auditService');
const prontidaoService = require('../services/prontidaoService');
const backupJob = require('../jobs/backupJob');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('ADMIN_SISTEMA'));

router.get('/users', async (req, res) => res.json(await adminService.listUsers()));

router.patch('/users/:id/status', async (req, res) => {
  const user = await adminService.setUserStatus({ id: req.params.id, active: req.body.active, actingUserId: req.user.id });
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: user.active ? 'UTILIZADOR_DESBLOQUEADO' : 'UTILIZADOR_BLOQUEADO',
    entityType: 'User',
    entityId: user.id,
    entityRef: user.name,
    detail: { papel: user.role },
  });
  res.json(user);
});

router.get('/activities', async (req, res) => res.json(await adminService.systemActivities()));

// Livro de taxas da plataforma (KIXIMA).
router.get('/platform-fees', async (req, res) => res.json(await adminService.listPlatformFees()));
router.patch('/platform-fees/:id/charge', async (req, res) => {
  const fee = await adminService.chargePlatformFee(req.params.id);
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'TAXA_COBRADA',
    entityType: 'PlatformFee',
    entityId: fee.id,
    entityRef: fee.reference || fee.id,
    detail: { valor: String(fee.amount), moeda: fee.currency || 'AOA' },
  });
  res.json(fee);
});

// Trilho de auditoria financeira (append-only) — consulta paginada/filtrável.
router.get('/audit-logs', async (req, res) => {
  res.json(await auditService.list({
    page: req.query.page, limit: req.query.limit, action: req.query.action, q: req.query.q,
  }));
});

// --- Prontidão para produção ------------------------------------------------
// As definições que protegem a plataforma vivem em variáveis de ambiente
// definidas noutro sítio (o painel do Render), e uma variável esquecida ou mal
// escrita não dá erro nenhum: a aplicação arranca e finge que está tudo bem. O
// plano gratuito não dá shell, por isso esta é a única forma de ir confirmar.
router.get('/prontidao', async (req, res) => res.json(await prontidaoService.verificar()));

// Fazer uma cópia de segurança AGORA.
//
// Existe porque uma cópia agendada que nunca foi vista a correr é uma suposição.
// Este botão confirma, de uma vez, que o pg_dump está na imagem, que a
// DIRECT_URL serve, que as credenciais S3 são aceites e que o bucket privado
// recebe o ficheiro — antes de se confiar no agendamento das 03:00.
router.post('/backup', async (req, res) => {
  const motivo = backupJob.motivoParaNaoCorrer();
  if (motivo) return res.status(422).json({ error: { message: motivo } });

  const inicio = Date.now();
  try {
    const r = await backupJob.copiar();
    await auditService.recordSafe({
      actor: auditService.actorFrom(req),
      action: 'COPIA_SEGURANCA_MANUAL',
      entityType: 'Backup',
      detail: { megabytes: Number((r.bytes / 1024 / 1024).toFixed(2)), segundos: Number(r.segundos.toFixed(1)) },
    });
    res.json({
      megabytes: Number((r.bytes / 1024 / 1024).toFixed(2)),
      segundos: Number(r.segundos.toFixed(1)),
      // O destino inclui o caminho no bucket privado, não um link público.
      destino: r.destino,
    });
  } catch (err) {
    // O erro cru do pg_dump ou do SDK não diz o que corrigir; é o que aqui se
    // devolve, para o problema ser resolúvel sem ir ao registo do serviço.
    res.status(502).json({
      error: { message: `A cópia falhou ao fim de ${((Date.now() - inicio) / 1000).toFixed(1)}s: ${err.message}` },
    });
  }
});

module.exports = router;
