package ao.kixima.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, String> {

    Optional<Payment> findByInvoiceId(String invoiceId);

    List<Payment> findByInvoiceIdIn(java.util.Collection<String> invoiceIds);

    /**
     * Espelha paymentService.listPaymentHistory — só o ramo da PO. LACUNA: o Node também devolve os
     * pagamentos de faturas consolidadas de contrato (`invoice.contract.clientCompanyId`); aqui ainda não entram.
     */
    @Query("SELECT p FROM Payment p JOIN FETCH p.invoice i JOIN FETCH i.purchaseOrder po "
            + "WHERE po.buyerCompanyId = :buyerCompanyId ORDER BY p.processedAt DESC")
    List<Payment> findHistoricoDoComprador(@Param("buyerCompanyId") String buyerCompanyId);

    @Query("SELECT p FROM Payment p JOIN FETCH p.invoice i JOIN FETCH i.purchaseOrder WHERE p.id = :id")
    Optional<Payment> findByIdComFatura(@Param("id") String id);

    /** dadosPessoaisService.exportar — pagamentos autorizados pelo titular. */
    List<Payment> findByProcessedByIdOrderByProcessedAtDesc(String processedById);

    List<Payment> findTop10ByOrderByProcessedAtDesc();

    /** metricasService.tempoAteConfirmacao — pagamentos processados no período, com a fatura para a data de emissão. */
    @Query("SELECT p FROM Payment p LEFT JOIN FETCH p.invoice WHERE p.processedAt BETWEEN :de AND :ate AND p.status = :status")
    List<Payment> findProcessadosNoPeriodo(@Param("de") java.time.Instant de, @Param("ate") java.time.Instant ate,
                                          @Param("status") PaymentStatus status, org.springframework.data.domain.Pageable pageable);

    long countByProofUrlStartingWith(String prefixo);
}
