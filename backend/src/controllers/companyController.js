const companyService = require('../services/companyService');
const authService = require('../services/authService');
const erpConfigService = require('../services/erpConfigService');
const { ForbiddenError } = require('../utils/errors');

const DOCUMENT_TYPES = ['CERTIDAO_COMERCIAL', 'ALVARA_COMERCIAL', 'LICENCA_ANPG'];

async function register(req, res) {
  // multer .fields() coloca os ficheiros em req.files[<tipo>][0].
  const files = req.files || {};
  const uploadedDocs = DOCUMENT_TYPES
    .filter((type) => files[type] && files[type][0])
    .map((type) => ({ type, file: files[type][0] }));
  const policyFile = files.APOLICE_SEGURO && files.APOLICE_SEGURO[0];

  const company = await companyService.registerCompany(req.body, uploadedDocs, policyFile);
  res.status(201).json(company);
}

async function list(req, res) {
  const companies = await companyService.listCompanies(req.query);
  res.json(companies);
}

async function getOne(req, res) {
  // Controlo de acesso multi-tenant: o Admin do Sistema vê qualquer empresa;
  // os restantes utilizadores só a própria (o perfil inclui documentos de
  // credenciamento, apólices e limites — dados sensíveis).
  if (req.user.role !== 'ADMIN_SISTEMA' && req.params.id !== req.user.companyId) {
    throw new ForbiddenError('Não pode aceder aos dados de outra empresa.');
  }
  const company = await companyService.getCompany(req.params.id);
  res.json(company);
}

async function decide(req, res) {
  const company = await companyService.decideCompanyStatus(req.params.id, req.body);
  res.json(company);
}

async function setBudgetLimit(req, res) {
  const limit = await companyService.setBudgetLimit(req.params.id, req.body);
  res.json(limit);
}

// Dados bancários — cada empresa só acede aos seus (o Admin do Sistema vê todos).
function assertOwnCompany(req) {
  if (req.user.role !== 'ADMIN_SISTEMA' && req.params.id !== req.user.companyId) {
    throw new ForbiddenError('Não pode aceder aos dados de outra empresa.');
  }
}

async function getBankDetails(req, res) {
  assertOwnCompany(req);
  res.json(await companyService.getBankDetails(req.params.id));
}

async function setBankDetails(req, res) {
  assertOwnCompany(req);
  res.json(await companyService.updateBankDetails(req.params.id, req.body));
}

async function createUser(req, res) {
  // Company Admin só cria utilizadores da própria empresa; Admin do Sistema cria qualquer um.
  const companyId = req.user.role === 'ADMIN_SISTEMA' ? req.body.companyId : req.user.companyId;
  const user = await authService.createUser({ ...req.body, companyId });
  const { passwordHash, ...safeUser } = user;
  res.status(201).json(safeUser);
}

// --- Convites de utilizadores ---------------------------------------------

async function listUsers(req, res) {
  const users = await companyService.listCompanyUsers(req.user.companyId);
  res.json(users);
}

// Endereço público real do serviço (com trust proxy, reflete o host/proto do
// Render). Usado para construir o link do convite no email.
function publicBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

async function createInvite(req, res) {
  const { role, name, email } = req.body;
  const invite = await companyService.createInvite(req.user.companyId, role, { name, email }, req.user.id, publicBaseUrl(req));
  res.status(201).json(invite);
}

async function listInvites(req, res) {
  res.json(await companyService.listInvites(req.user.companyId));
}

async function resendInvite(req, res) {
  res.json(await companyService.resendInvite(req.user.companyId, req.params.id, publicBaseUrl(req)));
}

async function cancelInvite(req, res) {
  res.json(await companyService.cancelInvite(req.user.companyId, req.params.id));
}

async function resolveInvite(req, res) {
  const info = await companyService.resolveInvite(req.params.token);
  res.json(info);
}

async function acceptInvite(req, res) {
  const user = await companyService.acceptInvite(req.params.token, req.body);
  res.status(201).json(user);
}

async function activateUser(req, res) {
  const user = await companyService.activateCompanyUser(req.user.companyId, req.params.id);
  res.json(user);
}

async function removeUser(req, res) {
  const result = await companyService.removeCompanyUser(req.user.companyId, req.params.id);
  res.json(result);
}

async function setUserStatus(req, res) {
  const user = await companyService.setCompanyUserStatus(req.user.companyId, req.params.id, req.body.active, req.user.id);
  res.json(user);
}

// --- Configuração ERP (Administrador do Sistema KIXIMA) ---------------------

async function getErpConfig(req, res) {
  res.json(await erpConfigService.getConfig(req.params.id));
}

async function setErpConfig(req, res) {
  const result = await erpConfigService.setConfig(req.params.id, req.body, req.user);
  res.json(result);
}

async function testErpConnection(req, res) {
  res.json(await erpConfigService.testConnection(req.params.id, req.user));
}

async function listErpAudits(req, res) {
  res.json(await erpConfigService.listAudits(req.params.id));
}

module.exports = {
  register,
  list,
  getOne,
  decide,
  getErpConfig,
  setErpConfig,
  testErpConnection,
  listErpAudits,
  setBudgetLimit,
  getBankDetails,
  setBankDetails,
  createUser,
  listUsers,
  createInvite,
  listInvites,
  resendInvite,
  cancelInvite,
  resolveInvite,
  acceptInvite,
  activateUser,
  removeUser,
  setUserStatus,
};
