package ao.kixima.conversation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ConversationDto(String id, String buyerCompanyId, String supplierCompanyId, String contextType,
                               String contextId, String status, String createdById, Instant createdAt, Instant updatedAt,
                               CounterpartDto counterpart, ConversationMessageDto lastMessage) {

    public record CounterpartDto(String id, String name, String logoUrl) {
    }

    public static ConversationDto semExtras(ao.kixima.conversation.Conversation c) {
        return new ConversationDto(c.getId(), c.getBuyerCompanyId(), c.getSupplierCompanyId(), c.getContextType(),
                c.getContextId(), c.getStatus().name(), c.getCreatedById(), c.getCreatedAt(), c.getUpdatedAt(), null, null);
    }

    public ConversationDto comResumo(CounterpartDto counterpart, ConversationMessageDto lastMessage) {
        return new ConversationDto(id, buyerCompanyId, supplierCompanyId, contextType, contextId, status, createdById,
                createdAt, updatedAt, counterpart, lastMessage);
    }
}
