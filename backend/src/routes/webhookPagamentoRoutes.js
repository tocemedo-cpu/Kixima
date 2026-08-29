// src/routes/webhookPagamentoRoutes.js
// Callback dos canais de pagamento automático de subscrição (EMIS, PayPay,
// bancos). Fica FORA de `authenticate` de propósito: quem chama é o gateway,
// não um utilizador com sessão KIXIMA. A segurança não vem de um segredo
// partilhado aqui — vem do que cada adaptador já faz em confirmarCallback():
// nunca aceita o "pago" do próprio corpo do pedido, volta sempre a perguntar
// ao gateway pela transação, e é essa resposta (não esta) que decide.
const express = require('express');
const canaisPagamentoService = require('../services/canaisPagamentoService');
const assinaturaService = require('../services/assinaturaService');
const prisma = require('../config/database');

const router = express.Router();

router.post('/:canal', async (req, res) => {
  const canal = String(req.params.canal || '').toUpperCase();
  const adaptador = canaisPagamentoService.adaptador(canal);
  if (!adaptador) {
    return res.status(404).json({ error: { code: 'CANAL_DESCONHECIDO', message: `Canal desconhecido: ${canal}.` } });
  }

  const verificado = await adaptador.confirmarCallback(req.body);
  // Não pago (ex.: falhou, foi cancelado do lado do cliente) — 200 para o
  // gateway não reenviar em loop; não há cobrança nenhuma para atualizar.
  if (!verificado.pago) return res.json({ recebido: true });

  const cobranca = await prisma.planoCobranca.findFirst({
    where: { canal, referenciaExterna: verificado.idTransacao },
  });
  if (!cobranca) {
    return res.status(404).json({
      error: { code: 'COBRANCA_NAO_ENCONTRADA', message: `Nenhuma cobrança de subscrição corresponde à transação ${verificado.idTransacao}.` },
    });
  }

  await assinaturaService.confirmarViaGateway(cobranca.id, { canal, referenciaExterna: verificado.idTransacao });
  res.json({ recebido: true });
});

module.exports = router;
