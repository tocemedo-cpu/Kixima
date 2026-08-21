// src/services/erpConfigService.js
// Configuração ERP POR EMPRESA, gerida pelo ADMINISTRADOR DO SISTEMA KIXIMA.
// Guarda a seleção e as credenciais (cifradas AES-256-GCM) em CompanyErpConfig,
// mantém trilho de auditoria (CompanyErpConfigAudit) e sincroniza com o
// microserviço kixima-integration-service (fonte de verdade em runtime).
const prisma = require('../config/database');
const planService = require('./planService');
const logger = require('../config/logger');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');
const erpCrypto = require('./erpCrypto');

// ERPs suportados e os campos do formulário dinâmico (o front usa isto).
const ERP_FIELDS = {
  MANUAL: [],
  PRIMAVERA: [
    { key: 'baseUrl', label: 'URL base (REST)', secret: false, required: true },
    { key: 'apiKey', label: 'API Key', secret: true, required: true },
    { key: 'company', label: 'Empresa (código)', secret: false, required: true },
  ],
  SAP_S4HANA: [
    { key: 'baseUrl', label: 'URL base (OData)', secret: false, required: true },
    { key: 'username', label: 'Utilizador', secret: false, required: true },
    { key: 'password', label: 'Palavra-passe', secret: true, required: true },
    { key: 'client', label: 'Client (mandante)', secret: false, required: false },
  ],
  ORACLE_ERP_CLOUD: [
    { key: 'baseUrl', label: 'URL base (Financials REST)', secret: false, required: true },
    { key: 'username', label: 'Utilizador', secret: false, required: true },
    { key: 'password', label: 'Palavra-passe', secret: true, required: true },
  ],
  SAP_ARIBA: [
    { key: 'baseUrl', label: 'URL base (cXML)', secret: false, required: true },
    { key: 'sharedSecret', label: 'Shared Secret', secret: true, required: true },
    { key: 'networkId', label: 'Network ID (ANID)', secret: false, required: true },
  ],
};

const ERP_SYSTEMS = Object.keys(ERP_FIELDS);
const isRealErp = (erp) => erp && erp !== 'MANUAL';

// --- Cliente HTTP para o microserviço de integração (opcional) --------------
async function callIntegration(method, path, body) {
  const base = process.env.INTEGRATION_URL || '';
  const token = process.env.INTEGRATION_ADMIN_TOKEN || '';
  if (!base || !token) return { skipped: true, ok: false, message: 'Microserviço de integração não configurado (INTEGRATION_URL/TOKEN).' };
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { skipped: false, ok: res.ok, status: res.status, data };
  } catch (err) {
    return { skipped: false, ok: false, message: err.message };
  }
}

function maskConfig(erp, config) {
  const fields = ERP_FIELDS[erp] || [];
  const out = {};
  for (const f of fields) {
    const v = config?.[f.key];
    out[f.key] = f.secret ? (v ? '••••••' : '') : (v || '');
  }
  return out;
}

async function audit(companyId, action, { fromErp, toErp, actor, result }) {
  try {
    await prisma.companyErpConfigAudit.create({
      data: {
        companyId,
        action,
        fromErp: fromErp || null,
        toErp: toErp || null,
        actorUserId: actor?.id || null,
        actorName: actor?.name || null,
        result: result || null,
      },
    });
  } catch (err) {
    logger.warn('erpConfig: falha ao gravar auditoria', { error: err.message });
  }
}

// --- Operações --------------------------------------------------------------

async function getConfig(companyId) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, status: true } });
  if (!company) throw new NotFoundError('Empresa');

  const cfg = await prisma.companyErpConfig.findUnique({ where: { companyId } });
  const erp = cfg?.erp || 'MANUAL';
  let config = {};
  if (cfg?.configEnc) {
    try { config = erpCrypto.decryptJson(cfg.configEnc); } catch { config = {}; }
  }

  return {
    company: { id: company.id, name: company.name, status: company.status },
    erp,
    systems: ERP_SYSTEMS,
    fields: ERP_FIELDS,
    config: maskConfig(erp, config),
    lastTest: cfg ? { at: cfg.lastTestAt, ok: cfg.lastTestOk, message: cfg.lastTestMessage } : null,
    updatedAt: cfg?.updatedAt || null,
  };
}

