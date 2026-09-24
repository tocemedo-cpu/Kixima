package ao.kixima.payment;

import ao.kixima.common.money.FxService;
import ao.kixima.invoice.Invoice;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

/**
 * Espelha backend/src/services/platformFeeService.js — a taxa da plataforma
 * (comissão KIXIMA), à parte da PO/Fatura, cobrada ao fornecedor:
 * <ul>
 *   <li>ATÉ ao limiar (11.500 USD por transação): 8 USD por PO + 15 USD por fatura;</li>
 *   <li>ACIMA: 0,20 % do valor da transação, uma só vez, e essa percentagem
 *   já INCLUI a parcela da PO e a da fatura.</li>
 * </ul>
 * As taxas são definidas e cobradas em USD; as POs continuam em Kwanzas —
 * o câmbio configurável ({@link FxService}) só serve para aferir o limiar.
 *
 * NÃO PORTADO ainda: {@code statementFor} + as rotas do livro de taxas
 * (grupo A, item "taxa da plataforma" em LACUNAS-POS-M6.md).
 */
@Service
public class PlatformFeeService {

    public static final String CURRENCY = "USD";

    public record Calculo(int poCount, BigDecimal perPo, BigDecimal perInvoice, BigDecimal amount, String currency,
                          String basis, BigDecimal poValueUsd) {
    }

    private final PlatformFeeRepository platformFeeRepository;
    private final FxService fxService;
    private final BigDecimal perPo;
    private final BigDecimal perInvoice;
    private final BigDecimal thresholdUsd;
    private final BigDecimal percentAbove;

    public PlatformFeeService(PlatformFeeRepository platformFeeRepository, FxService fxService,
                               @Value("${kixima.fees.per-po-usd:8}") BigDecimal perPo,
                               @Value("${kixima.fees.per-invoice-usd:15}") BigDecimal perInvoice,
                               @Value("${kixima.fees.threshold-usd:11500}") BigDecimal thresholdUsd,
                               @Value("${kixima.fees.percent-above:0.002}") BigDecimal percentAbove) {
        this.platformFeeRepository = platformFeeRepository;
        this.fxService = fxService;
        this.perPo = perPo;
        this.perInvoice = perInvoice;
        this.thresholdUsd = thresholdUsd;
        this.percentAbove = percentAbove;
    }

    private static BigDecimal round2(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal perPo() {
        return perPo;
    }

    public BigDecimal perInvoice() {
        return perInvoice;
    }

    public BigDecimal thresholdUsd() {
        return thresholdUsd;
    }

    public BigDecimal percentAbove() {
        return percentAbove;
    }

    /** Calcula a taxa de uma fatura — {@code poCount} POs cobertas, {@code poValueUsd} valor (por PO) em USD, que decide o limiar. */
    public Calculo compute(int poCount, BigDecimal poValueUsd) {
        int count = Math.max(1, poCount);
        BigDecimal valor = poValueUsd == null ? BigDecimal.ZERO : poValueUsd;
        boolean acima = valor.compareTo(thresholdUsd) > 0;
        BigDecimal parcelaPo = acima ? round2(valor.multiply(percentAbove)) : perPo;
        String basis = acima ? "PERCENTUAL" : "FIXO";
        // Acima do limiar, os 0,20 % são cobrados no fim e já INCLUEM a parcela da fatura.
        BigDecimal parcelaFatura = acima ? BigDecimal.ZERO : perInvoice;
        BigDecimal amount = round2(parcelaPo.multiply(BigDecimal.valueOf(count)).add(parcelaFatura));
        return new Calculo(count, parcelaPo, parcelaFatura, amount, CURRENCY, basis, round2(valor));
    }

    /** Cria o registo de taxa para uma fatura, na MESMA transação do pagamento (quem chama é @Transactional). */
    public PlatformFee createForInvoice(Invoice invoice, String companyId) {
        int poCount = 1; // faturas consolidadas de call-offs ficam com o domínio Contract, por portar
        BigDecimal rate = fxService.fxRate();
        BigDecimal totalUsd = fxService.toUsd(invoice.getAmount(), invoice.getCurrency());
        BigDecimal perPoValueUsd = round2(totalUsd.divide(BigDecimal.valueOf(poCount), 2, RoundingMode.HALF_UP));
        Calculo f = compute(poCount, perPoValueUsd);
        PlatformFee fee = new PlatformFee(UUID.randomUUID().toString(), companyId, invoice.getId(), f.poCount(), f.perPo(),
                f.perInvoice(), f.amount(), f.currency(), f.basis(), f.poValueUsd(), rate, Instant.now());
        return platformFeeRepository.save(fee);
    }
}
