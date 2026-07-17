const policyService = require('../services/policyService');

async function submitSupplierPolicy(req, res) {
  const policy = await policyService.submitSupplierPolicy(req.user.companyId, req.body);
  res.status(201).json(policy);
}

async function decideSupplierPolicy(req, res) {
  const policy = await policyService.decideSupplierPolicy(req.params.id, req.body.approve);
  res.json(policy);
}

async function issueClientPolicy(req, res) {
  const policy = await policyService.issueClientPolicy(req.params.companyId, {
    ...req.body,
    issuedById: req.user.id,
  });
  res.status(201).json(policy);
}

async function listForCompany(req, res) {
  const companyId = req.params.companyId || req.user.companyId;
  const policies = await policyService.listPoliciesForCompany(companyId);
  res.json(policies);
}

module.exports = { submitSupplierPolicy, decideSupplierPolicy, issueClientPolicy, listForCompany };
