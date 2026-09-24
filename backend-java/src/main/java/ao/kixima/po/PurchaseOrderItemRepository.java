package ao.kixima.po;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PurchaseOrderItemRepository extends JpaRepository<PurchaseOrderItem, String> {
    List<PurchaseOrderItem> findByPurchaseOrderIdOrderByIdAsc(String purchaseOrderId);
}
