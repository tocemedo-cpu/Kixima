import { Controller, Get, Header, Param, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventStatus } from '@prisma/client';
import { PrismaService } from '@app/common/prisma/prisma.service';
import { AdapterFactory } from '@app/adapters/adapter.factory';
import { CredentialsService } from '@app/credentials/credentials.service';
import { MetricsService } from './metrics.service';
import { QUEUES } from '@app/common/constants';

/**
 * Painel de monitorização (API JSON) + healthcheck + métricas Prometheus.
 * Consumível por um dashboard ou por Grafana/Prometheus.
 */
@Controller()
export class MonitoringController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: AdapterFactory,
    private readonly credentials: CredentialsService,
    private readonly metrics: MetricsService,
    @InjectQueue(QUEUES.SYNC) private readonly syncQueue: Queue,
  ) {}

  @Get('health')
  async health(): Promise<Record<string, unknown>> {
    const configured = await this.credentials.countByErp();
    const adapters = this.factory.supported().map((erp) => ({
      erp,
      tenantsEnabled: configured[erp] ?? 0, // nº de tenants com este ERP ativo
    }));
    return { status: 'ok', service: 'kixima-integration-service', multiTenant: true, adapters };
  }

  @Get('monitoring/overview')
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
  async listDeadLetters(): Promise<unknown> {
    return this.prisma.deadLetter.findMany({
      where: { replayed: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Post('monitoring/dead-letters/:id/replay')
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
  @Header('Content-Type', 'text/plain')
  metricsEndpoint(): Promise<string> {
    return this.metrics.render();
  }
}
