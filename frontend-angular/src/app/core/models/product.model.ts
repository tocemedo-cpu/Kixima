// Espelha o modelo Product do Prisma (backend/prisma/schema.prisma:598-702).
// Todos os campos opcionais no schema (String?, Int?, Decimal?) ficam
// opcionais aqui também — nada foi inventado ou assumido como obrigatório.
export type ProductKind = 'PRODUTO' | 'SERVICO';

export interface ProductDto {
  id: string;
  supplierId: string;
  name: string;
  sku?: string | null;
  manufacturerCode?: string | null;
  category: string;
  subcategory?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  countryOfOrigin?: string | null;

  description?: string | null;
  fullDescription?: string | null;
  applications?: string | null;
  benefits?: string | null;
  keywords?: string | null;

  unspscCode?: string | null;
  unspscTitle?: string | null;
  unspscSegment?: string | null;
  unspscFamily?: string | null;
  unspscClass?: string | null;

  keySpec?: string | null;
  standard?: string | null;
  warranty?: string | null;
  incoterm?: string | null;
  supplierNotes?: string | null;

  material?: string | null;
  weight?: string | null;
  height?: string | null;
  width?: string | null;
  length?: string | null;
  pressure?: string | null;
  temperature?: string | null;
  power?: string | null;
  voltage?: string | null;
  measurementUnit?: string | null;

  // Decimal do Prisma → string no JSON, tal como no cliente React (domain.js formatMoney espera string|number).
  unitPrice: string;
  promoPrice?: string | null;
  currency: string;
  minQuantity?: number | null;
  maxQuantity?: number | null;

  stockQuantity?: number | null;
  warehouse?: string | null;
  leadTimeDays?: number | null;
  availability?: string | null;
  minStock?: number | null;

  slug?: string | null;
  kind: ProductKind;
  specialty?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  certifications: string[];
  tags: string[];

  active: boolean;
  rating?: number | null;
  reviewCount: number;
  viewCount: number;
  imageUrl?: string | null;

  createdAt: string;
  updatedAt: string;

  // GET /api/catalog/:id inclui supplier{id,name,status}; GET /api/marketplace/search
  // inclui um "selo" adicional (verified/destaque) — ver comSelo() em marketplaceService.js.
  supplier?: {
    id: string;
    name: string;
    status?: string;
    verified?: boolean;
    destaque?: boolean;
    logoUrl?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;

  // Só em GET /api/catalog/:id (catalogService.getProduct).
  images?: ProductImageDto[];
  documents?: ProductDocumentDto[];

  // Só em GET /api/marketplace/search, quando autenticado (marketplaceService.search).
  isFavorite?: boolean;
}

// GET /api/catalog/:id (CatalogController.java) devolve exactamente estes 4
// campos por imagem — sem productId/createdAt (confirmado contra ProductImageDto.java).
export interface ProductImageDto {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

export type ProductDocType = 'FICHA_TECNICA' | 'DATASHEET' | 'MANUAL' | 'CATALOGO' | 'CERTIFICADO' | 'DESENHO_TECNICO';

// Idem — exactamente estes 4 campos (ProductDocumentDto.java), sem productId/createdAt.
export interface ProductDocumentDto {
  id: string;
  type: ProductDocType;
  fileUrl: string;
  originalName: string;
}

export const PRODUCT_AVAILABILITY = ['Em stock', 'Sob encomenda', 'Esgotado'] as const;

// Espelha marketplaceService.search() — backend/src/services/marketplaceService.js:116-142.
export interface MarketplaceSearchResult {
  items: ProductDto[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

// GET /api/marketplace/suppliers (MarketplaceService.verifiedSuppliers(8) no
// Java) — usado pela Home do Comprador.
export interface VerifiedSupplierCard {
  id: string;
  name: string;
  logoUrl?: string | null;
  city?: string | null;
  country?: string | null;
  rating?: number | null;
  productCount?: number;
}

// Espelha marketplaceService.facets() — backend/src/services/marketplaceService.js:146-179.
export interface MarketplaceFacets {
  categories: Array<{ name: string; count: number }>;
  kinds: Array<{ name: string; count: number }>;
  countries: Array<{ name: string; count: number }>;
  certifications: Array<{ name: string; count: number }>;
  priceBounds: { min: number; max: number };
}

export interface MarketplaceSearchParams {
  q?: string;
  category?: string;
  kind?: 'PRODUTO' | 'SERVICO';
  minPrice?: string;
  maxPrice?: string;
  verified?: 'true';
  minRating?: number;
  promo?: 'true';
  // Confirmados contra MarketplaceService.java (mapa livre de filtros) —
  // usados por Explore.jsx/Services.jsx, que o Catalog.jsx original não usava.
  country?: string;
  certifications?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

// Estado do formulário de CatalogManage.jsx (EMPTY_FORM) — todos os campos
// são strings (vindos de <input>), incluindo os numéricos, tal como o React.
// `kind` é aceite pelo formulário mas ignorado pelo Node e pelo Java em
// criação/edição (Product.kind fica sempre PRODUTO); mantido aqui só porque
// o React também o envia — não é uma funcionalidade nova, é paridade exacta
// com o comportamento actual (ver ProductPayload.java, que nunca lê "kind").
export interface ProductFormBody {
  kind: ProductKind;
  unspscCode: string;
  unspscTitle: string;
  unspscSegment: string;
  unspscFamily: string;
  unspscClass: string;
  imageUrl: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  description: string;
  measurementUnit: string;
  countryOfOrigin: string;
  model: string;
  keySpec: string;
  standard: string;
  warranty: string;
  incoterm: string;
  supplierNotes: string;
  currency: string;
  unitPrice: string;
  promoPrice: string;
  availability: string;
  stockQuantity: string;
  leadTimeDays: string;
}

export const EMPTY_PRODUCT_FORM: ProductFormBody = {
  kind: 'PRODUTO', unspscCode: '', unspscTitle: '', unspscSegment: '', unspscFamily: '', unspscClass: '',
  imageUrl: '',
  name: '', category: '', subcategory: '', brand: '', description: '', measurementUnit: '', countryOfOrigin: '',
  model: '', keySpec: '', standard: '', warranty: '', incoterm: '', supplierNotes: '',
  currency: 'AOA', unitPrice: '', promoPrice: '',
  availability: 'Em stock', stockQuantity: '', leadTimeDays: '',
};

// Resposta de DELETE /api/catalog/:id/images/:imageId e
// /api/catalog/:id/documents/:docId — um pequeno "ack", nunca um ProductDto
// (CatalogService.java:313-316,327-330).
export interface RemocaoAck {
  id: string;
  removida?: boolean;
  removido?: boolean;
}
