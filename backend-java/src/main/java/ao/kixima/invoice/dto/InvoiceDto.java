package ao.kixima.invoice.dto;

import ao.kixima.invoice.Invoice;
import ao.kixima.invoice.InvoiceStatus;
import ao.kixima.po.PurchaseOrder;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.Instant;

/** Espelha a linha `Invoice` devolvida pelo Node (com `purchaseOrder` quando o `include` o traz). */
public record InvoiceDto(String id, String reference, String purchaseOrderId, BigDecimal amount, BigDecimal netAmount,
                         BigDecimal taxAmount, BigDecimal withholdingAmount, String currency, InvoiceStatus status,
                         Instant issuedAt, Instant dueAt, String serie, Integer numeroNaSerie, String hashDocumento,
                         String referenciaPagamento, String agtDocumentNo, Instant createdAt,
                         @JsonInclude(JsonInclude.Include.NON_NULL) PurchaseOrderRef purchaseOrder) {

    public record PurchaseOrderRef(String id, String reference, String status, String buyerCompanyId, String supplierCompanyId,
                                   BigDecimal totalAmount, String currency, Instant createdAt) {
        public static PurchaseOrderRef de(PurchaseOrder po) {
            return new PurchaseOrderRef(po.getId(), po.getReference(), po.getStatus().name(), po.getBuyerCompanyId(),
                    po.getSupplierCompanyId(), po.getTotalAmount(), po.getCurrency(), po.getCreatedAt());
        }
    }

    public static InvoiceDto de(Invoice i, boolean comPurchaseOrder) {
        PurchaseOrderRef po = comPurchaseOrder && i.getPurchaseOrder() != null ? PurchaseOrderRef.de(i.getPurchaseOrder()) : null;
        return new InvoiceDto(i.getId(), i.getReference(), i.getPurchaseOrderId(), i.getAmount(), i.getNetAmount(), i.getTaxAmount(),
                i.getWithholdingAmount(), i.getCurrency(), i.getStatus(), i.getIssuedAt(), i.getDueAt(), i.getSerie(),
                i.getNumeroNaSerie(), i.getHashDocumento(), i.getReferenciaPagamento(), i.getAgtDocumentNo(), i.getCreatedAt(), po);
    }
}
