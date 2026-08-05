import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Métricas Prometheus do microserviço. Contadores incrementados ao longo do
 * pipeline e métricas por omissão do processo Node.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly eventsReceived = new Counter({
    name: 'kixima_int_events_received_total',
    help: 'Total de eventos recebidos do RabbitMQ',
    labelNames: ['event_type'] as const,
  });

  readonly syncTotal = new Counter({
    name: 'kixima_int_sync_total',
    help: 'Total de sincronizações por ERP e estado',
    labelNames: ['erp', 'status'] as const,
  });

  readonly deadLetters = new Counter({
    name: 'kixima_int_dead_letters_total',
    help: 'Total de eventos movidos para Dead Letter',
  });

  onModuleInit(): void {
    this.registry.registerMetric(this.eventsReceived);
    this.registry.registerMetric(this.syncTotal);
    this.registry.registerMetric(this.deadLetters);
    collectDefaultMetrics({ register: this.registry, prefix: 'kixima_int_' });
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }
}
