package ao.kixima.po.dto;

import java.util.List;

/**
 * Envelope paginado de GET /api/purchase-orders?page=... — espelha o objecto
 * literal devolvido por poService.listPurchaseOrders quando `page` é passado
 * (backend/src/services/poService.js:245-268). Nomes de campo em inglês de
 * propósito: são os mesmos do Node, não os do envelope genérico em português
 * de Paginacao.envelope (contrato diferente, endpoint diferente).
 */
public record PurchaseOrdersPageDto(List<PurchaseOrderDto> items, long total, int page, int pages, int limit) {
}
