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
  // Apólice de seguro Fornecedor→KIXIMA — obrigatória para FORNECEDOR (validada
  // no service). Opcional no schema porque CLIENTE não a submete.
  policyNumber: z.string().optional(),
  insurer: z.string().optional(),
  coverageAmount: z.coerce.number().positive().optional(),
  policyCurrency: z.string().optional(),
  policyValidFrom: z.coerce.date().optional(),
  policyValidUntil: z.coerce.date().optional(),
  // Aceite obrigatório dos Termos de Uso e Política de Privacidade. Vem por
  // multipart (string "true") ou JSON (boolean) — normalizado antes de validar.
  termsAccepted: z.preprocess(
    (v) => v === true || v === 'true',
    z.literal(true, { errorMap: () => ({ message: 'É necessário aceitar os Termos de Uso e a Política de Privacidade.' }) })
  ),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres.'),
});

// Recuperação de senha ("Esqueci a senha").
const forgotPasswordSchema = z.object({
  email: z.string().email('Indique um email válido.'),
});
const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});

// 2FA (TOTP): código de 6 dígitos; o verify traz também o desafio do login.
const totpCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'O código tem 6 dígitos.'),
});
const totpVerifySchema = totpCodeSchema.extend({
  challenge: z.string().min(10),
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

// Convite de funcionário emitido pelo Company Admin (Vendedor = FORNECEDOR). O
// nome e o email são obrigatórios: o link é gerado e enviado automaticamente.
const createInviteSchema = z.object({
  role: z.enum(['COMPRADOR', 'FORNECEDOR', 'FINANCEIRO']),
  name: z.string().min(2, 'Indique o nome do funcionário.'),
  email: z.string().email('Indique um email válido.'),
});

// Aceitação de convite: o convidado define a senha. Nome/email são opcionais
// (vêm do convite); mantidos para compatibilidade com links antigos.
const acceptInviteSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
  // Aceite individual dos Termos/Privacidade ao criar a conta por convite.
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'É necessário aceitar os Termos de Uso e a Política de Privacidade.' }) }),
});

// Campo de texto opcional que trata "" (vindo de multipart) como ausente.
const optText = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().optional());
const optInt = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.coerce.number().int().nonnegative().optional()
);
const optNum = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.coerce.number().nonnegative().optional()
);

const createProductSchema = z.object({
  // Identificação
  name: z.string().min(2),
  sku: optText,
  manufacturerCode: optText,
  category: z.string().min(2),
  subcategory: optText,
  brand: optText,
  manufacturer: optText,
  model: optText,
  countryOfOrigin: optText,
  // Descrição
  description: optText,
  fullDescription: optText,
  applications: optText,
  benefits: optText,
  keywords: optText,
  // Classificação (UNSPSC) — preenchida via dropdown em cascata.
  unspscCode: optText,
  unspscTitle: optText,
  unspscSegment: optText,
  unspscFamily: optText,
  unspscClass: optText,
  // Atributos universais (livres) + comentários do fornecedor.
  keySpec: optText,
  standard: optText,
  warranty: optText,
  incoterm: optText,
  supplierNotes: optText,
  // Imagem de referência do catálogo (URL local), quando não há upload próprio.
  imageUrl: optText,
  // Especificações técnicas (texto livre)
  material: optText,
  weight: optText,
  height: optText,
  width: optText,
  length: optText,
  pressure: optText,
  temperature: optText,
  power: optText,
  voltage: optText,
  measurementUnit: optText,
  // Preço
  unitPrice: z.coerce.number().positive(),
  promoPrice: optNum,
  currency: z.string().default('AOA'),
  minQuantity: optInt,
  maxQuantity: optInt,
  // Estoque
  stockQuantity: optInt,
  warehouse: optText,
  leadTimeDays: optInt,
  availability: optText,
  minStock: optInt,
});

// Atualização: os mesmos campos, todos opcionais (não recria imagens/documentos).
const updateProductSchema = createProductSchema.partial();

// Pedido de cotação (RFQ) e resposta do fornecedor.
const createQuoteSchema = z.object({
  supplierCompanyId: z.string().uuid(),
  note: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().int().positive().default(1),
  })).min(1),
});
const respondQuoteSchema = z.object({
  price: z.coerce.number().positive(),
  leadDays: z.coerce.number().int().nonnegative().optional(),
  note: z.string().optional(),
});

// Marketplace — pesquisa paginada/filtrada (query params, saneados).
const marketplaceSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().max(80).optional(),
  kind: z.enum(['PRODUTO', 'SERVICO']).optional(),
  certifications: z.string().max(200).optional(),
  availability: z.string().max(40).optional(),
  verified: z.enum(['true', 'false']).optional(),
  promo: z.enum(['true', 'false']).optional(),
  country: z.string().max(60).optional(),
  province: z.string().max(60).optional(),
  city: z.string().max(60).optional(),
  specialty: z.string().max(80).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: z.enum(['relevantes', 'recentes', 'avaliacao', 'preco_asc', 'preco_desc', 'solicitados', 'vendidos']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(48).optional(),
});

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

const favoriteSchema = z.object({ productId: z.string().uuid() });

// Kit: pacote de produtos.
const createKitSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().int().positive().default(1),
  })).min(1),
});

// Movimento de inventário (entrada/saída).
const stockMovementSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(['ENTRADA', 'SAIDA']),
  quantity: z.coerce.number().int().positive(),
  note: z.string().optional(),
});

// Atualização de inventário (Stock) — apenas os campos de estoque.
const stockUpdateSchema = z.object({
  stockQuantity: optInt,
  minStock: optInt,
  warehouse: optText,
  availability: optText,
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

// Resolução de divergência: aceitar a entrega como está ou pedir reposição.
const resolveDivergenceSchema = z.object({
  outcome: z.enum(['ACEITE', 'REPOSICAO']),
  notes: z.string().max(1000).optional(),
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

// Dados bancários da empresa (para pagamentos). Todos opcionais — o Fornecedor
// pode gravar parcialmente e completar depois. "" é tratado como ausente.
const bankDetailsSchema = z.object({
  bankName: optText,
  iban: optText,
  swift: optText,
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

const erpConfigSchema = z.object({
  erp: z.enum(['MANUAL', 'PRIMAVERA', 'SAP_S4HANA', 'ORACLE_ERP_CLOUD', 'SAP_ARIBA']),
  config: z.record(z.string()).optional().default({}),
});

module.exports = {
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  totpCodeSchema,
  totpVerifySchema,
  registerCompanySchema,
  decideCompanySchema,
  erpConfigSchema,
  createUserSchema,
  createInviteSchema,
  acceptInviteSchema,
  createProductSchema,
  updateProductSchema,
  stockUpdateSchema,
  stockMovementSchema,
  createKitSchema,
  createQuoteSchema,
  respondQuoteSchema,
  marketplaceSearchSchema,
  reviewSchema,
  favoriteSchema,
  createPoSchema,
  rejectPoSchema,
  receptionSchema,
  resolveDivergenceSchema,
  supplierPolicySchema,
  clientPolicySchema,
  budgetLimitSchema,
  bankDetailsSchema,
  createContractSchema,
};
