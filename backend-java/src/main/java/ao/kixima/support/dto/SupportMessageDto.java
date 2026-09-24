package ao.kixima.support.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SupportMessageDto(String id, String ticketId, String authorId, String authorRole, String body,
                                 String attachmentUrl, String attachmentName, Instant readAt, Instant createdAt) {

    public static SupportMessageDto de(ao.kixima.support.SupportMessage m) {
        return new SupportMessageDto(m.getId(), m.getTicketId(), m.getAuthorId(), m.getAuthorRole().name(), m.getBody(),
                m.getAttachmentUrl(), m.getAttachmentName(), m.getReadAt(), m.getCreatedAt());
    }
}
