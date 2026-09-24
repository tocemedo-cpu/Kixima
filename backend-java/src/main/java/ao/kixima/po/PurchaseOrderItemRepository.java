package ao.kixima.po;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PurchaseOrderItemRepository extends JpaRepository<PurchaseOrderItem, String> {
    List<PurchaseOrderItem> findByPurchaseOrderIdOrderByIdAsc(String purchaseOrderId);

    /** Confirma que a empresa comprou/vendeu este produto — feedbackService.resolverAlvo(PRODUTO/SERVICO). */
    @Query("SELECT i FROM PurchaseOrderItem i JOIN FETCH i.product p JOIN i.purchaseOrder po "
            + "WHERE i.productId = :productId AND (po.buyerCompanyId = :companyId OR po.supplierCompanyId = :companyId)")
    List<PurchaseOrderItem> findByProductIdEComEmpresa(@Param("productId") String productId, @Param("companyId") String companyId, Pageable pageable);
}
