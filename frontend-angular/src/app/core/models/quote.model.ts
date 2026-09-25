// Espelha o `INCLUDE` de quoteService.js (backend/src/services/quoteService.js)
// e o schema Prisma (QuoteRequest/QuoteItem, backend/prisma/schema.prisma:747-784).
export type QuoteStatus = 'ABERTA' | 'RESPONDIDA' | 'FECHADA';

export interface QuoteCompanyRef {
  id: string;
  name: string;
}

export interface QuoteItemProductRef {
  id: string;
  name: string;
  unitPrice: string; // Decimal do Prisma chega como string no JSON — nunca number.
  currency: string;
}

export interface QuoteItem {
  id: string;
  quoteRequestId: string;
  productId: string;
  quantity: number;
  product: QuoteItemProductRef;
}

export interface QuoteRequestDto {
  id: string;
  buyerCompanyId: string;
  supplierCompanyId: string;
  createdById: string;
  status: QuoteStatus;
  note: string | null;
  responsePrice: string | null;
  responseLeadDays: number | null;
  responseNote: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
  buyerCompany: QuoteCompanyRef;
  supplierCompany: QuoteCompanyRef;
}

// Corpo de POST /api/quotes — espelha createQuoteSchema (utils/schemas.js:281-288).
export interface CreateQuoteRequestBody {
  supplierCompanyId: string;
  note?: string;
  items: Array<{ productId: string; quantity: number }>;
}

// Corpo de PATCH /api/quotes/:id/respond — espelha respondQuoteSchema (utils/schemas.js:289-293).
export interface RespondQuoteBody {
  price: number;
  leadDays?: number;
  note?: string;
}

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  ABERTA: 'Aberta',
  RESPONDIDA: 'Respondida',
  FECHADA: 'Fechada',
};
