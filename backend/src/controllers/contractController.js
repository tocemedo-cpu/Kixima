const contractService = require('../services/contractService');

async function create(req, res) {
  const contract = await contractService.createContract(req.body);
  res.status(201).json(contract);
}

async function listMine(req, res) {
  // O Admin do Sistema não tem empresa própria — vê todos os contratos.
  const contracts =
    req.user.role === 'ADMIN_SISTEMA'
      ? await contractService.listAllContracts()
      : await contractService.listContractsForCompany(req.user.companyId);
  res.json(contracts);
}

async function getOne(req, res) {
  const contract = await contractService.getContract(req.params.id, req.user);
  res.json(contract);
}

async function consolidateBilling(req, res) {
  const invoice = await contractService.consolidateContractBilling(req.params.id);
  res.status(201).json(invoice);
}

module.exports = { create, listMine, getOne, consolidateBilling };
