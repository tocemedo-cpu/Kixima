package ao.kixima.support.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SupportTicketDto(String id, String reference, String userId, String companyId, String subject,
                                String category, String message, String status, String assignedToId,
                                Instant createdAt, Instant updatedAt, String statusLabel,
                                SupportTicketDto.UserRef user, String company) {

    public record UserRef(String name, String email) {
    }

    public static SupportTicketDto semExtras(ao.kixima.support.SupportTicket t) {
        return new SupportTicketDto(t.getId(), t.getReference(), t.getUserId(), t.getCompanyId(), t.getSubject(),
                t.getCategory(), t.getMessage(), t.getStatus().name(), t.getAssignedToId(), t.getCreatedAt(),
                t.getUpdatedAt(), null, null, null);
    }

    public SupportTicketDto comStatusLabel(String label) {
        return new SupportTicketDto(id, reference, userId, companyId, subject, category, message, status,
                assignedToId, createdAt, updatedAt, label, user, company);
    }

    public SupportTicketDto comUserECompany(UserRef user, String company) {
        return new SupportTicketDto(id, reference, userId, companyId, subject, category, message, status,
                assignedToId, createdAt, updatedAt, statusLabel, user, company);
    }
}
