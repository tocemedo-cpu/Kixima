package ao.kixima.po.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Espelha os campos escalares de `PurchaseOrder` tal como o Node os
 * devolve. ÂMBITO NESTE MARCO: os campos da própria PO + `items` — o grafo
 * aninhado completo (buyerCompany/supplierCompany com COMPANY_FIELDS,
 * invoice com payment/creditNotes/lines, createdBy/approvedBy.name) fica
 * para quando os respectivos mappers de Company/Invoice/User existirem
 * (ver plano, secção 2: "cada resposta JSON por um mapper explícito"),
 * para não duplicar essa decisão de forma incompleta aqui.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PurchaseOrderDto(
        String id, String reference, String buyerCompanyId, String supplierCompanyId,
        String createdById, String approvedById, String status,
        BigDecimal totalAmount, BigDecimal netAmount, BigDecimal taxAmount, BigDecimal withholdingAmount,
        String currency, boolean isCallOff, boolean erpManaged,
        Instant acceptedAt, Instant paymentDueAt, Instant dispatchedAt, Instant deliveredAt, Instant receivedAt,
        String receptionStatus, String divergenceResolution, String divergenceResolutionNotes,
        Instant approvedAt, Instant rejectedAt, String rejectionReason, Instant refusedAt, String refusalReason,
        String createdBySource, Instant createdAt,
        List<PurchaseOrderItemDto> items
) {
}
