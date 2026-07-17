const companyService = require('../services/companyService');
const authService = require('../services/authService');

async function register(req, res) {
  const company = await companyService.registerCompany(req.body);
  res.status(201).json(company);
}

async function list(req, res) {
  const companies = await companyService.listCompanies(req.query);
  res.json(companies);
}

async function getOne(req, res) {
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

async function createUser(req, res) {
  // Company Admin só cria utilizadores da própria empresa; Admin do Sistema cria qualquer um.
  const companyId = req.user.role === 'ADMIN_SISTEMA' ? req.body.companyId : req.user.companyId;
  const user = await authService.createUser({ ...req.body, companyId });
  const { passwordHash, ...safeUser } = user;
  res.status(201).json(safeUser);
}

module.exports = { register, list, getOne, decide, setBudgetLimit, createUser };
