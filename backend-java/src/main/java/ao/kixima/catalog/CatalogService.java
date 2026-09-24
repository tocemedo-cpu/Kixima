package ao.kixima.catalog;

import ao.kixima.catalog.dto.CompanyDocumentDto;
import ao.kixima.catalog.dto.ProductDocumentDto;
import ao.kixima.catalog.dto.ProductDto;
import ao.kixima.catalog.dto.ProductImageDto;
import ao.kixima.catalog.dto.StockMovementDto;
import ao.kixima.catalog.dto.StockMovementListItemDto;
import ao.kixima.catalog.dto.SupplierDocumentDto;
import ao.kixima.catalog.dto.SupplierDocumentsResponse;
import ao.kixima.catalog.dto.UpdateStockRequest;
import ao.kixima.common.error.ForbiddenException;
import ao.kixima.common.error.NotFoundException;
import ao.kixima.common.pagination.PaginaResposta;
import ao.kixima.common.pagination.Paginacao;
import ao.kixima.company.Company;
import ao.kixima.company.CompanyDocument;
import ao.kixima.company.CompanyDocumentRepository;
import ao.kixima.notification.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Espelha backend/src/services/catalogService.js. M2: listCatalog,
 * getProduct, getProductBySlug, incrementView (leitura). M5 lote 2d/2f:
 * listSupplierDocuments, updateStock/createStockMovement/listStockMovements
 * ("documentos"/"stock" do plano). NÃO PORTADO: createProduct,
 * updateProduct, media (mainImage/gallery/documentos), deactivateProduct —
 * escrita de catálogo em si, não nomeada em nenhum item do plano, fica
 * para um marco de catálogo por escrever próprio.
 */
@Service
public class CatalogService {

    private static final Logger log = LoggerFactory.getLogger(CatalogService.class);

    private final ProductRepository productRepository;
    private final ProductDocumentRepository productDocumentRepository;
    private final CompanyDocumentRepository companyDocumentRepository;
    private final StockMovementRepository stockMovementRepository;
    private final NotificationService notificationService;
    private final int tectoPorOmissao;

    public CatalogService(ProductRepository productRepository, ProductDocumentRepository productDocumentRepository,
                           CompanyDocumentRepository companyDocumentRepository, StockMovementRepository stockMovementRepository,
                           NotificationService notificationService,
                           @Value("${kixima.db.max-rows:1000}") int tectoPorOmissao) {
        this.productRepository = productRepository;
        this.productDocumentRepository = productDocumentRepository;
        this.companyDocumentRepository = companyDocumentRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.notificationService = notificationService;
        this.tectoPorOmissao = tectoPorOmissao;
    }

    public record Filtros(String category, String search, String supplierId, String excludeSupplierId, String kind) {
    }

    /**
     * `Pageable.ofSize(tectoPorOmissao)` aqui NÃO é paginação de resposta —
     * o Node também não pagina esta lista. É o equivalente ao tecto de
     * segurança de config/database.js: um limite alto que nunca deveria ser
     * atingido em uso normal; se for, fica registado em log (TODO: reportar
     * a Sentry tal como o Node, quando essa dependência entrar).
     */
    @Transactional(readOnly = true)
    public List<ProductDto> listCatalog(Filtros filtros) {
        ProductKind kind = "PRODUTO".equals(filtros.kind()) || "SERVICO".equals(filtros.kind())
                ? ProductKind.valueOf(filtros.kind()) : null;
        Pageable tecto = PageRequest.of(0, tectoPorOmissao, Sort.by(Sort.Direction.DESC, "createdAt"));
        List<Product> produtos = productRepository.findAll(
                ProductSpecifications.comFiltros(filtros.category(), kind, filtros.supplierId(),
                        filtros.excludeSupplierId(), filtros.search()),
                tecto).getContent();
        if (produtos.size() == tectoPorOmissao) {
            log.error("Leitura de Product atingiu o tecto de {} linhas e foi truncada. "
                    + "Qualquer total calculado a partir daqui está ERRADO.", tectoPorOmissao);
        }
        return produtos.stream().map(p -> toDto(p, supplierListView(p.getSupplier()), false)).toList();
    }

    @Transactional(readOnly = true)
    public ProductDto getProduct(String id) {
        Product product = productRepository.findById(id).orElseThrow(() -> new NotFoundException("Produto"));
        return toDto(product, supplierMinView(product.getSupplier()), true);
    }

