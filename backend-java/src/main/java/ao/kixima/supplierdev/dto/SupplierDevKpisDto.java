package ao.kixima.supplierdev.dto;

import java.math.BigDecimal;

public record SupplierDevKpisDto(long total, long recebidas, long emAnalise, long acompanhamento, long concluidas,
                                  long taxasPendentes, BigDecimal taxasPendentesUsd) {
}
