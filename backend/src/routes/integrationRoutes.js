// src/routes/integrationRoutes.js
// Endpoint de retorno (callback) do microserviço de integração ERP.
// O microserviço (kixima-integration-service) chama este endpoint com o
// resultado da sincronização, assinado por HMAC-SHA256 no cabeçalho
// `X-Kixima-Signature`. Endpoint público, protegido pela assinatura.
const express = require('express');
const crypto = require('crypto');
const logger = require('../config/logger');
const prisma = require('../config/database');
const poService = require('../services/poService');

const router = express.Router();
const SECRET = process.env.KIXIMA_CALLBACK_SECRET || '';

// Regista uma falha de sincronização quando se conhece a PO — mesmo quando o
// erro é "PO não encontrada", o registo em si não depende de ela existir
// (só o FK depende, e por isso falha silenciosamente nesse caso: não há onde
// pendurar o log de uma PO que não existe).
async function registarFalha(poId, eventType, mensagem) {
  if (!poId) return;
  await prisma.erpSyncLog.create({
    data: { purchaseOrderId: poId, direction: 'INBOUND', eventType: eventType || 'desconhecido', status: 'FAILED', errorMessage: mensagem },
  }).catch(() => {});
}

router.post('/callback', async (req, res) => {
  // Falha fechada: sem segredo configurado, o endpoint não aceita nada.
  if (!SECRET) {
    logger.warn('Integração ERP: callback recebido mas KIXIMA_CALLBACK_SECRET não está definido — recusado.');
    return res.status(503).json({ error: { code: 'CALLBACK_NOT_CONFIGURED', message: 'Callback de integração não configurado.' } });
  }

  const signature = req.get('X-Kixima-Signature') || '';
  const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  const expected = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Assinatura inválida.' } });
  }

  // Não registar o payload completo (pode conter dados de negócio). Só o tipo.
  const { type, data } = req.body || {};
  logger.info('Integração ERP: callback recebido', { type });

  try {
    switch (type) {
      case 'purchase_order.approval_decided': {
        const { poId, aprovado, erpExternalId, motivo } = data || {};
        if (!poId || typeof aprovado !== 'boolean') {
          throw new Error('Payload inválido: "poId" e "aprovado" (boolean) são obrigatórios.');
        }
        await poService.aplicarDecisaoErp(poId, { aprovado, erpExternalId, motivo });
        break;
      }
      case 'payment.confirmed': {
        const { poId, erpExternalId, valorPago, pagoEm } = data || {};
        if (!poId) throw new Error('Payload inválido: "poId" é obrigatório.');
        await poService.aplicarPagamentoErp(poId, { erpExternalId, valorPago, pagoEm });
        break;
      }
      default:
        logger.warn('Integração ERP: tipo de callback desconhecido', { type });
    }
    return res.json({ received: true });
  } catch (err) {
    // O erro é de NEGÓCIO (PO errada, estado que já não aceita a decisão,
    // payload malformado) — nunca de transporte. Responder 4xx/5xx só faria
    // o microserviço repetir um pedido que nunca vai ter sucesso; regista-se
    // a falha e confirma-se a receção, mesmo assim.
    logger.warn('Integração ERP: callback com erro de negócio', { type, error: err.message });
    await registarFalha(data?.poId, type, err.message);
    return res.json({ received: true, error: err.message });
  }
});

module.exports = router;
