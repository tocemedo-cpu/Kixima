package ao.kixima.erp.dto;

import ao.kixima.erp.ErpField;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Espelha o retorno de erpConfigService.getConfig/setConfig. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErpConfigDto(CompanyRefDto company, String erp, List<String> systems,
                            Map<String, List<ErpField>> fields, Map<String, String> config,
                            LastTestDto lastTest, Instant updatedAt, Boolean integrationSynced) {
}
