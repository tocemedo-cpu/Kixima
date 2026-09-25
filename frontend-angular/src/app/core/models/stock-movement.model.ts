// Espelha os DTOs de inventário do Java (catalog/dto/) — confirmados contra
// CatalogController.java: PATCH /api/catalog/:id/stock, GET/POST /api/catalog/movements.
export type StockMovementType = 'ENTRADA' | 'SAIDA';

export interface UpdateStockBody {
  stockQuantity?: number;
  minStock?: number;
  warehouse?: string;
  availability?: string;
}

// GET /api/catalog/movements — item da listagem (StockMovementListItemDto.java),
// inclui a referência ao produto {name} ao contrário da resposta do POST.
export interface StockMovementListItemDto {
  id: string;
  type: StockMovementType;
  quantity: number;
  note?: string | null;
  createdAt: string;
  productId: string;
  product?: { name: string } | null;
}

export interface StockMovementsPage {
  itens: StockMovementListItemDto[];
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
}

export interface CreateStockMovementBody {
  productId: string;
  type: StockMovementType;
  quantity: number;
  note?: string;
}

// Resposta de POST /api/catalog/movements (StockMovementDto.java) — forma
// PLANA, sem o `product{name}` que a listagem tem.
export interface StockMovementDto {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  note?: string | null;
  createdById: string;
  createdAt: string;
}
