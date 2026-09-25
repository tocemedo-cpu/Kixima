// Espelha o contrato REAL do Java (backend-java/src/main/java/ao/kixima/cobranca/
// AssinaturaController.java, AssinaturaService.java, CobrancaDtos.java,
// CanaisPagamentoService.java) — confirmado por um agente de pesquisa dedicado,
// NÃO assumido a partir do React/Node. Duas particularidades reais capturadas
// aqui porque um modelo ingénuo (transcrito directo de Assinatura.jsx) erraria:
//
// 1. `valorUsd` tem tipos DIFERENTES em sítios diferentes da mesma resposta:
//    é STRING em PlanoCobrancaDto (emAberto/historico — BigDecimal serializado
//    como string pelo customizer global do Jackson, JacksonDecimalConfig.java),
//    mas é NÚMERO em Preco (opcoes[].preco — anotado
//    @JsonSerialize(using = Decimais.ComoNumeroJs.class)). Não é inconsistência
//    a corrigir; é o contrato real, e o componente tem de tratar os dois casos.
// 2. `POST /pedir` não devolve só {referencia} — devolve o PlanoCobrancaDto
//    completo (19 campos, sem `company`). Idem para pagar-com/comprovativo/
//    cancelar: todos devolvem o PlanoCobrancaDto actualizado dessa cobrança,
//    nunca um "ack" nem o objecto `estado()` completo — por isso o componente
//    sempre recarrega `GET /api/assinatura` a seguir, tal como o React.
export type EstadoSubscricao = 'ATIVA' | 'A_EXPIRAR' | 'GRACE' | 'RESTRITA';
export type EstadoCobranca = 'PENDENTE' | 'COMPROVATIVO_ENVIADO' | 'CONFIRMADA' | 'CANCELADA';
export type PeriodoCobranca = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';
export type DirecaoPlano = 'SUBIR' | 'DESCER' | 'RENOVAR';
export type CanalGateway = 'EMIS_MULTICAIXA' | 'PAYPAY' | 'BAI' | 'BFA' | 'STANDARD_BANK_ANGOLA';

export interface DadosBancarios {
  titular?: string | null;
  banco?: string | null;
  iban: string;
  swift?: string | null;
  moeda: string;
  configurado: boolean;
}

// PlanoCobrancaDto (CobrancaDtos.java) — a mesma forma para `emAberto`,
// cada item de `historico`, e o retorno de pedir/pagar-com/comprovativo/
// cancelar. `company` é omitido pelo Java nas rotas do lado da empresa
// (@JsonInclude(NON_NULL), estado() chama sempre PlanoCobrancaDto.de(c, false)).
export interface PlanoCobrancaDto {
  id: string;
  referencia: string;
  companyId: string;
  planoAtual: string;
  planoNovo: string;
  // STRING — ver nota no topo do ficheiro.
  valorUsd: string;
  periodo: PeriodoCobranca;
  meses: number;
  status: EstadoCobranca;
  comprovativoUrl?: string | null;
  submetidoEm?: string | null;
  confirmadaPor?: string | null;
  confirmadaEm?: string | null;
  validoAte?: string | null;
  notas?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  canal?: string | null;
  referenciaExterna?: string | null;
  telemovel?: string | null;
  // Só presente em GET /api/assinatura/fila (lado KIXIMA, comEmpresa=true) —
  // omitido (@JsonInclude(NON_NULL)) em todas as respostas do lado da
  // empresa (estado()/pedir/pagar-com/comprovativo/cancelar chamam sempre
  // .de(c, false)). {id,name,plan} — não só {name}, confirmado contra
  // CobrancaDtos.CompanyRef.
  company?: EmpresaRefPlano | null;
}

export interface EmpresaRefPlano {
  id: string;
  name: string;
  plan?: string | null;
}

export interface PrecoPlano {
  // NÚMERO — ver nota no topo do ficheiro (ao contrário de PlanoCobrancaDto.valorUsd).
  valorUsd: number;
  periodo: PeriodoCobranca;
  meses: number;
  porMesUsd: number;
}

// PlanFeatures.java — 17 campos reais (o React só lê os 11 que mostra na UI;
// os outros 6 ficam aqui modelados por completude do contrato, mesmo sem uso
// nesta página ainda).
export interface PlanFeatures {
  lugaresIncluidos: number | null;
  cotacoesPorMes: number | null;
  imagensPorItem: number;
  documentosPorItem: number;
  historicoRelatoriosMeses: number | null;
  kits: boolean;
  carregamentoEmMassa: boolean;
  erpIntegration: boolean;
  frameworkContracts: boolean;
  relatorioConteudoLocal: boolean;
  apiCatalogo: boolean;
  itensNoCatalogo: number | null;
  posicaoNaPesquisa?: string | null;
  selo?: string | null;
  supplierComparison: boolean;
  auditTrail: boolean;
  categoryManagement: boolean;
}

export interface ImpedimentoPlano {
  codigo: string;
  dimensao?: string | null;
  minimo?: string | null;
  plano?: string | null;
  lugares?: number | null;
  ocupados?: number | null;
}

export interface PerdaPlano {
  label: string;
  quantidade: number;
  consequencia: string;
}

