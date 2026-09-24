package ao.kixima.catalog;

import ao.kixima.apikey.ApiKeyService;
import ao.kixima.apikey.dto.ApiKeyCreatedDto;
import ao.kixima.apikey.dto.ApiKeyDto;
import ao.kixima.apikey.dto.CreateApiKeyRequest;
import ao.kixima.apikey.dto.RevokedApiKeyDto;
import ao.kixima.audit.Actor;
import ao.kixima.audit.AuditService;
import ao.kixima.catalog.dto.AddReviewRequest;
import ao.kixima.catalog.dto.ProductDto;
import ao.kixima.catalog.dto.ReviewDto;
import ao.kixima.catalog.dto.ReviewSummaryDto;
import ao.kixima.catalog.dto.SupplierDocumentsResponse;
import ao.kixima.common.error.NotFoundException;
import ao.kixima.common.error.ValidationException;
import ao.kixima.company.Company;
import ao.kixima.company.CompanyRepository;
import ao.kixima.security.CurrentUser;
import ao.kixima.security.CurrentUserHolder;
import ao.kixima.security.PersonaRole;
import ao.kixima.security.RequireRole;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

import static ao.kixima.security.PersonaRole.COMPANY_ADMIN;
import static ao.kixima.security.PersonaRole.COMPRADOR;
import static ao.kixima.security.PersonaRole.FORNECEDOR;
import static org.springframework.http.HttpStatus.CREATED;

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
    private final ReviewService reviewService;
    private final ApiKeyService apiKeyService;
    private final CompanyRepository companyRepository;
    private final AuditService auditService;

    public CatalogController(CatalogService catalogService, ReviewService reviewService, ApiKeyService apiKeyService,
                              CompanyRepository companyRepository, AuditService auditService) {
        this.catalogService = catalogService;
        this.reviewService = reviewService;
        this.apiKeyService = apiKeyService;
        this.companyRepository = companyRepository;
        this.auditService = auditService;
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

    /** Módulo de Documentação do fornecedor — documentos técnicos dos produtos + de credenciamento da empresa. */
    @GetMapping("/documents")
    @RequireRole({FORNECEDOR, COMPANY_ADMIN})
    public SupplierDocumentsResponse documentosDoFornecedor() {
        return catalogService.listSupplierDocuments(CurrentUserHolder.get().companyId());
    }

    // --- Chaves da API de catálogo (plano Pro) -----------------------------
    // Ficam aqui, ao lado do catálogo, tal como no Node: não é "uma chave da
    // KIXIMA", é uma chave do meu catálogo.

    @GetMapping("/api-keys")
    @RequireRole({FORNECEDOR, COMPANY_ADMIN})
    public List<ApiKeyDto> listarChavesApi() {
        return apiKeyService.listar(CurrentUserHolder.get().companyId());
    }

    @PostMapping("/api-keys")
    @ResponseStatus(CREATED)
    @RequireRole({FORNECEDOR, COMPANY_ADMIN})
    public ApiKeyCreatedDto criarChaveApi(@RequestBody CreateApiKeyRequest body, HttpServletRequest req) {
        CurrentUser user = CurrentUserHolder.get();
        Company empresa = companyRepository.findById(user.companyId()).orElseThrow(() -> new NotFoundException("Empresa"));
        ApiKeyCreatedDto criada = apiKeyService.criar(empresa, body == null ? null : body.nome(), user.id());
        Actor actor = auditService.actorFrom(user, req);
        auditService.recordSafe(new AuditService.Entry(actor, "CHAVE_API_CRIADA", "ApiKey", criada.id(),
                criada.prefixo(), Map.of("nome", criada.nome())));
        return criada;
    }

    @DeleteMapping("/api-keys/{id}")
    @RequireRole({FORNECEDOR, COMPANY_ADMIN})
    public RevokedApiKeyDto revogarChaveApi(@PathVariable String id, HttpServletRequest req) {
        CurrentUser user = CurrentUserHolder.get();
        RevokedApiKeyDto r = apiKeyService.revogar(user.companyId(), id);
        Actor actor = auditService.actorFrom(user, req);
        auditService.recordSafe(new AuditService.Entry(actor, "CHAVE_API_REVOGADA", "ApiKey", id, null, null));
        return r;
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

    @GetMapping("/{id}/reviews")
    public List<ReviewDto> listReviews(@PathVariable String id) {
        return reviewService.listForProduct(id);
    }

    @PostMapping("/{id}/reviews")
    @ResponseStatus(CREATED)
    @RequireRole({COMPRADOR})
    public ReviewSummaryDto addReview(@PathVariable String id, @RequestBody AddReviewRequest body) {
        if (body.rating() == null || body.rating() < 1 || body.rating() > 5) {
            throw new ValidationException("A avaliação deve ser um número inteiro entre 1 e 5.");
        }
        if (body.comment() != null && body.comment().length() > 1000) {
            throw new ValidationException("O comentário não pode exceder 1000 caracteres.");
        }
        return reviewService.addReview(id, CurrentUserHolder.get().id(), body.rating(), body.comment());
    }
}
