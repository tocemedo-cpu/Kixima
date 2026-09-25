// Modelos para os fluxos de descoberta do Comprador — favoritos, pesquisas
// guardadas, comparação de fornecedores, avaliações, diretório de
// fornecedores. Contratos confirmados contra backend-java/.../marketplace/,
// .../catalog/CatalogController.java (reviews), .../painel/BuyerController.java.

// POST /api/marketplace/favorites, DELETE /api/marketplace/favorites/:id —
// SEM @RequireRole (qualquer utilizador autenticado, não só COMPRADOR).
export interface FavoriteResultDto {
  productId: string;
  favorite: boolean;
}

// POST /api/marketplace/saved-searches — SEM @RequireRole. `label`/`query`
// têm omissões silenciosas no servidor ("Pesquisa"/"" por omissão, truncados
// a 120/500 caracteres) — não há erro de validação por campo em falta.
export interface CreateSavedSearchBody {
  label: string;
  query: string;
}

export interface SavedSearchDto {
  id: string;
  userId: string;
  label: string;
  query: string;
  createdAt: string;
}

// GET /api/marketplace/compare — @RequireRole(COMPRADOR). "Mesmo item" não é
// só unspscCode igual — também conta nome normalizado igual (sem acentos,
// minúsculas). Um só oferta por fornecedor (a de menor effectivePrice),
// ordenadas por preço, no máximo 5 — sem mínimo garantido.
export interface CompareOfferSupplierRef {
  id: string;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  verified?: boolean;
}

export interface CompareOffer {
  id: string;
  name?: string;
  unitPrice: string;
  promoPrice?: string | null;
  currency: string;
  leadTimeDays?: number | null;
  material?: string | null;
  warranty?: string | null;
  standard?: string | null;
  keySpec?: string | null;
  certifications?: string[];
  countryOfOrigin?: string | null;
  incoterm?: string | null;
  availability?: string | null;
  rating?: number | null;
  reviewCount?: number;
  unspscCode?: string | null;
  category?: string;
  supplier?: CompareOfferSupplierRef | null;
  effectivePrice?: number;
}

export interface CompareBase {
  name?: string;
  unspscTitle?: string | null;
  unspscCode?: string | null;
  category?: string;
}

export interface CompareResponse {
  base: CompareBase;
  offers: CompareOffer[];
  count: number;
}

// GET /api/catalog/:id/reviews — SEM @RequireRole. Nome plano (authorName),
// sem objecto user{} aninhado.
export interface ProductReviewDto {
  id: string;
  productId: string;
  userId: string;
  authorName: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
}

// POST /api/catalog/:id/reviews — @RequireRole(COMPRADOR). Upsert por
// (productId,userId) — repetir a chamada actualiza a avaliação anterior, não
// cria duplicado. NÃO devolve a review criada, devolve o resumo agregado do
// produto (rating médio + contagem) — quem chama tem de voltar a pedir
// GET .../reviews para actualizar a lista.
export interface CreateReviewBody {
  rating: number;
  comment?: string;
}

export interface ReviewSummaryDto {
  rating: number | null;
  reviewCount: number;
}

// GET /api/buyer/suppliers — @RequireRole(COMPRADOR, COMPANY_ADMIN).
export interface BuyerSupplierLastTransaction {
  reference: string;
  createdAt: string;
}

export interface BuyerSupplierListItem {
  id: string;
  name: string;
  logoUrl?: string | null;
  verified: boolean;
  status: string;
  city?: string | null;
  country?: string | null;
  category?: string | null;
  rating?: number | null;
  productCount?: number;
  lastTransaction?: BuyerSupplierLastTransaction | null;
}

export interface BuyerSuppliersKpis {
  total: number;
  ativos: number;
  homologados: number;
  emAvaliacao: number;
  novos: number;
}

export interface BuyerSuppliersResponse {
  kpis: BuyerSuppliersKpis;
  items: BuyerSupplierListItem[];
}
