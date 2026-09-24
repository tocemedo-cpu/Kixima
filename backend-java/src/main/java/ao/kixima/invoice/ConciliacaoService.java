package ao.kixima.invoice;

import org.springframework.stereotype.Service;

import java.security.SecureRandom;

/**
 * Espelha o troço de backend/src/services/conciliacaoService.js usado no
 * aceite da PO: {@code atribuirReferencia} — a referência que o pagador
 * escreve na transferência, única em toda a plataforma. Repete em caso de
 * colisão (espaço 32^8, "grande" não é "impossível") em vez de confiar na
 * sorte — uma colisão aqui seria um pagamento creditado à fatura errada.
 */
@Service
public class ConciliacaoService {

    private static final String ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final InvoiceRepository invoiceRepository;

    public ConciliacaoService(InvoiceRepository invoiceRepository) {
        this.invoiceRepository = invoiceRepository;
    }

    private String gerarReferencia() {
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < 10; i++) {
            s.append(ALFABETO.charAt(RANDOM.nextInt(ALFABETO.length())));
        }
        return "KX" + s.substring(0, 4) + "-" + s.substring(4, 8);
    }

    /** Atribui e persiste uma referência única na fatura já criada (gerida pela transacção do chamador). */
    public String atribuirReferencia(Invoice invoice) {
        for (int tentativa = 0; tentativa < 5; tentativa++) {
            String referencia = gerarReferencia();
            if (invoiceRepository.findByReferenciaPagamento(referencia).isPresent()) continue;
            invoice.setReferenciaPagamento(referencia);
            return referencia;
        }
        throw new IllegalStateException("Não foi possível gerar uma referência de pagamento única após 5 tentativas.");
    }
}
