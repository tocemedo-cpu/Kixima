package ao.kixima.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * {@link JpaSpecificationExecutor} em vez de um JPQL com `(:param IS NULL OR
 * ...)` para cada filtro opcional — esse padrão, quando um parâmetro só
 * aparece do lado do `IS NULL` (filtro ausente), deixa o Postgres sem
 * contexto de tipo para o inferir ("could not determine data type of
 * parameter"), sobretudo com o enum nativo `kind`. Com Specifications
 * (ver {@link ProductSpecifications}), um filtro ausente simplesmente não
 * entra na query — mesmo efeito do spread condicional `...(x ? {x} : {})`
 * do Prisma em catalogService.js, sem o problema de tipo.
 */
public interface ProductRepository extends JpaRepository<Product, String>, JpaSpecificationExecutor<Product> {

    Optional<Product> findBySlug(String slug);

    /** Espelha incrementView() — best-effort, um único UPDATE em vez de ler+gravar a entidade inteira. */
    @Modifying
    @Query("UPDATE Product p SET p.viewCount = p.viewCount + 1 WHERE p.id = :id")
    void incrementViewCount(@Param("id") String id);
}
