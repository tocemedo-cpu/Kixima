// src/routes/adminRoutes.js
// Administração global — apenas o Admin do Sistema (Permissões e Gestão de
// Atividades de todo o sistema).
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermission, requireSuperAdmin } = require('../middleware/rbac');
const { FINANCEIRO, OPERACOES, AREAS_ADMIN } = require('../utils/adminAreas');
const adminService = require('../services/adminService');
const auditService = require('../services/auditService');
const prontidaoService = require('../services/prontidaoService');
const backupJob = require('../jobs/backupJob');
const notificationService = require('../services/notificationService');
const mfaLembreteService = require('../services/mfaLembreteService');
const backupVerificacao = require('../services/backupVerificacaoService');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('ADMIN_SISTEMA'));

// Gerir QUEM tem acesso ao sistema e a que ÁREAS, não se delega — ver a nota em
// requireSuperAdmin(). É por isto que estas duas rotas não têm
// requirePermission nenhum: são a camada que decide as permissões das outras.
router.get('/users', requireSuperAdmin(), async (req, res) => res.json(await adminService.listUsers()));

router.patch('/users/:id/status', requireSuperAdmin(), async (req, res) => {
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

// Atribuir áreas a um Admin do Sistema — o que o torna um assessor (áreas
// preenchidas) ou um Super Admin (vazio). Ver a nota em requireSuperAdmin():
// só quem já é Super Admin pode fazer isto, para ninguém se poder atribuir
// mais poder a si próprio.
router.patch('/users/:id/areas', requireSuperAdmin(), async (req, res) => {
  const areas = Array.isArray(req.body?.areas) ? req.body.areas : [];
  const invalidas = areas.filter((a) => !AREAS_ADMIN.includes(a));
  if (invalidas.length) {
    return res.status(422).json({ error: { message: `Área desconhecida: ${invalidas.join(', ')}.` } });
  }
  const user = await adminService.setUserAreas({ id: req.params.id, areas, actingUserId: req.user.id });
  await auditService.recordSafe({
    actor: auditService.actorFrom(req),
    action: 'AREAS_DE_ADMIN_ALTERADAS',
    entityType: 'User',
    entityId: user.id,
    entityRef: user.name,
    detail: { areas: user.adminAreas },
  });
  res.json(user);
});

router.get('/activities', requirePermission(OPERACOES), async (req, res) => res.json(await adminService.systemActivities()));

// Livro de taxas da plataforma (KIXIMA).
router.get('/platform-fees', requirePermission(FINANCEIRO), async (req, res) => res.json(await adminService.listPlatformFees()));
router.patch('/platform-fees/:id/charge', requirePermission(FINANCEIRO), async (req, res) => {
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
router.get('/prontidao', requirePermission(OPERACOES), async (req, res) => res.json(await prontidaoService.verificar()));

// Fazer uma cópia de segurança AGORA.
//
// Existe porque uma cópia agendada que nunca foi vista a correr é uma suposição.
// Este botão confirma, de uma vez, que o pg_dump está na imagem, que a
// DIRECT_URL serve, que as credenciais S3 são aceites e que o bucket privado
// recebe o ficheiro — antes de se confiar no agendamento das 03:00.
router.post('/backup', requirePermission(OPERACOES), async (req, res) => {
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

// Confirmar que a ÚLTIMA cópia ainda se lê.
//
// Fazer a cópia prova que ela se escreve. Não prova que se lê — e um objeto
// truncado, um gzip corrompido ou um bucket esvaziado por uma política de
// retenção só se descobrem no dia em que a cópia é precisa.
router.post('/backup/verificar', requirePermission(OPERACOES), async (req, res) => {
  try {
    const r = await backupVerificacao.verificar();
    await auditService.recordSafe({
      actor: auditService.actorFrom(req),
      action: 'COPIA_SEGURANCA_VERIFICADA',
      entityType: 'Backup',
      detail: { tabelas: r.tabelasNoDump, megabytes: r.megabytes },
    });
    res.json(r);
  } catch (err) {
    res.status(err.status || 400).json({ error: { message: err.message } });
  }
});

// Enviar um email de teste para o próprio Admin do Sistema.
//
// Existe porque o envio de email falha em SILÊNCIO por desenho: um convite não
// deve deixar de ser criado porque o servidor de email não respondeu. Mas isso
// significa que uma chave errada ou um remetente por verificar não dá sinal
// nenhum a quem está a configurar — os emails apenas nunca chegam. Aqui o erro
// vem por inteiro, que é o que diz o que corrigir.
router.post('/email-teste', requirePermission(OPERACOES), async (req, res) => {
  try {
    const r = await notificationService.enviarEmailDeTeste(req.user.email);
    await auditService.recordSafe({
      actor: auditService.actorFrom(req),
      action: 'EMAIL_TESTE_ENVIADO',
      entityType: 'Email',
      entityRef: r.para,
      detail: { provider: r.provider },
    });
    res.json(r);
  } catch (err) {
    res.status(err.status || 502).json({ error: { message: err.message } });
  }
});

// --- Contas com poder que ainda não têm 2FA ---------------------------------
// A Prontidão dava um número, e um número não se persegue. Aqui ficam os nomes,
// com o último login — que muda o que se faz a seguir: quem entra todas as
// semanas precisa de um empurrão; quem não entra há meses pode ser uma conta que
// já ninguém usa, e essa desativa-se em vez de se andar atrás dela.
router.get('/mfa-pendentes', requirePermission(OPERACOES), async (req, res) => res.json(await mfaLembreteService.pendentes()));

// Pedir a essas pessoas que a ativem. Não se pode ativar por elas — se um
// administrador o fizesse, ficaria com os dois fatores e deixava de haver dois.
router.post('/mfa-lembrete', requirePermission(OPERACOES), async (req, res) => {
  const r = await mfaLembreteService.enviarLembretes({
    userIds: Array.isArray(req.body?.userIds) ? req.body.userIds : null,
    actor: auditService.actorFrom(req),
  });
  res.json(r);
});

module.exports = router;
