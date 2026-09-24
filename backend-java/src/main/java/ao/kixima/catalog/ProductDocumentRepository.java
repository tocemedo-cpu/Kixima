package ao.kixima.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductDocumentRepository extends JpaRepository<ProductDocument, String> {
    boolean existsByFileUrl(String fileUrl);
}
