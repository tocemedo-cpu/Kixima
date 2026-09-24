package ao.kixima.analytics;

import ao.kixima.po.PoStatus;
import ao.kixima.po.PurchaseOrderItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;

/**
 * Espelha só a parte de backend/src/services/categoryAnalyticsService.js que
 * o PO Robot reutiliza — {@code historicoMensalPorProduto} e
 * {@code mediaMensalPorProduto} (a MESMA função do Category Management,
 * nunca duplicada). Lê exclusivamente o que já existe (PurchaseOrderItem →
 * PurchaseOrder), só POs de compra reconhecida (PAGA em diante).
 *
 * NÃO PORTADO: volumePorCategoria/previsaoNecessidade/oportunidades de
 * consolidação — o dashboard de Category Management (ver
 * DiscountThresholdService, javadoc) fica para quando esse troço for portado.
 */
@Service
public class CategoryAnalyticsService {

    static final List<PoStatus> RECONHECIDAS = List.of(PoStatus.PAGA, PoStatus.EM_EXECUCAO, PoStatus.ENTREGUE,
            PoStatus.RECEBIDA_CONFORME, PoStatus.RECEBIDA_COM_DIVERGENCIA, PoStatus.CONCLUIDA);

    public record MesQuantidade(String mes, long quantidade) {
    }

    /** Espelha o objecto devolvido por mediaMensalPorProduto. */
    public record MediaMensal(String produtoId, int amostras, int mesesComCompra, Integer mesesDecorridos,
                              Long quantidadeTotal, BigDecimal mediaMensal) {
    }

    private final PurchaseOrderItemRepository purchaseOrderItemRepository;

    public CategoryAnalyticsService(PurchaseOrderItemRepository purchaseOrderItemRepository) {
        this.purchaseOrderItemRepository = purchaseOrderItemRepository;
    }

    /** Quantidade comprada de um produto, agrupada por mês (YYYY-MM), ordenada. */
    @Transactional(readOnly = true)
    public List<MesQuantidade> historicoMensalPorProduto(String companyId, String productId, int meses) {
        Instant ate = Instant.now();
        Instant de = ate.minus((long) meses * 30, ChronoUnit.DAYS);

        TreeMap<String, Long> porMes = new TreeMap<>();
        for (Object[] linha : purchaseOrderItemRepository.historicoDeCompra(companyId, productId, RECONHECIDAS, de, ate)) {
            YearMonth ym = YearMonth.from(((Instant) linha[0]).atZone(ZoneOffset.UTC));
            porMes.merge(ym.toString(), ((Number) linha[1]).longValue(), Long::sum);
        }

        List<MesQuantidade> historico = new ArrayList<>();
        porMes.forEach((mes, quantidade) -> historico.add(new MesQuantidade(mes, quantidade)));
        return historico;
    }

    /**
     * Média mensal de compra de um produto. Divide-se pelos MESES DECORRIDOS
     * desde a primeira compra, não só pelos meses em que houve compra — um
     * produto comprado a cada 3 meses tem média mensal de 1/3 da quantidade
     * por compra, senão o robot pediria a quantidade inteira todos os meses.
     */
    @Transactional(readOnly = true)
    public MediaMensal mediaMensalPorProduto(String companyId, String productId) {
        List<MesQuantidade> historico = historicoMensalPorProduto(companyId, productId, 12);
        if (historico.isEmpty()) {
            return new MediaMensal(productId, 0, 0, null, null, BigDecimal.ZERO);
        }

        long quantidadeTotal = historico.stream().mapToLong(MesQuantidade::quantidade).sum();
        YearMonth primeiro = YearMonth.parse(historico.get(0).mes());
        YearMonth agora = YearMonth.now(ZoneOffset.UTC);
        int mesesDecorridos = (int) Math.max(1, ChronoUnit.MONTHS.between(primeiro, agora) + 1);

        BigDecimal media = BigDecimal.valueOf(quantidadeTotal)
                .divide(BigDecimal.valueOf(mesesDecorridos), 2, RoundingMode.HALF_UP);
        return new MediaMensal(productId, historico.size(), historico.size(), mesesDecorridos, quantidadeTotal, media);
    }
}
