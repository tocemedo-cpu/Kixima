// src/utils/schemas.js
// Schemas de validação (Zod) para os corpos de pedido de cada endpoint.

const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerCompanySchema = z.object({
  name: z.string().min(2),
  taxId: z.string().min(3),
  type: z.enum(['CLIENTE', 'FORNECEDOR']),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  // Conta do primeiro utilizador (Company Admin) — permite o login após a
  // aprovação da empresa na due diligence.
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});

const decideCompanySchema = z.object({
  approve: z.boolean(),
  rejectionReason: z.string().optional(),
});

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['COMPRADOR', 'COMPANY_ADMIN', 'FORNECEDOR', 'FINANCEIRO', 'ADMIN_SISTEMA']),
  companyId: z.string().uuid().nullable().optional(),
  approvalCap: z.number().positive().optional(),
});

const createProductSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: z.string().min(2),
  unitPrice: z.number().positive(),
  currency: z.string().default('AOA'),
  leadTimeDays: z.number().int().nonnegative().optional(),
});

const createPoSchema = z.object({
  supplierCompanyId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

const rejectPoSchema = z.object({
  reason: z.string().min(3),
});

const receptionSchema = z.object({
  conforme: z.boolean(),
  notes: z.string().optional(),
});

const supplierPolicySchema = z.object({
  policyNumber: z.string().min(2),
  insurer: z.string().min(2),
  coverageAmount: z.number().positive(),
  currency: z.string().default('AOA'),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
});

const clientPolicySchema = supplierPolicySchema;

const budgetLimitSchema = z.object({
  periodMonthly: z.number().positive(),
  currency: z.string().default('AOA'),
});

const createContractSchema = z.object({
  clientCompanyId: z.string().uuid(),
  supplierCompanyId: z.string().uuid(),
  categoriesCovered: z.array(z.string().min(1)).min(1),
  totalValue: z.number().positive(),
  currency: z.string().default('AOA'),
  billingPeriodicity: z.enum(['TRIMESTRAL', 'SEMESTRAL']),
  paymentTermDays: z.number().int().positive(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
});

module.exports = {
  loginSchema,
  registerCompanySchema,
  decideCompanySchema,
  createUserSchema,
  createProductSchema,
  createPoSchema,
  rejectPoSchema,
  receptionSchema,
  supplierPolicySchema,
  clientPolicySchema,
  budgetLimitSchema,
  createContractSchema,
};
