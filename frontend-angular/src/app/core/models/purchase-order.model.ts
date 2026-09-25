// Espelha o modelo PurchaseOrder do Prisma (backend/prisma/schema.prisma:891-990)
// e o INCLUDE completo de poService.getPurchaseOrder (backend/src/services/poService.js:199-217).
export type PoStatus =
  | 'AGUARDANDO_APROVACAO' | 'APROVADA' | 'REJEITADA' | 'ACEITE_FORNECEDOR' | 'RECUSADA_FORNECEDOR'
  | 'AGUARDANDO_PAGAMENTO' | 'PAGA' | 'EM_EXECUCAO' | 'ENTREGUE'
  | 'RECEBIDA_CONFORME' | 'RECEBIDA_COM_DIVERGENCIA' | 'CONCLUIDA';

// GET /api/purchase-orders/:id (PoDtoService.detalhe(), CompanyRef.de()) —
// confirmado por um agente de pesquisa dedicado: 13 campos, todos sempre
// presentes (nunca omitidos individualmente) quando buyerCompany/
// supplierCompany está presente, usados por PrintableDocument.jsx (partes/
// dados bancários do documento oficial). `verified` NÃO existe neste
// CompanyRef do Java (fica opcional aqui só porque outros sítios do
// contrato, como a listagem de fornecedores do marketplace, usam uma forma
// mais rica com esse campo — nunca confundir os dois).
export interface CompanyRef {
  id: string;
  name: string;
  verified?: boolean;
  logoUrl?: string | null;
  city?: string | null;
  country?: string | null;
  taxId?: string | null;
  address?: string | null;
  province?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  bankName?: string | null;
  iban?: string | null;
  swift?: string | null;
}

export interface PurchaseOrderItemDto {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  // GET /api/purchase-orders/:id devolve o ProductDto completo (comProduto=
  // true); category/kind confirmados por um agente de pesquisa dedicado —
  // usados por PrintableDocument.jsx (coluna Categoria e cálculo da
  // retenção na fonte, que só se aplica a itens kind === 'SERVICO').
  product?: { id: string; name: string; category?: string | null; kind?: string | null } | null;
}

// Espelha o modelo Payment do Prisma (backend/prisma/schema.prisma:1403-1445).
// `processedByName` é acrescentado pelo service (não é uma coluna) — ver
// poService.getPurchaseOrder:226-228 ("Payment só guarda o id").
export interface PaymentDto {
  id: string;
  invoiceId: string;
  amount: string;
  currency: string;
  status: string;
  canal: string;
  reference: string;
  processedById?: string | null;
  processedByName?: string | null;
  proofUrl?: string | null;
  proofName?: string | null;
  receivedAt?: string | null;
  receivedById?: string | null;
  processedAt: string;
}

// quantity/unitPrice/netAmount/ivaAmount confirmados por um agente de
// pesquisa dedicado (InvoiceLineDto.java) — BigDecimal, serializados como
// string (mesma convenção do resto do contrato).
export interface InvoiceLineDto {
  id: string;
  invoiceId: string;
  lineNumber: number;
  description?: string | null;
  quantity?: string | null;
  unitPrice?: string | null;
  netAmount?: string | null;
  ivaAmount?: string | null;
}

export interface CreditNoteDto {
  id: string;
  reference: string;
  invoiceId: string;
  motivo: string;
  amount: string;
  currency: string;
  serie?: string | null;
  numeroNaSerie?: number | null;
  issuedAt: string;
}

export interface InvoiceDto {
  id: string;
  reference: string;
  purchaseOrderId?: string | null;
  amount: string;
  // Confirmados directamente no Java (InvoiceDto.java) — a mesma tríade de
  // netAmount/taxAmount/withholdingAmount que já existia em PurchaseOrderDto,
  // também presente na Fatura (usada por PrintableDocument.jsx).
  netAmount?: string | null;
  taxAmount?: string | null;
  withholdingAmount?: string | null;
  currency: string;
  status: string;
  issuedAt: string;
  dueAt: string;
  serie?: string | null;
  numeroNaSerie?: number | null;
  // Confirmado por um agente de pesquisa dedicado (InvoiceDto.java) — usado
  // por PrintableDocument.jsx (hash truncado a 16 caracteres no documento).
  hashDocumento?: string | null;
  payment?: PaymentDto | null;
  creditNotes: CreditNoteDto[];
  lines: InvoiceLineDto[];
}

export interface PurchaseOrderDto {
  id: string;
  reference: string;
  buyerCompanyId: string;
  supplierCompanyId: string;
  createdById: string;
  status: PoStatus;
  totalAmount: string;
  netAmount?: string | null;
  taxAmount?: string | null;
  withholdingAmount?: string | null;
  currency: string;

  isCallOff: boolean;
  contractId?: string | null;
  contract?: { reference: string } | null;

  acceptedAt?: string | null;
  paymentDueAt?: string | null;
  paidAt?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  receivedAt?: string | null;
  receptionStatus?: string | null;

  divergenceResolution?: string | null;
  divergenceResolutionNotes?: string | null;
  divergenceResolvedAt?: string | null;

  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  refusedAt?: string | null;
  refusalReason?: string | null;

  erpManaged: boolean;
  erpExternalId?: string | null;

  createdAt: string;
  updatedAt: string;

  items: PurchaseOrderItemDto[];
  invoice?: InvoiceDto | null;
  // Omitidos (não null) pelo Java quando não populados — confirmado em
  // GET /api/purchase-orders sem :id (a listagem usada por Home/OrderHistory/
  // Wallet do Fornecedor, PoDtoService.java, @JsonInclude(NON_NULL)).
  buyerCompany?: CompanyRef;
  supplierCompany?: CompanyRef;
  createdBy?: { name: string } | null;
  approvedBy?: { name: string } | null;
}

// Forma resumida devolvida por listPurchaseOrders/buyerService.orders
// (poService.js:55-64) — NÃO tem items[]/invoice{} completos, só o essencial
// de lista. Nunca confundir com PurchaseOrderDto (detalhe).
export interface PurchaseOrderSummaryDto {
  id: string;
  reference: string;
  status: PoStatus;
  supplier: CompanyRef;
  itemsCount: number;
  totalAmount: number;
  currency: string;
  isCallOff: boolean;
  createdAt: string;
  acceptedAt?: string | null;
  paymentDueAt?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  receivedAt?: string | null;
  receptionStatus?: string | null;
}

export interface BuyerOrdersKpis {
  total: number;
  valorTotal: number;
  emAndamento: number;
  concluidas: number;
  canceladas: number;
}

// Espelha buyerService.orders() — backend/src/services/buyerService.js:25-53.
export interface BuyerOrdersResult {
  kpis: BuyerOrdersKpis;
  items: PurchaseOrderSummaryDto[];
  total: number;
  page: number;
  pages: number;
}

// Corpo de POST /api/purchase-orders — espelha createPoSchema (utils/schemas.js:349-359).
export interface CreatePoBody {
  supplierCompanyId: string;
  items: Array<{ productId: string; quantity: number }>;
}

export interface RejectPoBody {
  reason: string;
}
export interface RefusePoBody {
  reason: string;
}
export interface ReceptionBody {
  conforme: boolean;
  notes?: string;
}
export interface ResolveDivergenceBody {
  outcome: 'ACEITE' | 'REPOSICAO';
  notes?: string;
}

// Espelha o AuditLog (backend/prisma/schema.prisma:1838-1854), devolvido cru
// por GET /api/purchase-orders/:id/history.
export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityRef?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  companyId?: string | null;
  detail?: Record<string, unknown> | null;
  createdAt: string;
}
