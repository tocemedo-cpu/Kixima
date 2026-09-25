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

  supplier?: { id: string; name: string; verified?: boolean } | null;
}

export const PRODUCT_AVAILABILITY = ['Em stock', 'Sob encomenda', 'Esgotado'] as const;
