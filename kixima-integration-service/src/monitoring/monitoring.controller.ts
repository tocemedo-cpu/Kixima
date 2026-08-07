import { Controller, Get, Header, Param, Post, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventStatus } from '@prisma/client';
import { PrismaService } from '@app/common/prisma/prisma.service';
import { AdminTokenGuard } from '@app/credentials/admin-token.guard';
import { MetricsService } from './metrics.service';
import { QUEUES } from '@app/common/constants';

/**
 * Painel de monitorização (API JSON) + healthcheck + métricas Prometheus.
 * Os endpoints de dados/replay/métricas exigem o token de administração
 * (AdminTokenGuard); só o /health é público.
 */
@Controller()
export class MonitoringController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    @InjectQueue(QUEUES.SYNC) private readonly syncQueue: Queue,
  ) {}

  @Get('health')
  health(): Record<string, unknown> {
    // Público (health check do Render). Sem detalhes internos: a contagem de
    // adaptadores/tenants por ERP está no /monitoring/overview (autenticado).
    return { status: 'ok', service: 'kixima-integration-service' };
  }

  @Get('monitoring/overview')
  @UseGuards(AdminTokenGuard)
  async overview(): Promise<Record<string, unknown>> {
    const [byStatus, deadLetters, pendingWebhooks, waiting, active, failed] = await Promise.all([
      this.prisma.integrationEvent.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.deadLetter.count({ where: { replayed: false } }),
      this.prisma.webhookDelivery.count({ where: { status: 'PENDING' } }),
      this.syncQueue.getWaitingCount(),
      this.syncQueue.getActiveCount(),
      this.syncQueue.getFailedCount(),
    ]);

    const events: Record<string, number> = {};
    for (const row of byStatus) events[row.status] = row._count._all;

    return {
      events: {
        received: events[EventStatus.RECEIVED] ?? 0,
        processing: events[EventStatus.PROCESSING] ?? 0,
        completed: events[EventStatus.COMPLETED] ?? 0,
        failed: events[EventStatus.FAILED] ?? 0,
        deadLetter: events[EventStatus.DEAD_LETTER] ?? 0,
        duplicate: events[EventStatus.DUPLICATE] ?? 0,
      },
      deadLetters,
      pendingWebhooks,
      queue: { waiting, active, failed },
    };
  }

  @Get('monitoring/dead-letters')
  @UseGuards(AdminTokenGuard)
  async listDeadLetters(): Promise<unknown> {
    return this.prisma.deadLetter.findMany({
      where: { replayed: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Post('monitoring/dead-letters/:id/replay')
  @UseGuards(AdminTokenGuard)
  async replay(@Param('id') id: string): Promise<{ replayed: boolean }> {
    const dl = await this.prisma.deadLetter.findUnique({ where: { id } });
    if (!dl) return { replayed: false };
    const event = await this.prisma.integrationEvent.findUnique({ where: { eventId: dl.eventId } });
    if (event) {
      await this.prisma.integrationEvent.update({
        where: { id: event.id },
        data: { status: EventStatus.RECEIVED, lastError: null },
      });
      await this.syncQueue.add('sync-erp', { integrationEventId: event.id }, { attempts: 5 });
    }
    await this.prisma.deadLetter.update({ where: { id }, data: { replayed: true } });
    return { replayed: true };
  }

  @Get('metrics')
  @UseGuards(AdminTokenGuard)
  @Header('Content-Type', 'text/plain')
  metricsEndpoint(): Promise<string> {
    return this.metrics.render();
  }
}
