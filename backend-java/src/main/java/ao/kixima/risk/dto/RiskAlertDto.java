package ao.kixima.risk.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RiskAlertDto(String id, String conversationId, String messageId, String level, String reason,
                            JsonNode signals, JsonNode context, String status, String reviewedById, Instant reviewedAt,
                            String decision, Instant createdAt, ConversationRef conversation) {

    public record ConversationRef(String id, String buyerCompanyId, String supplierCompanyId,
                                   String buyerCompany, String supplierCompany) {
    }
}