async function setConfig(companyId, { erp, config = {} }, actor) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa');
  // A integração com ERPs externos (SAP, AS400, Ariba, Maximo, Oracle…) é uma
  // funcionalidade do plano PRO.
  planService.assertFeature(company, 'erpIntegration', 'Integração com ERP');
  if (!ERP_SYSTEMS.includes(erp)) throw new BusinessRuleError(`ERP inválido: ${erp}`);
  if (company.status !== 'APROVADA') {
    throw new BusinessRuleError('Só é possível configurar o ERP de empresas aprovadas.');
  }

  const prev = await prisma.companyErpConfig.findUnique({ where: { companyId } });
  const fromErp = prev?.erp || 'MANUAL';

  let integration = { skipped: true };

  if (!isRealErp(erp)) {
    // Sem ERP (Manual): limpa credenciais e desativa no microserviço.
    await prisma.companyErpConfig.upsert({
      where: { companyId },
      create: { companyId, erp: 'MANUAL', configEnc: null },
      update: { erp: 'MANUAL', configEnc: null, lastTestAt: null, lastTestOk: null, lastTestMessage: null },
    });
    if (isRealErp(fromErp)) {
      integration = await callIntegration('DELETE', `/credentials/tenants/${companyId}/${fromErp}`);
    }
  } else {
    // Valida campos obrigatórios do ERP escolhido.
    const missing = (ERP_FIELDS[erp] || []).filter((f) => f.required && !String(config?.[f.key] || '').trim());
    if (missing.length) {
      throw new BusinessRuleError(`Preencha os campos obrigatórios: ${missing.map((f) => f.label).join(', ')}.`);
    }
    // Se o utilizador não reenviou um segredo (deixou mascarado/vazio), mantém o anterior.
    let merged = { ...config };
    if (prev?.configEnc) {
      let prevCfg = {};
      try { prevCfg = erpCrypto.decryptJson(prev.configEnc); } catch { prevCfg = {}; }
      for (const f of ERP_FIELDS[erp]) {
        if (f.secret && (!config[f.key] || config[f.key] === '••••••')) merged[f.key] = prevCfg[f.key] || '';
      }
    }
    const configEnc = erpCrypto.encryptJson(merged);
    await prisma.companyErpConfig.upsert({
      where: { companyId },
      create: { companyId, erp, configEnc },
      update: { erp, configEnc, lastTestAt: null, lastTestOk: null, lastTestMessage: null },
    });
    // Sincroniza com o microserviço (tenantId = companyId).
    integration = await callIntegration('PUT', `/credentials/tenants/${companyId}/${erp}`, {
      enabled: true,
      config: merged,
    });
    // Se trocou de ERP, remove o anterior no microserviço.
    if (isRealErp(fromErp) && fromErp !== erp) {
      await callIntegration('DELETE', `/credentials/tenants/${companyId}/${fromErp}`);
    }
  }

  await audit(companyId, 'SET', {
    fromErp,
    toErp: erp,
    actor,
    result: integration.skipped ? 'guardado (microserviço não configurado)' : integration.ok ? 'guardado e sincronizado' : `guardado; sync falhou (${integration.message || integration.status})`,
  });

  return { ...(await getConfig(companyId)), integrationSynced: !integration.skipped && integration.ok };
}

async function testConnection(companyId, actor) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { plan: true, planoValidoAte: true } });
  planService.assertFeature(company, 'erpIntegration', 'Integração com ERP');
  const cfg = await prisma.companyErpConfig.findUnique({ where: { companyId } });
  if (!cfg || !isRealErp(cfg.erp)) {
    throw new BusinessRuleError('Sem ERP configurado para testar (modo Manual).');
  }
  const res = await callIntegration('POST', `/credentials/tenants/${companyId}/${cfg.erp}/test`);
  const ok = Boolean(res.data?.ok);
  const message = res.skipped
    ? res.message
    : res.data?.message || (res.ok ? 'Sem resposta.' : `Erro ${res.status || ''}`.trim());

  await prisma.companyErpConfig.update({
    where: { companyId },
    data: { lastTestAt: new Date(), lastTestOk: ok, lastTestMessage: message },
  });
  await audit(companyId, 'TEST', { toErp: cfg.erp, actor, result: `${ok ? 'OK' : 'FALHOU'} — ${message}` });

  return { ok, message, at: new Date() };
}

async function listAudits(companyId) {
  return prisma.companyErpConfigAudit.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

module.exports = { getConfig, setConfig, testConnection, listAudits, ERP_FIELDS, ERP_SYSTEMS };
