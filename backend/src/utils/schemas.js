// src/utils/schemas.js
// Schemas de validação (Zod) para os corpos de pedido de cada endpoint.

const { z } = require('zod');
const passwordPolicy = require('./passwordPolicy');
const { AREAS_ADMIN } = require('./adminAreas');

// Campo de senha validado pela política única (comprimento, senhas proibidas,
// sequências e email dentro da senha). `role` fixa o mínimo: os perfis que
// aprovam dinheiro exigem mais.
function senha(role) {
  return z.string().superRefine((valor, ctx) => {
    const erro = passwordPolicy.validar(valor, { role });
    if (erro) ctx.addIssue({ code: z.ZodIssueCode.custom, message: erro });
  });
}

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
  adminPassword: senha('COMPANY_ADMIN'),
  // Apólice de seguro Fornecedor→KIXIMA — obrigatória para FORNECEDOR (validada
  // no service). Opcional no schema porque CLIENTE não a submete.
  policyNumber: z.string().optional(),
  insurer: z.string().optional(),
  coverageAmount: z.coerce.number().positive().optional(),
  policyCurrency: z.string().optional(),
  policyValidFrom: z.coerce.date().optional(),
  policyValidUntil: z.coerce.date().optional(),
  // Dimensão da empresa (decide o plano elegível: GRANDE exige o PRO).
  employees: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().int().nonnegative().optional()),
  annualRevenueUsd: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().nonnegative().optional()),
  plan: z.enum(['BASICO', 'PRO']).optional(),
  // Aceite obrigatório dos Termos de Uso e Política de Privacidade. Vem por
  // multipart (string "true") ou JSON (boolean) — normalizado antes de validar.
  termsAccepted: z.preprocess(
    (v) => v === true || v === 'true',
    z.literal(true, { errorMap: () => ({ message: 'É necessário aceitar os Termos de Uso e a Política de Privacidade.' }) })
  ),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: senha(),
});

// Recuperação de senha ("Esqueci a senha").
const forgotPasswordSchema = z.object({
  email: z.string().email('Indique um email válido.'),
});
const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: senha(),
});

// 2FA (TOTP): código de 6 dígitos; o verify traz também o desafio do login.
const totpCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'O código tem 6 dígitos.'),
});
const totpVerifySchema = totpCodeSchema.extend({
  challenge: z.string().min(10),
});
// Reenvio do código no ecrã de login: só o desafio, ainda não há código.
const reenviarCodigoSchema = z.object({
  challenge: z.string().min(10),
});

// Admin do Sistema: dimensão, plano e preço por utilizador de uma empresa.
const companyPlanSchema = z.object({
  size: z.enum(['MICRO', 'PEQUENA', 'MEDIA', 'GRANDE']).optional(),
  plan: z.enum(['BASICO', 'PRO']).optional(),
  seatPriceUsd: z.coerce.number().nonnegative().max(100).optional(),
  employees: z.coerce.number().int().nonnegative().optional(),
  annualRevenueUsd: z.coerce.number().nonnegative().optional(),
  planNotes: z.string().max(500).optional(),
});

// Supplier Development — candidatura pública ao programa.
const supplierDevSchema = z.object({
  companyName: z.string().min(2, 'Indique o nome da empresa.'),
  taxId: z.string().max(40).optional(),
  contactName: z.string().min(2, 'Indique o nome do contacto.'),
  contactEmail: z.string().email('Indique um email válido.'),
  contactPhone: z.string().max(40).optional(),
  province: z.string().max(60).optional(),
  sector: z.string().max(120).optional(),
  employees: z.coerce.number().int().nonnegative().optional(),
  track: z.enum(['BUROCRACIA', 'PARCERIA', 'AMBOS']).optional(),
  needs: z.string().max(2000).optional(),
  // A taxa de acesso é cobrada no acto da submissão: o candidato tem de
  // confirmar que a conhece antes de submeter.
  feeAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Confirme que aceita a taxa de acesso cobrada na submissão.' }),
  }),
});
const supplierDevUpdateSchema = z.object({
  status: z.enum(['RECEBIDA', 'EM_ANALISE', 'EM_ACOMPANHAMENTO', 'CONCLUIDA', 'REJEITADA']).optional(),
  adminNotes: z.string().max(2000).optional(),
  // Receção da taxa de acesso cobrada na submissão.
  feeStatus: z.enum(['PENDENTE', 'COBRADO']).optional(),
  // Valor orçamentado do RESTANTE do programa (serviços prestados).
  programFeeUsd: z.coerce.number().nonnegative().optional(),
});

const decideCompanySchema = z.object({
  approve: z.boolean(),
  rejectionReason: z.string().optional(),
});

// ADMIN_SISTEMA fica DE FORA deste enum de propósito. Este endpoint (criação
// direta de utilizador) ficava aberto a criar um Super Admin instantâneo —
// ativo, sem convite, sem atribuição de áreas, sem passar por
// requireSuperAdmin() — bastava a `cadastro` bastar-lhe. Um assessor tem UM
// caminho só, a partir de agora: o convite em adminService.createAdminInvite.
const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: senha(),
  role: z.enum(['COMPRADOR', 'COMPANY_ADMIN', 'FORNECEDOR', 'FINANCEIRO']),
  companyId: z.string().uuid().nullable().optional(),
  approvalCap: z.number().positive().optional(),
}).superRefine((d, ctx) => {
  // O mínimo depende do perfil que está a ser criado, e esse só se conhece com o
  // objeto inteiro — daí a validação ser aqui e não no campo.
  const erro = passwordPolicy.validar(d.password, { role: d.role, email: d.email });
  if (erro) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: erro });
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
  password: senha(),
  // Aceite individual dos Termos/Privacidade ao criar a conta por convite.
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'É necessário aceitar os Termos de Uso e a Política de Privacidade.' }) }),
});

// Convite de assessor (ADMIN_SISTEMA), emitido só pelo Super Admin
// (requireSuperAdmin na rota). Pelo menos uma área: um convite vazio
// promoveria a Super Admin sem ninguém ter escolhido isso no ecrã de áreas.
const createAdminInviteSchema = z.object({
  name: z.string().min(2, 'Indique o nome do assessor.'),
  email: z.string().email('Indique um email válido.'),
  adminAreas: z.array(z.enum(AREAS_ADMIN)).min(1, 'Selecione pelo menos uma área administrativa.'),
});

// Aceitação do convite de assessor: só a senha. NADA de `adminAreas` aqui —
// de propósito. As áreas vêm sempre da linha do convite; um campo neste
// schema seria um convite a ser ignorado ou, pior, lido por engano algures.
const acceptAdminInviteSchema = z.object({
  password: senha('ADMIN_SISTEMA'),
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

// Recusa pelo fornecedor (distinta da rejeição do Company Admin acima): sem
// motivo, quem emitiu a PO fica sem explicação nenhuma do porquê.
const refusePoSchema = z.object({
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
  reenviarCodigoSchema,
  registerCompanySchema,
  decideCompanySchema,
  companyPlanSchema,
  supplierDevSchema,
  supplierDevUpdateSchema,
  erpConfigSchema,
  createUserSchema,
  createInviteSchema,
  acceptInviteSchema,
  createAdminInviteSchema,
  acceptAdminInviteSchema,
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
  refusePoSchema,
  receptionSchema,
  resolveDivergenceSchema,
  supplierPolicySchema,
  clientPolicySchema,
  budgetLimitSchema,
  bankDetailsSchema,
  createContractSchema,
};
