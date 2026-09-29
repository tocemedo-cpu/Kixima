// src/routes/assinaturaRoutes.js
// Subscrição: a empresa pede e paga; a KIXIMA confirma.
//
// As rotas da EMPRESA e as da KIXIMA vivem no mesmo ficheiro porque são os dois
// lados da mesma cobrança, mas os guards são diferentes e estão explícitos em
// cada uma — nunca um `router.use` que apanhasse as duas metades.
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../middleware/rbac');
const { FINANCEIRO } = require('../utils/adminAreas');
const { uploadDocuments } = require('../config/upload');
const auditService = require('../services/auditService');
const svc = require('../services/assinaturaService');
const canaisPagamentoService = require('../services/canaisPagamentoService');

const router = express.Router();
router.use(authenticate);

// --- Lado KIXIMA ------------------------------------------------------------
// Antes das rotas da empresa: `/fila` seria apanhado por um `/:id` a seguir.
router.get('/fila', requireRole('ADMIN_SISTEMA'), requirePermission(FINANCEIRO), async (req, res) => {
  res.json(await svc.fila());
});

router.post('/:id/confirmar', requireRole('ADMIN_SISTEMA'), requirePermission(FINANCEIRO), async (req, res) => {
  res.json(await svc.confirmar(req.params.id, req.user.id, { notas: req.body?.notas }, auditService.actorFrom(req)));
});

// --- Lado da empresa --------------------------------------------------------
// Só o Company Admin — ver, pedir, pagar e carregar o comprovativo são todos
// dele. O Financeiro deixou de ter qualquer acesso a esta rota (antes via
// o estado e carregava o comprovativo, por ser quem faz as transferências;
// deixou de o poder fazer).
router.get('/', requireRole('COMPANY_ADMIN'), async (req, res) => {
  res.json(await svc.estado(req.user.companyId));
});

router.post('/pedir', requireRole('COMPANY_ADMIN'), async (req, res) => {
  const cobranca = await svc.pedir(
    req.user.companyId,
    req.body?.plano,
    req.user.id,
    { aceitaPerdas: req.body?.aceitaPerdas === true },
    auditService.actorFrom(req),
  );
  res.status(201).json(cobranca);
});

// Quais canais automáticos (EMIS/PayPay/bancos) estão configurados — a
// página só mostra o que responde `disponivel: true` aqui, nunca um botão
// que vai falhar ao clicar.
router.get('/canais', requireRole('COMPANY_ADMIN'), async (req, res) => {
  res.json(canaisPagamentoService.estados());
});

router.post('/:id/pagar-com', requireRole('COMPANY_ADMIN'), async (req, res) => {
  const cobranca = await svc.iniciarPagamentoGateway(
    req.user.companyId,
    req.params.id,
    { canal: req.body?.canal, telemovel: req.body?.telemovel },
    auditService.actorFrom(req),
  );
  res.json(cobranca);
});

// Comprovativo OBRIGATÓRIO (multipart, campo "comprovativo": PDF ou imagem).
router.post(
  '/:id/comprovativo',
  requireRole('COMPANY_ADMIN'),
  uploadDocuments.single('comprovativo'),
  async (req, res) => {
    res.json(await svc.submeterComprovativo(
      req.user.companyId, req.params.id, req.file, auditService.actorFrom(req),
    ));
  },
);

// Cancelar. O Admin do Sistema cancela qualquer uma (não passa companyId); a
// empresa só as suas.
router.post('/:id/cancelar', requireRole('COMPANY_ADMIN', 'ADMIN_SISTEMA'), requirePermission(FINANCEIRO), async (req, res) => {
  const escopo = req.user.role === 'ADMIN_SISTEMA' ? {} : { companyId: req.user.companyId };
  res.json(await svc.cancelar(
    req.params.id, { motivo: req.body?.motivo, ...escopo }, auditService.actorFrom(req),
  ));
});

module.exports = router;
