package ao.kixima.invoice;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InvoiceRepository extends JpaRepository<Invoice, String> {
    Optional<Invoice> findByReferenciaPagamento(String referenciaPagamento);

    /**
     * Espelha paymentService.listPendingInvoices — só o ramo `purchaseOrder.buyerCompanyId`.
     * LACUNA: o Node também devolve as faturas consolidadas de contrato (`contract.clientCompanyId`,
     * ver {@link #findDaEmpresaCompradora} para a forma dessa junção); aqui ainda não entram.
     */
    @org.springframework.data.jpa.repository.Query("SELECT i FROM Invoice i JOIN FETCH i.purchaseOrder po "
            + "WHERE i.status = :status AND po.buyerCompanyId = :buyerCompanyId ORDER BY i.dueAt ASC")
    java.util.List<Invoice> findPendentesDoComprador(@org.springframework.data.repository.query.Param("buyerCompanyId") String buyerCompanyId,
                                                      @org.springframework.data.repository.query.Param("status") InvoiceStatus status);

    /** `SELECT id FROM invoices WHERE id = ? FOR UPDATE` — bloqueia a fatura enquanto se recalcula o saldo por creditar. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT i FROM Invoice i WHERE i.id = :id")
    Optional<Invoice> findByIdParaAtualizar(@org.springframework.data.repository.query.Param("id") String id);

    /** A fatura individual de uma PO (null nas call-offs, cujas faturas são consolidadas). */
    Optional<Invoice> findByPurchaseOrderId(String purchaseOrderId);

    /** financeiroService.invoiceWhere — faturas da empresa compradora (via PO ou contrato), por vencimento. */
    @org.springframework.data.jpa.repository.Query("SELECT i FROM Invoice i LEFT JOIN PurchaseOrder po ON po.id = i.purchaseOrderId "
            + "LEFT JOIN ao.kixima.contract.Contract c ON c.id = i.contractId "
            + "WHERE po.buyerCompanyId = :companyId OR c.clientCompanyId = :companyId ORDER BY i.dueAt ASC")
    java.util.List<Invoice> findDaEmpresaCompradora(@org.springframework.data.repository.query.Param("companyId") String companyId);

    /** faturacaoService.verificarCadeia — a série inteira, pela ordem em que foi numerada. */
    java.util.List<Invoice> findBySerieAndNumeroNaSerieIsNotNullOrderByNumeroNaSerieAsc(String serie);

    /** saftService.gerar — faturas de UM fornecedor no período (ligadas por PO ou por contrato-quadro). */
    @org.springframework.data.jpa.repository.Query("SELECT i FROM Invoice i LEFT JOIN PurchaseOrder po ON po.id = i.purchaseOrderId "
            + "LEFT JOIN Contract c ON c.id = i.contractId WHERE i.issuedAt BETWEEN :ini AND :fim "
            + "AND (po.supplierCompanyId = :sid OR c.supplierCompanyId = :sid) "
            + "ORDER BY i.serie ASC, i.numeroNaSerie ASC, i.issuedAt ASC")
    java.util.List<Invoice> findDoFornecedorNoPeriodo(@org.springframework.data.repository.query.Param("sid") String supplierCompanyId,
                                                      @org.springframework.data.repository.query.Param("ini") java.time.Instant ini,
                                                      @org.springframework.data.repository.query.Param("fim") java.time.Instant fim);
}
