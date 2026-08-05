import { Injectable, Logger } from '@nestjs/common';
import { AuditLevel, ErpSystem, Prisma } from '@prisma/client';
import { PrismaService } from '@app/common/prisma/prisma.service';

export interface AuditEntry {
  integrationEventId?: string;
  action: string;
  erp?: ErpSystem;
  level?: AuditLevel;
  message: string;
  actor?: string;
  metadata?: unknown;
  traceId?: string;
}

/**
 * Trilho de auditoria persistente — grava cada passo relevante da integração.
 * Nunca lança: uma falha de auditoria não pode derrubar o fluxo principal.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          integrationEventId: entry.integrationEventId ?? null,
          action: entry.action,
          erp: entry.erp ?? null,
          level: entry.level ?? AuditLevel.INFO,
          message: entry.message,
          actor: entry.actor ?? 'system',
          metadata:
            entry.metadata === undefined || entry.metadata === null
              ? Prisma.JsonNull
              : (entry.metadata as Prisma.InputJsonValue),
          traceId: entry.traceId ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`Falha ao gravar auditoria (${entry.action}): ${(err as Error).message}`);
    }
  }

  info(action: string, message: string, extra: Partial<AuditEntry> = {}): Promise<void> {
    return this.record({ ...extra, action, message, level: AuditLevel.INFO });
  }

  warn(action: string, message: string, extra: Partial<AuditEntry> = {}): Promise<void> {
    return this.record({ ...extra, action, message, level: AuditLevel.WARN });
  }

  error(action: string, message: string, extra: Partial<AuditEntry> = {}): Promise<void> {
    return this.record({ ...extra, action, message, level: AuditLevel.ERROR });
  }
}
