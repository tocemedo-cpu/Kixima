import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';

/**
 * Bootstrap do OpenTelemetry (traços distribuídos). Deve ser iniciado o mais
 * cedo possível — idealmente pré-carregado com `node -r ./dist/monitoring/tracing`
 * para instrumentar HTTP/AMQP/Prisma antes do uso.
 */
let sdk: NodeSDK | undefined;

export function startTracing(): void {
  if ((process.env.OTEL_ENABLED ?? 'false') !== 'true') return;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';
  sdk = new NodeSDK({
    resource: new Resource({
      'service.name': process.env.OTEL_SERVICE_NAME ?? 'kixima-integration-service',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
}

export async function stopTracing(): Promise<void> {
  await sdk?.shutdown();
}
