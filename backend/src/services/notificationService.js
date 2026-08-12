// src/services/notificationService.js
// Implementa a tabela "Regras de notificação" (secção 6 da especificação).
// Cada evento de negócio chama uma função aqui — mantém a lógica de "quem é
// avisado, por que canal" num único sítio.

const prisma = require('../config/database');
const logger = require('../config/logger');

// Providers de email/in-app são plugáveis. No MVP, o EMAIL_PROVIDER=console
// apenas regista no log — trocar por um provider real (SMTP/SES/SendGrid)
// sem tocar no resto do código.
const config = require('../config/env');

// Separa o EMAIL_FROM ("Nome <email>" ou "email") em nome + email.
function parseFrom(from) {
  const m = String(from || '').match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1] || undefined, email: m[2] };
  return { email: String(from || '').trim() || undefined };
}

// Envio pela API HTTP do Brevo (porta 443 — não é afetada pelo bloqueio de
// portas SMTP de saída do Render). Precisa de BREVO_API_KEY (xkeysib-...).
async function sendViaBrevoApi(to, subject, body, html) {
  const sender = parseFrom(config.email.from);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.email.brevoApiKey || '',
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      textContent: body,
      ...(html ? { htmlContent: html } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${detail.slice(0, 200)}`);
  }
}

async function dispatchEmail(to, subject, body, { html } = {}) {
  const provider = config.email.provider;
  if (provider === 'console' || !to) {
    logger.info('Email (modo console)', { to, subject, body });
    return;
  }

  // Provider 'brevo' — API HTTP (recomendado no Render).
  if (provider === 'brevo' || provider === 'brevo-api') {
    try {
      await sendViaBrevoApi(to, subject, body, html);
      logger.info('Email enviado (Brevo API)', { to, subject });
    } catch (err) {
      logger.error('Falha no envio de email (Brevo API)', { to, subject, error: err.message });
    }
    return;
  }

  // Provider 'smtp' — nodemailer (carregado de forma preguiçosa).
  if (provider === 'smtp') {
    try {
      // eslint-disable-next-line global-require
      const nodemailer = require('nodemailer');
      const { host, port, user, password } = config.email.smtp;
      const transport = nodemailer.createTransport({
        host, port,
        secure: port === 465,        // 465 = TLS direto; 587/2525 = STARTTLS
        requireTLS: port !== 465,
        auth: user ? { user, pass: password } : undefined,
        // Falha rápido se o SMTP estiver indisponível — não bloqueia o pedido
        // (o erro é apanhado abaixo e o convite é criado na mesma).
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
      await transport.sendMail({ from: config.email.from, to, subject, text: body, html });
      logger.info('Email enviado (SMTP)', { to, subject });
    } catch (err) {
      logger.error('Falha no envio de email (SMTP)', { to, subject, error: err.message });
    }
    return;
  }

  logger.warn('Email não enviado — EMAIL_PROVIDER desconhecido', { provider, to, subject });
}

// Envio genérico de email, reutilizável por outras áreas (ex.: convites).
async function sendEmail(to, subject, body, opts) {
  return dispatchEmail(to, subject, body, opts);
}

async function notifyUser({ userId, type, title, message, channel = 'IN_APP', relatedEntityType, relatedEntityId, emailTo }) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      channel,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
    },
  });

  if (channel === 'IN_APP_EMAIL' && emailTo) {
    await dispatchEmail(emailTo, title, message);
  }

  return notification;
}

async function notifyUsersByRole({ companyId, roles, type, title, message, channel = 'IN_APP', relatedEntityType, relatedEntityId }) {
  const users = await prisma.user.findMany({
    where: { companyId, role: { in: roles }, active: true },
  });

  return Promise.all(
    users.map((u) =>
      notifyUser({
        userId: u.id,
        type,
        title,
        message,
        channel,
        relatedEntityType,
        relatedEntityId,
        emailTo: u.email,
      })
    )
  );
}

async function notifyCompanyContact({ companyId, type, title, message }) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return null;

  const notification = await prisma.notification.create({
    data: { companyId, type, channel: 'EMAIL', title, message },
  });
  await dispatchEmail(company.contactEmail, title, message);
  return notification;
}

// --- Eventos de negócio (mapeados 1:1 com a secção 6 da especificação) -----

const events = {
  poAguardaAprovacao: (po) =>
    notifyUsersByRole({
      companyId: po.buyerCompanyId,
      roles: ['COMPANY_ADMIN'],
      type: 'PO_AGUARDA_APROVACAO',
      title: 'Nova PO aguarda aprovação',
      message: `A ordem de compra ${po.reference} aguarda a sua aprovação.`,
      channel: 'IN_APP',
      relatedEntityType: 'PurchaseOrder',
      relatedEntityId: po.id,
    }),

  poAprovadaOuRejeitada: (po) =>
    notifyUser({
      userId: po.createdById,
      type: po.status === 'APROVADA' ? 'PO_APROVADA' : 'PO_REJEITADA',
      title: po.status === 'APROVADA' ? 'PO aprovada' : 'PO rejeitada',
      message: `A ordem de compra ${po.reference} foi ${po.status === 'APROVADA' ? 'aprovada' : 'rejeitada'}.`,
      channel: 'IN_APP',
      relatedEntityType: 'PurchaseOrder',
      relatedEntityId: po.id,
    }),

  poRecebidaPeloFornecedor: (po) =>
    notifyUsersByRole({
      companyId: po.supplierCompanyId,
      roles: ['FORNECEDOR', 'COMPANY_ADMIN'],
      type: 'PO_RECEBIDA_FORNECEDOR',
      title: 'Nova ordem de compra recebida',
      message: `Recebeu a ordem de compra ${po.reference}. Reveja e aceite ou recuse.`,
      channel: 'IN_APP_EMAIL',
      relatedEntityType: 'PurchaseOrder',
      relatedEntityId: po.id,
    }),

  faturaGerada: (invoice, po) =>
    notifyUsersByRole({
      companyId: po.buyerCompanyId,
      roles: ['FINANCEIRO'],
      type: 'FATURA_GERADA',
      title: 'Fatura pendente de pagamento',
      message: `A fatura ${invoice.reference} (PO ${po.reference}) foi gerada. Prazo de pagamento: ${po.paymentDueAt?.toISOString().slice(0, 10)}.`,
      channel: 'IN_APP_EMAIL',
      relatedEntityType: 'Invoice',
      relatedEntityId: invoice.id,
    }),

  pagamentoProcessado: (payment, po) =>
    notifyUsersByRole({
      companyId: po.supplierCompanyId,
      roles: ['FORNECEDOR', 'COMPANY_ADMIN'],
      type: 'PAGAMENTO_PROCESSADO',
      title: 'Pagamento recebido',
      message: `O pagamento da PO ${po.reference} foi processado. Pode iniciar a execução/entrega.`,
      channel: 'IN_APP_EMAIL',
      relatedEntityType: 'Payment',
      relatedEntityId: payment.id,
    }),

  entregaDespachada: (po) =>
    notifyUsersByRole({
      companyId: po.buyerCompanyId,
      roles: ['COMPRADOR'],
      type: 'ENTREGA_DESPACHADA',
      title: 'Entrega despachada',
      message: `A entrega da PO ${po.reference} foi despachada.`,
      channel: 'IN_APP',
      relatedEntityType: 'PurchaseOrder',
      relatedEntityId: po.id,
    }),

  rececaoComDivergencia: (po) =>
    notifyUsersByRole({
      companyId: null,
      roles: ['ADMIN_SISTEMA'],
      type: 'RECECAO_COM_DIVERGENCIA',
      title: 'Receção com divergência reportada',
      message: `A PO ${po.reference} foi recebida com divergência ("${po.receptionStatus}"). Caso a acompanhar fora da plataforma (sinistro).`,
      channel: 'IN_APP_EMAIL',
      relatedEntityType: 'PurchaseOrder',
      relatedEntityId: po.id,
    }),

  divergenciaResolvida: (po) =>
    Promise.all([
      // O fornecedor precisa de saber o desfecho — sobretudo se há reposição.
      notifyUsersByRole({
        companyId: po.supplierCompanyId,
        roles: ['FORNECEDOR', 'COMPANY_ADMIN'],
        type: 'DIVERGENCIA_RESOLVIDA',
        title: po.divergenceResolution === 'REPOSICAO' ? 'Reposição solicitada' : 'Divergência resolvida',
        message: po.divergenceResolution === 'REPOSICAO'
          ? `A divergência da PO ${po.reference} foi resolvida com pedido de REPOSIÇÃO: corrija/reentregue a mercadoria e volte a marcar como entregue.${po.divergenceResolutionNotes ? ` Notas: ${po.divergenceResolutionNotes}` : ''}`
          : `A divergência da PO ${po.reference} foi resolvida: o comprador aceitou a entrega e a ordem foi concluída.`,
        channel: 'IN_APP_EMAIL',
        relatedEntityType: 'PurchaseOrder',
        relatedEntityId: po.id,
      }),
      notifyUsersByRole({
        companyId: null,
        roles: ['ADMIN_SISTEMA'],
        type: 'DIVERGENCIA_RESOLVIDA',
        title: 'Divergência resolvida',
        message: `A divergência da PO ${po.reference} foi resolvida (${po.divergenceResolution === 'REPOSICAO' ? 'reposição' : 'aceite'}).`,
        channel: 'IN_APP',
        relatedEntityType: 'PurchaseOrder',
        relatedEntityId: po.id,
      }),
    ]),

  supplierDevRecebida: (r) =>
    notifyUsersByRole({
      companyId: null,
      roles: ['ADMIN_SISTEMA'],
      type: 'SUPPLIER_DEV_RECEBIDA',
      title: 'Nova candidatura ao Supplier Development',
      message: `${r.companyName} candidatou-se ao programa (${r.reference}). Percurso: ${r.track}. Contacto: ${r.contactName} — ${r.contactEmail}.`,
      channel: 'IN_APP_EMAIL',
      relatedEntityType: 'SupplierDevRequest',
      relatedEntityId: r.id,
    }),

  apoliceSubmetidaOuAprovada: (companyId, policyLabel) =>
    notifyUsersByRole({
      companyId,
      roles: ['COMPANY_ADMIN', 'FINANCEIRO'],
      type: 'APOLICE_SUBMETIDA_APROVADA',
      title: 'Apólice atualizada',
      message: `A apólice ${policyLabel} foi submetida/aprovada.`,
      channel: 'IN_APP_EMAIL',
    }),

  apoliceAExpirar: (companyId, policyLabel, validUntil) =>
    notifyUsersByRole({
      companyId,
      roles: ['COMPANY_ADMIN', 'FINANCEIRO'],
      type: 'APOLICE_A_EXPIRAR',
      title: 'Apólice a expirar em breve',
      message: `A apólice ${policyLabel} expira em ${validUntil.toISOString().slice(0, 10)}. Providencie a renovação.`,
      channel: 'IN_APP_EMAIL',
    }),

  cadastroEmpresaDecidido: (company) =>
    notifyCompanyContact({
      companyId: company.id,
      type: company.status === 'APROVADA' ? 'CADASTRO_EMPRESA_APROVADO' : 'CADASTRO_EMPRESA_REJEITADO',
      title: company.status === 'APROVADA' ? 'Cadastro aprovado' : 'Cadastro rejeitado',
      message:
        company.status === 'APROVADA'
          ? `O cadastro da empresa ${company.name} foi aprovado. Já pode transacionar na KIXIMA.`
          : `O cadastro da empresa ${company.name} foi rejeitado.`,
    }),
};

module.exports = { notifyUser, notifyUsersByRole, notifyCompanyContact, sendEmail, events };
