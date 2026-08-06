import { Injectable } from '@nestjs/common';
import { ErpSystem } from '@prisma/client';
import { ErpAdapter } from './erp-adapter.interface';
import { SapAdapter } from './sap.adapter';
import { PrimaveraAdapter } from './primavera.adapter';
import { OracleAdapter } from './oracle.adapter';
import { AribaAdapter } from './ariba.adapter';

/** Configuração de ligação de UM ERP para UM tenant. */
export type ErpConnectionConfig = Record<string, string>;

/**
 * Cria uma instância de adapter ERP a partir da configuração (por tenant).
 * Sem estado global: cada (tenant, erp) produz o seu próprio adapter.
 */
@Injectable()
export class AdapterFactory {
  static readonly SUPPORTED: ErpSystem[] = [
    ErpSystem.SAP_S4HANA,
    ErpSystem.PRIMAVERA,
    ErpSystem.ORACLE_ERP_CLOUD,
    ErpSystem.SAP_ARIBA,
  ];

  supported(): ErpSystem[] {
    return AdapterFactory.SUPPORTED;
  }

  create(erp: ErpSystem, config: ErpConnectionConfig): ErpAdapter {
    switch (erp) {
      case ErpSystem.SAP_S4HANA:
        return new SapAdapter(config);
      case ErpSystem.PRIMAVERA:
        return new PrimaveraAdapter(config);
      case ErpSystem.ORACLE_ERP_CLOUD:
        return new OracleAdapter(config);
      case ErpSystem.SAP_ARIBA:
        return new AribaAdapter(config);
      default:
        throw new Error(`ERP não suportado: ${erp}`);
    }
  }
}