    @Transactional(readOnly = true)
    public ProductDto getProductBySlug(String slug) {
        Product product = productRepository.findBySlug(slug).orElseThrow(() -> new NotFoundException("Produto"));
        return toDto(product, supplierSlugView(product.getSupplier()), true);
    }

    /**
     * Espelha catalogService.listSupplierDocuments — documentos técnicos
     * de todos os produtos do fornecedor (ficha técnica, certificado,
     * catálogo, ...) + os documentos de credenciamento da própria empresa
     * (Alvará, Licença ANPG, Certidão Comercial), para o módulo de
     * Documentação.
     */
    @Transactional(readOnly = true)
    public SupplierDocumentsResponse listSupplierDocuments(String supplierCompanyId) {
        List<SupplierDocumentDto> productDocs = productDocumentRepository.findBySupplierIdOrderByCreatedAtDesc(supplierCompanyId)
                .stream()
                .map(d -> new SupplierDocumentDto(d.getId(), d.getType().name(), d.getFileUrl(), d.getOriginalName(),
                        d.getCreatedAt(), d.getProductId(), d.getProduct() == null || d.getProduct().getName() == null
                        ? "—" : d.getProduct().getName()))
                .toList();
        List<CompanyDocumentDto> companyDocs = companyDocumentRepository.findByCompanyIdOrderByTypeAsc(supplierCompanyId)
                .stream()
                .map(this::toDto)
                .toList();
        return new SupplierDocumentsResponse(productDocs, companyDocs);
    }

    private CompanyDocumentDto toDto(CompanyDocument d) {
        return new CompanyDocumentDto(d.getId(), d.getType().name(), d.getFileUrl(), d.getOriginalName(), d.getCreatedAt());
    }

    /**
     * Espelha catalogService.updateStock — só os campos de inventário.
     * Um campo ausente no pedido não altera o valor já guardado (ver
     * {@link UpdateStockRequest}).
     */
    @Transactional
    public ProductDto updateStock(String id, String supplierCompanyId, UpdateStockRequest body) {
        Product product = productRepository.findById(id).orElseThrow(() -> new NotFoundException("Produto"));
        if (!product.getSupplierId().equals(supplierCompanyId)) {
            throw new ForbiddenException("Só pode gerir o stock de itens da sua própria empresa.");
        }
        int stockAnterior = product.getStockQuantity() == null ? 0 : product.getStockQuantity();
        Integer minStockAnterior = product.getMinStock();

        if (body.stockQuantity() != null) product.setStockQuantity(body.stockQuantity());
        if (body.minStock() != null) product.setMinStock(body.minStock());
        if (body.warehouse() != null) product.setWarehouse(body.warehouse());
        if (body.availability() != null) product.setAvailability(body.availability());

        // Aviso de stock baixo só na TRANSIÇÃO — ver createStockMovement.
        boolean estavaAbaixo = minStockAnterior != null && stockAnterior <= minStockAnterior;
        boolean estaAbaixoAgora = product.getMinStock() != null
                && (product.getStockQuantity() == null ? 0 : product.getStockQuantity()) <= product.getMinStock();
        if (!estavaAbaixo && estaAbaixoAgora) {
            notificationService.estoqueBaixo(product.getSupplierId(), product.getId(), product.getName(),
                    product.getStockQuantity(), product.getMinStock());
        }
        return toDto(product, null, false);
    }

    /** Espelha catalogService.createStockMovement — regista a entrada/saída e ajusta o stock do produto. */
    @Transactional
    public StockMovementDto createStockMovement(String supplierCompanyId, String userId, String productId,
                                                 StockMovementType type, int quantity, String note) {
        Product product = productRepository.findById(productId).orElse(null);
        if (product == null || !product.getSupplierId().equals(supplierCompanyId)) {
            throw new NotFoundException("Produto");
        }
        int current = product.getStockQuantity() == null ? 0 : product.getStockQuantity();
        int delta = type == StockMovementType.ENTRADA ? quantity : -quantity;
        int next = Math.max(0, current + delta);
        product.setStockQuantity(next);

        StockMovement movement = new StockMovement(UUID.randomUUID().toString(), productId, type, quantity,
                note == null || note.isBlank() ? null : note, userId, Instant.now());
        stockMovementRepository.save(movement);

        // Aviso de stock baixo só na TRANSIÇÃO, para não repetir a cada movimento seguinte.
        if (product.getMinStock() != null && current > product.getMinStock() && next <= product.getMinStock()) {
            notificationService.estoqueBaixo(product.getSupplierId(), product.getId(), product.getName(), next, product.getMinStock());
        }
        return new StockMovementDto(movement.getId(), movement.getProductId(), movement.getType().name(),
                movement.getQuantity(), movement.getNote(), movement.getCreatedById(), movement.getCreatedAt());
    }

