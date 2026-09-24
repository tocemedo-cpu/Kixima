package ao.kixima.supplierdev.dto;

import java.math.BigDecimal;

/** Espelha o `accessFee` do retorno de supplierDevService.create — inclui `status`, ao contrário de GET /fee. */
public record SupplierDevAccessFeeDto(BigDecimal amountUsd, String currency, boolean dueOnSubmission, String status,
                                       boolean remainderCustom) {
}
