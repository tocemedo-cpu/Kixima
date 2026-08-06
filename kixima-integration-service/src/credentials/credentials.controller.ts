import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ErpSystem } from '@prisma/client';
import { AdminTokenGuard } from './admin-token.guard';
import { CredentialsService, TenantCredentialView } from './credentials.service';
import { AdapterFactory, ErpConnectionConfig } from '@app/adapters/adapter.factory';

interface UpsertBody {
  enabled?: boolean;
  config: ErpConnectionConfig;
}

/**
 * API de gestão das credenciais ERP por tenant (protegida por token de admin).
 * Use tenantId = '*' para uma configuração GLOBAL (todos os tenants).
 */
@Controller('credentials')
@UseGuards(AdminTokenGuard)
export class CredentialsController {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly factory: AdapterFactory,
  ) {}

  /** ERPs suportados pela camada de integração. */
  @Get('erp-systems')
  supported(): { supported: ErpSystem[] } {
    return { supported: this.factory.supported() };
  }

  /** Lista as credenciais (mascaradas) de um tenant. */
  @Get('tenants/:tenantId')
  list(@Param('tenantId') tenantId: string): Promise<TenantCredentialView[]> {
    return this.credentials.listForTenant(tenantId);
  }

  /** Cria/atualiza a config de um ERP para um tenant. */
  @Put('tenants/:tenantId/:erp')
  async upsert(
    @Param('tenantId') tenantId: string,
    @Param('erp') erp: ErpSystem,
    @Body() body: UpsertBody,
  ): Promise<{ ok: true }> {
    await this.credentials.upsert(tenantId, erp, body.enabled ?? true, body.config ?? {});
    return { ok: true };
  }

  /** Remove a config de um ERP de um tenant. */
  @Delete('tenants/:tenantId/:erp')
  async remove(@Param('tenantId') tenantId: string, @Param('erp') erp: ErpSystem): Promise<{ ok: true }> {
    await this.credentials.remove(tenantId, erp);
    return { ok: true };
  }
}
