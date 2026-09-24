package ao.kixima.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, String> {

    /** Espelha `where: { OR: [{ userId }, { companyId }] }` em notificationController.list(). */
    Page<Notification> findByUserIdOrCompanyId(String userId, String companyId, Pageable pageable);

    @Query("SELECT COUNT(n) FROM Notification n WHERE n.readAt IS NULL AND (n.userId = :userId OR n.companyId = :companyId)")
    long contarPorLer(@Param("userId") String userId, @Param("companyId") String companyId);
}
