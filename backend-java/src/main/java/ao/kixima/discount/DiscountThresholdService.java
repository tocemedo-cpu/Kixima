package ao.kixima.discount;

import ao.kixima.audit.Actor;
import ao.kixima.audit.AuditService;
import ao.kixima.common.error.NotFoundException;
import ao.kixima.common.error.ValidationException;
import ao.kixima.discount.dto.CreateDiscountThresholdRequest;
import ao.kixima.discount.dto.DiscountThresholdDto;
import ao.kixima.discount.dto.UpdateDiscountThresholdRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Espelha backend/src/services/discountThresholdService.js — CRUD dos
 * patamares de desconto por economia de escala, gerido pelo Admin do
 * Sistema (área Financeiro).
 *
 * NÃO PORTADO: {@code proximoThreshold} (o patamar aplicável ao volume
 * atual de uma empresa) — só tem chamador em categoryManagementRoutes.js
 * `/analise`, que por sua vez depende de categoryAnalyticsService e
 * aiRecommendationService (nenhum dos dois portado; "Category Management"
 * não é um item nomeado do plano, só "descontos" — a gestão dos
 * patamares — é).
 */
@Service
public class DiscountThresholdService {

    private final DiscountThresholdRepository repository;
    private final AuditService auditService;

    public DiscountThresholdService(DiscountThresholdRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<DiscountThresholdDto> listar(boolean apenasAtivos) {
        List<DiscountThreshold> lista = apenasAtivos
                ? repository.findByAtivoTrueOrderByMinVolumeUsdAsc()
                : repository.findAllByOrderByMinVolumeUsdAsc();
        return lista.stream().map(this::toDto).toList();
    }

    @Transactional
    public DiscountThresholdDto criar(CreateDiscountThresholdRequest body, Actor actor) {
        validarVolume(body.minVolumeUsd());
        validarPercentagem(body.discountPercent());
        boolean ativo = body.ativo() == null || body.ativo();

        DiscountThreshold threshold = new DiscountThreshold(UUID.randomUUID().toString(), body.minVolumeUsd(),
                body.discountPercent(), ativo, Instant.now());
        repository.save(threshold);

        auditService.recordSafe(new AuditService.Entry(actor, "DISCOUNT_THRESHOLD_CRIADO", "DiscountThreshold",
                threshold.getId(), null, Map.of("minVolumeUsd", threshold.getMinVolumeUsd().toString(),
                        "discountPercent", threshold.getDiscountPercent().toString(), "ativo", ativo)));
        return toDto(threshold);
    }

    @Transactional
    public DiscountThresholdDto atualizar(String id, UpdateDiscountThresholdRequest body, Actor actor) {
        DiscountThreshold existente = repository.findById(id).orElseThrow(() -> new NotFoundException("Patamar de desconto"));
        String minVolumeAntes = existente.getMinVolumeUsd().toString();
        String percentAntes = existente.getDiscountPercent().toString();
        boolean ativoAntes = existente.isAtivo();

        if (body.minVolumeUsd() != null) {
            validarVolume(body.minVolumeUsd());
            existente.setMinVolumeUsd(body.minVolumeUsd());
        }
        if (body.discountPercent() != null) {
            validarPercentagem(body.discountPercent());
            existente.setDiscountPercent(body.discountPercent());
        }
        if (body.ativo() != null) existente.setAtivo(body.ativo());

        auditService.recordSafe(new AuditService.Entry(actor, "DISCOUNT_THRESHOLD_ATUALIZADO", "DiscountThreshold",
                existente.getId(), null, Map.of(
                        "antes", Map.of("minVolumeUsd", minVolumeAntes, "discountPercent", percentAntes, "ativo", ativoAntes),
                        "depois", Map.of("minVolumeUsd", existente.getMinVolumeUsd().toString(),
                                "discountPercent", existente.getDiscountPercent().toString(), "ativo", existente.isAtivo()))));
        return toDto(existente);
    }

    @Transactional
    public void remover(String id, Actor actor) {
        DiscountThreshold existente = repository.findById(id).orElseThrow(() -> new NotFoundException("Patamar de desconto"));
        String minVolume = existente.getMinVolumeUsd().toString();
        String percent = existente.getDiscountPercent().toString();
        repository.delete(existente);
        auditService.recordSafe(new AuditService.Entry(actor, "DISCOUNT_THRESHOLD_REMOVIDO", "DiscountThreshold", id,
                null, Map.of("minVolumeUsd", minVolume, "discountPercent", percent)));
    }

    private void validarVolume(BigDecimal minVolumeUsd) {
        if (minVolumeUsd == null || minVolumeUsd.signum() <= 0) {
            throw new ValidationException("minVolumeUsd tem de ser maior que zero.");
        }
    }

    private void validarPercentagem(BigDecimal discountPercent) {
        if (discountPercent == null || discountPercent.signum() <= 0 || discountPercent.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new ValidationException("discountPercent tem de estar entre 0 e 100.");
        }
    }

    private DiscountThresholdDto toDto(DiscountThreshold t) {
        return new DiscountThresholdDto(t.getId(), t.getMinVolumeUsd(), t.getDiscountPercent(), t.isAtivo(),
                t.getCreatedAt(), t.getUpdatedAt());
    }
}
