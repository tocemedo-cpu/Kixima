package ao.kixima.creditnote;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface CreditNoteRepository extends JpaRepository<CreditNote, String> {

    List<CreditNote> findByInvoiceIdOrderByIssuedAtAsc(String invoiceId);

    /** Soma de todas as notas de crédito já emitidas para esta fatura — o saldo por creditar é `amount - isto`. */
    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM CreditNote c WHERE c.invoiceId = :invoiceId")
    BigDecimal totalCreditado(@Param("invoiceId") String invoiceId);

    @Query("SELECT c FROM CreditNote c JOIN FETCH c.invoice i JOIN FETCH i.purchaseOrder WHERE c.id = :id")
    Optional<CreditNote> findByIdComFatura(@Param("id") String id);
}
