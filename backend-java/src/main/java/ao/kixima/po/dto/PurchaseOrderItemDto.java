package ao.kixima.po.dto;

import java.math.BigDecimal;

public record PurchaseOrderItemDto(String id, String productId, int quantity, BigDecimal unitPrice, BigDecimal lineTotal) {
}
