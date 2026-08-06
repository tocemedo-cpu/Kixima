import { Injectable, Logger } from '@nestjs/common';
import { ErpSystem } from '@prisma/client';
import { PrismaService } from '@app/common/prisma/prisma.service';
import { CryptoService } from '@app/crypto/crypto.service';
import { AdapterFactory, ErpConnectionConfig } from '@app/adapters/adapter.factory';
import { ErpAdapter } from '@app/adapters/erp-adapter.interface';

export interface ResolvedAdapter {
  erp: ErpSystem;
  adapter: ErpAdapter;
}

export interface TenantCredentialView {
  erp: ErpSystem;
  enabled: boolean;
  updatedAt: Date;
  config: Record<string, string>; // mascarado
}

/** tenant especial: configuração global aplicada a todos os tenants. */
export const GLOBAL_TENANT = '*';

/**
 * Gestão multi-tenant das credenciais ERP. Guarda a config de cada ERP por
 * tenant, cifrada (AES-256-GCM), e resolve em runtime os adapters ativos para o
 * tenant de um evento (com fallback para a configuração global '*').
 */
@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly factory: AdapterFactory,
  ) {}

  async upsert(tenantId: string, erp: ErpSystem, enabled: boolean, config: ErpConnectionConfig): Promise<void> {
    const configEnc = this.crypto.encryptJson(config);
    await this.prisma.erpCredential.upsert({
      where: { tenantId_erp: { tenantId, erp } },
      create: { tenantId, erp, enabled, configEnc },
      update: { enabled, configEnc },
    });
    this.logger.log(`Credencial ${erp} guardada para tenant "${tenantId}" (enabled=${enabled})`);
  }

  async setEnabled(tenantId: string, erp: ErpSystem, enabled: boolean): Promise<void> {
    await this.prisma.erpCredential.update({ where: { tenantId_erp: { tenantId, erp } }, data: { enabled } });
  }

  async remove(tenantId: string, erp: ErpSystem): Promise<void> {
    await this.prisma.erpCredential.deleteMany({ where: { tenantId, erp } });
  }

  async listForTenant(tenantId: string): Promise<TenantCredentialView[]> {
    const rows = await this.prisma.erpCredential.findMany({ where: { tenantId }, orderBy: { erp: 'asc' } });
    return rows.map((r) => ({
      erp: r.erp,
      enabled: r.enabled,
      updatedAt: r.updatedAt,
      config: this.mask(this.crypto.decryptJson<ErpConnectionConfig>(r.configEnc)),
    }));
  }

  /**
   * Adapters ativos para um tenant: a config própria do tenant tem prioridade
   * sobre a configuração global '*' (por ERP).
   */
  async resolveEnabledAdapters(tenantId: string | null): Promise<ResolvedAdapter[]> {
    const tenants = tenantId && tenantId !== GLOBAL_TENANT ? [tenantId, GLOBAL_TENANT] : [GLOBAL_TENANT];
    const rows = await this.prisma.erpCredential.findMany({ where: { tenantId: { in: tenants }, enabled: true } });

    const byErp = new Map<ErpSystem, (typeof rows)[number]>();
    for (const r of rows) {
      const prev = byErp.get(r.erp);
      if (!prev || (prev.tenantId === GLOBAL_TENANT && r.tenantId !== GLOBAL_TENANT)) byErp.set(r.erp, r);
    }

    const out: ResolvedAdapter[] = [];
    for (const r of byErp.values()) {
      try {
        const config = this.crypto.decryptJson<ErpConnectionConfig>(r.configEnc);
        out.push({ erp: r.erp, adapter: this.factory.create(r.erp, config) });
      } catch (err) {
        this.logger.error(`Config inválida (${r.erp}/${r.tenantId}): ${(err as Error).message}`);
      }
    }
    return out;
  }

  /** Testa a ligação ao ERP de um tenant usando a config guardada. */
  async testConnection(tenantId: string, erp: ErpSystem): Promise<{ ok: boolean; message: string }> {
    const row = await this.prisma.erpCredential.findUnique({ where: { tenantId_erp: { tenantId, erp } } });
    if (!row) return { ok: false, message: 'Sem configuração guardada para este ERP/tenant.' };
    try {
      const config = this.crypto.decryptJson<ErpConnectionConfig>(row.configEnc);
      const adapter = this.factory.create(erp, config);
      const ok = await adapter.healthCheck();
      return { ok, message: ok ? 'Ligação estabelecida com sucesso.' : 'O ERP respondeu com falha na verificação.' };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  async countByErp(): Promise<Record<string, number>> {
    const rows = await this.prisma.erpCredential.groupBy({ by: ['erp'], where: { enabled: true }, _count: { _all: true } });
    const out: Record<string, number> = {};
    for (const r of rows) out[r.erp] = r._count._all;
    return out;
  }

  private mask(config: ErpConnectionConfig): Record<string, string> {
    const masked: Record<string, string> = {};
    for (const [k, v] of Object.entries(config)) {
      masked[k] = /pass|secret|key|token/i.test(k) ? '••••••' : v;
    }
    return masked;
  }
}