export interface OpcaoPlano {
  plano: string;
  preco: PrecoPlano;
  features: PlanFeatures;
  atual: boolean;
  direcao: DirecaoPlano;
  impedimento?: ImpedimentoPlano | null;
  perdas?: PerdaPlano[] | null;
}

export interface EmpresaResumo {
  id: string;
  name: string;
  size?: string | null;
}

// GET /api/assinatura (AssinaturaService.estado()).
export interface AssinaturaEstado {
  empresa: EmpresaResumo;
  banco: DadosBancarios;
  planoAtual: string;
  validoAte?: string | null;
  diasAteExpirar?: number | null;
  expirada: boolean;
  estadoSubscricao: EstadoSubscricao;
  graceDiasRestantes?: number | null;
  lugaresOcupados: number;
  lugaresIncluidos: number | null;
  emAberto: PlanoCobrancaDto | null;
  historico: PlanoCobrancaDto[];
  opcoes: OpcaoPlano[];
}

// GET /api/assinatura/canais — cada canal devolve mais do que {disponivel}
// (HttpGatewayAdapter.estado()); `emFalta`/`nota` úteis para explicar porque
// um canal está indisponível, não só escondê-lo.
export interface CanalPagamentoEstado {
  canal: string;
  disponivel: boolean;
  emFalta: string[];
  nota?: string | null;
}

export type CanaisPagamento = Partial<Record<CanalGateway, CanalPagamentoEstado>>;

export interface PedirPlanoBody {
  plano: string;
  aceitaPerdas?: boolean;
}

export interface PagarComBody {
  canal: CanalGateway;
  telemovel?: string;
}

export interface CancelarCobrancaBody {
  motivo: string;
}

// POST /api/assinatura/:id/confirmar (AssinaturaController.java) — `notas` é
// inteiramente opcional (@RequestBody(required=false), branco/omisso vira
// null no servidor); o React envia sempre '' quando o prompt é cancelado, o
// que o servidor trata exactamente como se `notas` não tivesse sido enviado.
export interface ConfirmarCobrancaBody {
  notas?: string;
}

// Item de `vencidas`/`emGrace`/`restritas` em GET /api/assinatura/fila —
// note que o campo chama-se `plan`, não `planoAtual` (nome diferente do
// resto do contrato, confirmado contra AssinaturaService.fila()).
export interface EmpresaVencidaResumo {
  id: string;
  name: string;
  plan?: string | null;
  planoValidoAte: string;
  diasVencida: number;
  estadoSubscricao: EstadoSubscricao;
}

// GET /api/assinatura/fila (AssinaturaService.fila(), Admin Sistema —
// ADMIN_SISTEMA + AdminArea.FINANCEIRO). `emAberto[]` aqui TEM `company`
// preenchido (ao contrário do estado() do lado da empresa). `vencidas` é o
// conjunto completo antes de se dividir em emGrace/restritas — o React só
// usa os dois subconjuntos, mas o campo existe e fica modelado por
// completude do contrato.
export interface AssinaturaFila {
  emAberto: PlanoCobrancaDto[];
  vencidas: EmpresaVencidaResumo[];
  emGrace: EmpresaVencidaResumo[];
  restritas: EmpresaVencidaResumo[];
  porConfirmar: number;
  porPagar: number;
}

// --- Add-ons (AddonController.java/AddonCobrancaService.java) --------------
// Mesmo mecanismo dos planos (transferência com comprovativo, confirmada
// pelo Admin Sistema), para funcionalidades pagas à parte (ex.: Automatic PO
// Robot). Modelo próprio porque AddonCobrancaDto não é o mesmo tipo de
// PlanoCobrancaDto no Java, apesar da forma semelhante.
export interface AddonCobrancaDto {
  id: string;
  referencia: string;
  companyId: string;
  addonKey: string;
  // STRING — mesma particularidade global do Jackson que PlanoCobrancaDto.valorUsd.
  valorUsd: string;
  periodo: PeriodoCobranca;
  meses: number;
  status: EstadoCobranca;
  comprovativoUrl?: string | null;
  submetidoEm?: string | null;
  confirmadaPor?: string | null;
  confirmadaEm?: string | null;
  validoAte?: string | null;
  notas?: string | null;
  canal?: string | null;
  referenciaExterna?: string | null;
  telemovel?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  // Só em GET /api/addons/fila — omitido em confirmar/cancelar, tal como em PlanoCobrancaDto.
  company?: EmpresaRefPlano | null;
}

// GET /api/addons/fila — ADMIN_SISTEMA + AdminArea.FINANCEIRO. Sem
// vencidas/emGrace/restritas (add-ons não têm período de tolerância).
export interface AddonsFila {
  emAberto: AddonCobrancaDto[];
  porConfirmar: number;
  porPagar: number;
}

// GET /api/addons/catalogo — sem restrição de papel (qualquer sessão
// autenticada). `preco.valorUsd`/`porMesUsd` são NÚMEROS (Preco tem o mesmo
// serializador próprio que opcoes[].preco em PrecoPlano), ao contrário de
// AddonCobrancaDto.valorUsd (string).
export interface AddonCatalogoItem {
  addonKey: string;
  label: string;
  requerPlano: string;
  preco: PrecoPlano;
}
