package ao.kixima.payment.dto;

import java.math.BigDecimal;
import java.util.List;

/** Espelha adminService.listPlatformFees — o livro de taxas da plataforma, todas as empresas. */
public record PlatformFeeBookDto(List<PlatformFeeDto> fees, Kpis kpis) {

    public record Kpis(int total, BigDecimal totalAOA, BigDecimal pendingAOA, int cobradas) {
    }
}
