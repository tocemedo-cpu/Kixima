package ao.kixima.catalog;

import ao.kixima.catalog.dto.ProductDto;
import ao.kixima.security.CurrentUser;
import ao.kixima.security.CurrentUserHolder;
import ao.kixima.security.PersonaRole;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Espelha backend/src/controllers/catalogController.js + o troço de leitura
 * de backend/src/routes/catalogRoutes.js. Toda a rota `/api/catalog/**`
 * exige sessão (`router.use(authenticate)` no Node — confirmado por leitura
 * directa, não é pública apesar de não ter `requireRole`), o que já é o
 * comportamento por omissão de {@link ao.kixima.security.PublicPaths}.
 */
@RestController
@RequestMapping("/api/catalog")
public class CatalogController {

    private final CatalogService catalogService;

    public CatalogController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping
    public List<ProductDto> list(@RequestParam(required = false) String category,
                                  @RequestParam(required = false) String search,
                                  @RequestParam(required = false) String supplierId,
                                  @RequestParam(required = false) String kind) {
        CurrentUser user = CurrentUserHolder.get();
        // Um comprador não vê (nem compra) produtos da própria empresa.
        String excludeSupplierId = user.role() == PersonaRole.COMPRADOR ? user.companyId() : null;
        return catalogService.listCatalog(new CatalogService.Filtros(category, search, supplierId, excludeSupplierId, kind));
    }

    @GetMapping("/slug/{slug}")
    public ProductDto getBySlug(@PathVariable String slug) {
        ProductDto product = catalogService.getProductBySlug(slug);
        contarVisualizacaoSeAplicavel(product);
        return product;
    }

    @GetMapping("/{id}")
    public ProductDto getOne(@PathVariable String id) {
        ProductDto product = catalogService.getProduct(id);
        contarVisualizacaoSeAplicavel(product);
        return product;
    }

    /** Conta a visualização quando é um comprador a ver (não o próprio fornecedor) — best-effort, tal como o Node. */
    private void contarVisualizacaoSeAplicavel(ProductDto product) {
        CurrentUser user = CurrentUserHolder.get();
        if (user.role() == PersonaRole.COMPRADOR && !product.supplierId().equals(user.companyId())) {
            catalogService.incrementView(product.id());
        }
    }
}