    /** Espelha catalogService.listStockMovements — histórico paginado, o mais recente primeiro. */
    @Transactional(readOnly = true)
    public PaginaResposta<StockMovementListItemDto> listStockMovements(String supplierCompanyId, StockMovementType type,
                                                                         Integer page, Integer limit) {
        Pageable pageable = Paginacao.parametros(page, limit);
        Page<StockMovement> pagina = type != null
                ? stockMovementRepository.findByProduct_SupplierIdAndTypeOrderByCreatedAtDesc(supplierCompanyId, type, pageable)
                : stockMovementRepository.findByProduct_SupplierIdOrderByCreatedAtDesc(supplierCompanyId, pageable);
        return Paginacao.envelope(pagina.map(this::toDto));
    }

    private StockMovementListItemDto toDto(StockMovement m) {
        String nomeProduto = m.getProduct() == null ? null : m.getProduct().getName();
        return new StockMovementListItemDto(m.getId(), m.getType().name(), m.getQuantity(), m.getNote(),
                m.getCreatedAt(), m.getProductId(), new StockMovementListItemDto.ProductNameRef(nomeProduto));
    }

    /** Best-effort, tal como incrementView() no Node — nunca bloqueia a resposta do chamador. */
    @Transactional
    public void incrementView(String productId) {
        try {
            productRepository.incrementViewCount(productId);
        } catch (Exception e) {
            log.debug("incrementView: produto inexistente ou falha best-effort ({})", productId);
        }
    }

    private Map<String, Object> supplierListView(Company c) {
        if (c == null) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("name", c.getName());
        m.put("status", c.getStatus());
        m.put("verified", c.isVerified());
        m.put("logoUrl", c.getLogoUrl());
        m.put("city", c.getCity());
        m.put("country", c.getCountry());
        return m;
    }

    private Map<String, Object> supplierMinView(Company c) {
        if (c == null) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("name", c.getName());
        m.put("status", c.getStatus());
        return m;
    }

    private Map<String, Object> supplierSlugView(Company c) {
        if (c == null) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("name", c.getName());
        m.put("status", c.getStatus());
        m.put("verified", c.isVerified());
        m.put("logoUrl", c.getLogoUrl());
        return m;
    }

    private ProductDto toDto(Product p, Map<String, Object> supplier, boolean incluirMedia) {
        return new ProductDto(
                p.getId(), p.getSupplierId(), supplier,
                p.getName(), p.getSku(), p.getManufacturerCode(), p.getCategory(), p.getSubcategory(),
                p.getBrand(), p.getManufacturer(), p.getModel(), p.getCountryOfOrigin(),
                p.getDescription(), p.getFullDescription(), p.getApplications(), p.getBenefits(), p.getKeywords(),
                p.getUnspscCode(), p.getUnspscTitle(), p.getUnspscSegment(), p.getUnspscFamily(), p.getUnspscClass(),
                p.getKeySpec(), p.getStandard(), p.getWarranty(), p.getIncoterm(), p.getSupplierNotes(),
                p.getMaterial(), p.getWeight(), p.getHeight(), p.getWidth(), p.getLength(),
                p.getPressure(), p.getTemperature(), p.getPower(), p.getVoltage(), p.getMeasurementUnit(),
                p.getUnitPrice(), p.getPromoPrice(), p.getCurrency(), p.getMinQuantity(), p.getMaxQuantity(),
                p.getStockQuantity(), p.getWarehouse(), p.getLeadTimeDays(), p.getAvailability(), p.getMinStock(),
                p.getSlug(), p.getKind().name(), p.getSpecialty(), p.getCity(), p.getProvince(), p.getCountry(),
                p.getCertifications(), p.getTags(), p.isActive(),
                p.getRating(), p.getReviewCount(), p.getViewCount(), p.getImageUrl(),
                p.getCreatedAt(), p.getUpdatedAt(),
                incluirMedia ? p.getImages().stream().map(i -> new ProductImageDto(i.getId(), i.getUrl(), i.isPrimary(), i.getSortOrder())).toList() : null,
                incluirMedia ? p.getDocuments().stream().map(d -> new ProductDocumentDto(d.getId(), d.getType().name(), d.getFileUrl(), d.getOriginalName())).toList() : null
        );
    }
}
