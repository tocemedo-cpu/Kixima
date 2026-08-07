// src/routes/integrationRoutes.js
// Endpoint de retorno (callback) do microserviço de integração ERP.
// O microserviço (kixima-integration-service) chama este endpoint com o
// resultado da sincronização, assinado por HMAC-SHA256 no cabeçalho
// `X-Kixima-Signature`. Endpoint público, protegido pela assinatura.
const express = require('express');
const crypto = require('crypto');
const logger = require('../config/logger');

const router = express.Router();
const SECRET = process.env.KIXIMA_CALLBACK_SECRET || '';

router.post('/callback', (req, res) => {
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
  const { type } = req.body || {};
  logger.info('Integração ERP: callback recebido', { type });
  return res.json({ received: true });
});

module.exports = router;
