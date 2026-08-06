// src/services/eventBus.js
// Publicação de eventos de negócio no RabbitMQ (exchange kixima.events), para o
// microserviço de integração ERP (kixima-integration-service) consumir.
//
// É totalmente OPCIONAL e não-bloqueante: se RABBITMQ_URL não estiver definido,
// ou o broker estiver indisponível, publish() é um no-op silencioso e o fluxo
// normal do Kixima continua exatamente igual. Nunca lança para não afetar as
// transações de negócio.
const { randomUUID } = require('crypto');
const logger = require('../config/logger');

let amqp = null;
try {
  // eslint-disable-next-line global-require
  amqp = require('amqplib');
} catch {
  amqp = null; // dependência ausente → publicação desativada
}

const URL = process.env.RABBITMQ_URL || '';
const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'kixima.events';

let channelPromise = null;

async function getChannel() {
  if (!amqp || !URL) return null;
  if (!channelPromise) {
    channelPromise = (async () => {
      const conn = await amqp.connect(URL);
      conn.on('error', () => { channelPromise = null; });
      conn.on('close', () => { channelPromise = null; });
      const ch = await conn.createConfirmChannel();
      await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
      logger.info('eventBus: ligado ao RabbitMQ', { exchange: EXCHANGE });
      return ch;
    })().catch((err) => {
      logger.warn('eventBus: falha a ligar ao RabbitMQ — publicação desativada', { error: err.message });
      channelPromise = null;
      return null;
    });
  }
  return channelPromise;
}

/**
 * Publica um evento no exchange kixima.events.
 * @param {string} routingKey ex.: 'purchase_order.approved'
 * @param {object} payload corpo de negócio do evento
 * @param {object} [opts] { eventId } — id estável para idempotência
 * @returns {Promise<boolean>} true se publicado; false se no-op/erro
 */
async function publish(routingKey, payload, opts = {}) {
  try {
    const ch = await getChannel();
    if (!ch) {
      if (!amqp) logger.warn('eventBus: dependência amqplib ausente — evento NÃO publicado', { routingKey });
      else if (!URL) logger.warn('eventBus: RABBITMQ_URL não definido — evento NÃO publicado', { routingKey });
      else logger.warn('eventBus: sem canal (broker indisponível) — evento NÃO publicado', { routingKey });
      return false;
    }
    const eventId = opts.eventId || randomUUID();
    const envelope = {
      eventId,
      tenantId: opts.tenantId ?? null, // operadora/cliente dono da transação
      source: 'kixima',
      occurredAt: new Date().toISOString(),
      payload,
    };
    ch.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(envelope)), {
      messageId: eventId,
      persistent: true,
      contentType: 'application/json',
    });
    logger.info('eventBus: evento publicado', { routingKey, eventId });
    return true;
  } catch (err) {
    logger.warn('eventBus: falha ao publicar evento (ignorado)', { routingKey, error: err.message });
    return false;
  }
}

/**
 * Testa a ligação ao RabbitMQ no arranque e regista o estado nos logs, para se
 * ver imediatamente (sem executar nenhuma ação) se a integração está ligada.
 */
async function init() {
  if (!amqp) {
    logger.warn('eventBus: dependência amqplib ausente — integração ERP DESATIVADA');
    return;
  }
  if (!URL) {
    logger.warn('eventBus: RABBITMQ_URL não definido — integração ERP DESATIVADA (o Kixima funciona normalmente)');
    return;
  }
  try {
    const ch = await getChannel();
    if (ch) logger.info('eventBus: integração ERP ATIVA — ligado ao RabbitMQ', { exchange: EXCHANGE });
    else logger.warn('eventBus: não foi possível ligar ao RabbitMQ no arranque (tentará novamente ao publicar)');
  } catch (err) {
    logger.warn('eventBus: erro ao ligar ao RabbitMQ no arranque', { error: err.message });
  }
}

const num = (d) => Number(d ?? 0);

// --- Construtores de payload (formato canónico consumido pela integração) ----

function purchaseOrderApproved(po, approvedAt) {
  return {
    poId: po.id,
    reference: po.reference,
    buyer: { taxId: po.buyerCompany?.taxId || '', name: po.buyerCompany?.name || '' },
    supplier: { taxId: po.supplierCompany?.taxId || '', name: po.supplierCompany?.name || '' },
    currency: po.currency,
    totalAmount: num(po.totalAmount),
    lines: (po.items || []).map((it) => ({
      sku: it.product?.sku || it.product?.manufacturerCode || '',
      description: it.product?.name || 'Item',
      quantity: it.quantity,
      unitPrice: num(it.unitPrice),
      lineTotal: num(it.lineTotal),
    })),
    approvedAt: (approvedAt || new Date()).toISOString(),
  };
}

function invoiceIssued(invoice, po) {
  return {
    invoiceId: invoice.id,
    reference: invoice.reference,
    poReference: po?.reference || null,
    supplier: { taxId: po?.supplierCompany?.taxId || '', name: po?.supplierCompany?.name || '' },
    currency: invoice.currency,
    amount: num(invoice.amount),
    issuedAt: (invoice.issuedAt || invoice.createdAt || new Date()).toISOString(),
    dueAt: (invoice.dueAt || new Date()).toISOString(),
  };
}

function goodsReceived(po, receivedAt) {
  return {
    goodsReceiptId: `gr:${po.id}`,
    poReference: po.reference,
    receivedAt: (receivedAt || new Date()).toISOString(),
    lines: (po.items || []).map((it) => ({
      sku: it.product?.sku || '',
      description: it.product?.name || 'Item',
      quantityReceived: it.quantity,
    })),
  };
}

function paymentCompleted(payment, invoice) {
  return {
    paymentId: payment.id,
    invoiceReference: invoice?.reference || '',
    amount: num(payment.amount),
    currency: payment.currency,
    paidAt: (payment.processedAt || payment.createdAt || new Date()).toISOString(),
    method: 'KIXIMA',
  };
}

module.exports = {
  publish,
  init,
  EXCHANGE,
  payloads: { purchaseOrderApproved, invoiceIssued, goodsReceived, paymentCompleted },
};
