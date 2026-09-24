package ao.kixima.po.dto;

import ao.kixima.po.PurchaseOrder;
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
        String currency, boolean isCallOff, String contractId, String consolidatedInvoiceId, boolean erpManaged,
        String erpExternalId, Instant erpApprovalRequestedAt,
        Instant acceptedAt, Instant paymentDueAt, Instant dispatchedAt, Instant deliveredAt, Instant receivedAt,
        String receptionStatus, String divergenceResolution, String divergenceResolutionNotes,
        Instant approvedAt, Instant rejectedAt, String rejectionReason, Instant refusedAt, String refusalReason,
        String createdBySource, Instant createdAt,
        List<PurchaseOrderItemDto> items
) {

    public static PurchaseOrderDto de(PurchaseOrder po) {
        List<PurchaseOrderItemDto> items = po.getItems().stream()
                .map(i -> new PurchaseOrderItemDto(i.getId(), i.getProductId(), i.getQuantity(), i.getUnitPrice(), i.getLineTotal()))
                .toList();
        return new PurchaseOrderDto(
                po.getId(), po.getReference(), po.getBuyerCompanyId(), po.getSupplierCompanyId(),
                po.getCreatedById(), po.getApprovedById(), po.getStatus().name(),
                po.getTotalAmount(), po.getNetAmount(), po.getTaxAmount(), po.getWithholdingAmount(),
                po.getCurrency(), po.isCallOff(), po.getContractId(), po.getConsolidatedInvoiceId(), po.isErpManaged(),
                po.getErpExternalId(), po.getErpApprovalRequestedAt(),
                po.getAcceptedAt(), po.getPaymentDueAt(), po.getDispatchedAt(), po.getDeliveredAt(), po.getReceivedAt(),
                po.getReceptionStatus(), po.getDivergenceResolution(), po.getDivergenceResolutionNotes(),
                po.getApprovedAt(), po.getRejectedAt(), po.getRejectionReason(), po.getRefusedAt(), po.getRefusalReason(),
                po.getCreatedBySource(), po.getCreatedAt(),
                items);
    }
}
