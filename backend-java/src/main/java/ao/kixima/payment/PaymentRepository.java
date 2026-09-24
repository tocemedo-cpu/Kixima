package ao.kixima.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, String> {

    Optional<Payment> findByInvoiceId(String invoiceId);

    List<Payment> findByInvoiceIdIn(java.util.Collection<String> invoiceIds);

    /** Espelha paymentService.listPaymentHistory — só o ramo da PO (o de Contract fica por portar). */
    @Query("SELECT p FROM Payment p JOIN FETCH p.invoice i JOIN FETCH i.purchaseOrder po "
            + "WHERE po.buyerCompanyId = :buyerCompanyId ORDER BY p.processedAt DESC")
    List<Payment> findHistoricoDoComprador(@Param("buyerCompanyId") String buyerCompanyId);

    @Query("SELECT p FROM Payment p JOIN FETCH p.invoice i JOIN FETCH i.purchaseOrder WHERE p.id = :id")
    Optional<Payment> findByIdComFatura(@Param("id") String id);
}
