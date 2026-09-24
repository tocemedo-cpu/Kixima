package ao.kixima.conciliacao.dto;

import ao.kixima.conciliacao.LinhaExtrato;
import ao.kixima.invoice.Invoice;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.Instant;

/** Espelha a linha `LinhaExtrato` de porResolver() — com a fatura (id, reference, amount, currency) quando há. */
public record LinhaExtratoDto(String id, String idNoBanco, Instant dataValor, BigDecimal montante, String moeda,
                              String descricao, String referencia, String estado, String invoiceId, String motivo,
                              Instant importadaEm, Instant conciliadaEm,
                              @JsonInclude(JsonInclude.Include.NON_NULL) InvoiceRef invoice) {

    public record InvoiceRef(String id, String reference, BigDecimal amount, String currency) {
    }

    public static LinhaExtratoDto de(LinhaExtrato l) {
        Invoice i = l.getInvoiceId() == null ? null : l.getInvoice();
        InvoiceRef ref = i == null ? null : new InvoiceRef(i.getId(), i.getReference(), i.getAmount(), i.getCurrency());
        return new LinhaExtratoDto(l.getId(), l.getIdNoBanco(), l.getDataValor(), l.getMontante(), l.getMoeda(), l.getDescricao(),
                l.getReferencia(), l.getEstado(), l.getInvoiceId(), l.getMotivo(), l.getImportadaEm(), l.getConciliadaEm(), ref);
    }
}
