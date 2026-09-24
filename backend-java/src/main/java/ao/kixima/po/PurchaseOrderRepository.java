package ao.kixima.po;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, String>, JpaSpecificationExecutor<PurchaseOrder> {

    /** Espelha `OR: [{ buyerCompanyId: companyId }, { supplierCompanyId: companyId }]` — feedbackService.opcoes. */
    @Query("SELECT po FROM PurchaseOrder po JOIN FETCH po.buyerCompany JOIN FETCH po.supplierCompany "
            + "WHERE po.buyerCompanyId = :companyId OR po.supplierCompanyId = :companyId ORDER BY po.createdAt DESC")
    List<PurchaseOrder> findByCompanyIdOrderByCreatedAtDesc(@Param("companyId") String companyId, Pageable pageable);

    /** Confirma que a empresa participou de alguma PO com a contraparte indicada — feedbackService.resolverAlvo(FORNECEDOR). */
    @Query("SELECT po FROM PurchaseOrder po JOIN FETCH po.buyerCompany JOIN FETCH po.supplierCompany "
            + "WHERE (po.buyerCompanyId = :companyId AND po.supplierCompanyId = :contraparteId) "
            + "OR (po.supplierCompanyId = :companyId AND po.buyerCompanyId = :contraparteId)")
    List<PurchaseOrder> findEntreEmpresas(@Param("companyId") String companyId, @Param("contraparteId") String contraparteId, Pageable pageable);

    /** Call-offs de um contrato ainda por faturar (consolidateContractBilling). */
    List<PurchaseOrder> findByContractIdAndIsCallOffTrueAndStatusInAndConsolidatedInvoiceIdIsNull(String contractId, Collection<PoStatus> statuses);

    /** `include: { callOffs: { orderBy: { createdAt: 'desc' } } }` de getContract. */
    List<PurchaseOrder> findByContractIdOrderByCreatedAtDesc(String contractId);
}
