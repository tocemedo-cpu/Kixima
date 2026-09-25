// Espelha PublicoCobrancaController.java:44-56 (GET /api/planos, público — sem
// autenticação) e o record PlanFeatures.java:9-27. `posicaoNaPesquisa` é
// sempre um número concreto (0=BASE,1=CORE,2=PRO — nunca null); já
// `imagensPorItem`/`documentosPorItem` são nulos quando ilimitados.
export type PlanoNome = 'BASE' | 'CORE' | 'PRO';

export interface PlanFeatures {
  itensNoCatalogo: number | null;
  posicaoNaPesquisa: number;
  selo: boolean;
  lugaresIncluidos: number | null;
  kits: boolean;
  carregamentoEmMassa: boolean;
  documentosPorItem: number | null;
  imagensPorItem: number | null;
  cotacoesPorMes: number | null;
  historicoRelatoriosMeses: number | null;
  frameworkContracts: boolean;
  erpIntegration: boolean;
  relatorioConteudoLocal: boolean;
  apiCatalogo: boolean;
  supplierComparison: boolean;
  auditTrail: boolean;
  categoryManagement: boolean;
}

export interface PlanoPreco {
  valorUsd: number;
  periodo: string;
  meses: number;
  porMesUsd: number;
}

export interface PlanoDto {
  plano: PlanoNome;
  preco: PlanoPreco;
  features: PlanFeatures;
}

export interface TaxaPorTransacao {
  porOrdemUsd: number;
  porFaturaUsd: number;
  limiarUsd: number;
  percentagemAcima: number;
}

export interface PlanosResponse {
  planos: PlanoDto[];
  taxaPorTransacao: TaxaPorTransacao;
}
