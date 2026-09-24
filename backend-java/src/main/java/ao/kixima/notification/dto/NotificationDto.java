package ao.kixima.notification.dto;

import java.time.Instant;

public record NotificationDto(String id, String userId, String companyId, String type, String channel,
                               String title, String message, Instant readAt, String relatedEntityType,
                               String relatedEntityId, Instant createdAt) {
}
