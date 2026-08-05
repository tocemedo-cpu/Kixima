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
  const signature = req.get('X-Kixima-Signature') || '';
  const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});

  if (SECRET) {
    const expected = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) {
      return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Assinatura inválida.' } });
    }
  }

  const { type, data } = req.body || {};
  logger.info('Integração ERP: callback recebido', { type, data });
  return res.json({ received: true });
});

module.exports = router;
