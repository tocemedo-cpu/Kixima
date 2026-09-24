package ao.kixima.payment.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Espelha platformFeeService.statementFor — extrato de taxas de UMA empresa
 * (fornecedor): lista completa + totais + a fórmula. Nomes dos KPIs mantidos
 * por compatibilidade da UI ({@code totalAOA} etc.); os valores estão em USD.
 */
public record PlatformFeeStatementDto(CompanyRef company, List<PlatformFeeDto> fees, Kpis kpis, Formula formula, Instant generatedAt) {

    public record CompanyRef(String id, String name, String taxId, String address, String city, String province, String country,
                             String contactEmail, String plan, String size, BigDecimal seatPriceUsd) {
    }

    public record Kpis(int total, BigDecimal totalAOA, BigDecimal pendingAOA, BigDecimal chargedAOA, int pendentes, int cobradas,
                       String currency) {
    }

    public record Formula(BigDecimal perPo, BigDecimal perInvoice, BigDecimal thresholdUsd, BigDecimal percentAbove, String currency) {
    }
}
