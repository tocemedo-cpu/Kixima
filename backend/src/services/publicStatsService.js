// src/services/publicStatsService.js
// Estatísticas agregadas da plataforma para a home pública (corporativa) —
// só contagens, nunca dados de uma empresa em concreto. É a fonte dos
// números que a home mostra em vez de texto de marketing fixo.
const prisma = require('../config/database');
const config = require('../config/env');

async function resumo() {
  const [empresasVerificadas, fornecedoresQualificados, ordensProcessadas] = await Promise.all([
    prisma.company.count({ where: { status: 'APROVADA' } }),
    prisma.company.count({ where: { status: 'APROVADA', type: 'FORNECEDOR' } }),
    prisma.purchaseOrder.count({ where: { status: 'CONCLUIDA' } }),
  ]);

  return {
    empresasVerificadas,
    fornecedoresQualificados,
    ordensProcessadas,
    // O "7 dias" do texto de marketing é isto — o valor real configurado,
    // não uma string escrita à mão que podia ficar desactualizada.
    pagamentoSlaDias: config.business.paymentSlaDays,
  };
}

module.exports = { resumo };
