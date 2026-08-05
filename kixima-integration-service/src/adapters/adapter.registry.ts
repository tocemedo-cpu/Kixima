import { Injectable, Logger } from '@nestjs/common';
import { ErpSystem } from '@prisma/client';
import { ErpAdapter } from './erp-adapter.interface';
import { SapAdapter } from './sap.adapter';
import { PrimaveraAdapter } from './primavera.adapter';
import { OracleAdapter } from './oracle.adapter';
import { AribaAdapter } from './ariba.adapter';

/**
 * Registo central dos adapters ERP. Resolve por sistema e devolve os que
 * estão ativos (para fan-out de um evento por todos os ERPs configurados).
 */
@Injectable()
export class AdapterRegistry {
  private readonly logger = new Logger(AdapterRegistry.name);
  private readonly bySystem: Map<ErpSystem, ErpAdapter>;

  constructor(sap: SapAdapter, primavera: PrimaveraAdapter, oracle: OracleAdapter, ariba: AribaAdapter) {
    const all: ErpAdapter[] = [sap, primavera, oracle, ariba];
    this.bySystem = new Map(all.map((a) => [a.system, a]));
    const enabled = all.filter((a) => a.isEnabled()).map((a) => a.system);
    this.logger.log(`Adapters ERP ativos: ${enabled.length ? enabled.join(', ') : 'nenhum'}`);
  }

  get(system: ErpSystem): ErpAdapter | undefined {
    return this.bySystem.get(system);
  }

  all(): ErpAdapter[] {
    return [...this.bySystem.values()];
  }

  /** Adapters ativos — alvos do fan-out de sincronização. */
  enabled(): ErpAdapter[] {
    return this.all().filter((a) => a.isEnabled());
  }
}
