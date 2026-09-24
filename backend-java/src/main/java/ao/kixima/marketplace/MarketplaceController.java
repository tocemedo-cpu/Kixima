package ao.kixima.marketplace;

import ao.kixima.common.error.ValidationException;
import ao.kixima.marketplace.dto.AddFavoriteRequest;
import ao.kixima.marketplace.dto.FavoriteResultDto;
import ao.kixima.marketplace.dto.SaveSearchRequest;
import ao.kixima.marketplace.dto.SavedSearchDto;
import ao.kixima.security.CurrentUserHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.CREATED;

/**
 * Espelha o troço `/favorites` e `/saved-searches` de
 * backend/src/routes/marketplaceRoutes.js.
 *
 * NÃO PORTADO (fora do âmbito deste lote do plano — nomes literais
 * "favoritos"/"pesquisas guardadas"/"convites"/... — M5 lote 2):
 * {@code GET /search}, {@code /compare}, {@code /facets}, {@code /suppliers}
 * (marketplaceService.js) — dependem de {@code planService.hasFeature}
 * (ainda não portado) e da coluna `searchText` mantida por trigger na base;
 * a pesquisa/comparação de fornecedores fica para quando `planService`
 * entrar.
 */
@RestController
@RequestMapping("/api/marketplace")
public class MarketplaceController {

    private final FavoriteService favoriteService;
    private final SavedSearchService savedSearchService;

    public MarketplaceController(FavoriteService favoriteService, SavedSearchService savedSearchService) {
        this.favoriteService = favoriteService;
        this.savedSearchService = savedSearchService;
    }

    @GetMapping("/favorites")
    public List<String> listarFavoritos() {
        return favoriteService.listIds(CurrentUserHolder.get().id());
    }

    @PostMapping("/favorites")
    @ResponseStatus(CREATED)
    public FavoriteResultDto adicionarFavorito(@RequestBody AddFavoriteRequest body) {
        if (body.productId() == null || body.productId().isBlank()) {
            throw new ValidationException("Favorito inválido.");
        }
        return favoriteService.add(CurrentUserHolder.get().id(), body.productId());
    }

    @DeleteMapping("/favorites/{productId}")
    public FavoriteResultDto removerFavorito(@PathVariable String productId) {
        return favoriteService.remove(CurrentUserHolder.get().id(), productId);
    }

    @GetMapping("/saved-searches")
    public List<SavedSearchDto> listarPesquisasGuardadas() {
        return savedSearchService.listar(CurrentUserHolder.get().id());
    }

    @PostMapping("/saved-searches")
    @ResponseStatus(CREATED)
    public SavedSearchDto guardarPesquisa(@RequestBody(required = false) SaveSearchRequest body) {
        String label = body == null ? null : body.label();
        String query = body == null ? null : body.query();
        return savedSearchService.criar(CurrentUserHolder.get().id(), label, query);
    }

    @DeleteMapping("/saved-searches/{id}")
    public Map<String, String> removerPesquisaGuardada(@PathVariable String id) {
        savedSearchService.remover(CurrentUserHolder.get().id(), id);
        return Map.of("id", id);
    }
}
