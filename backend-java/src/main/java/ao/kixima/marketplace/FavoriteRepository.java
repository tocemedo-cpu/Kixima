package ao.kixima.marketplace;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FavoriteRepository extends JpaRepository<Favorite, String> {

    List<Favorite> findByUserId(String userId);

    Optional<Favorite> findByUserIdAndProductId(String userId, String productId);

    void deleteByUserIdAndProductId(String userId, String productId);
}
