// Porta de frontend/src/pages/companyAdmin/Assinatura.jsx. Subscrição da
// empresa: ver o plano, mudar de plano, pagar por transferência (ou gateway,
// quando o plano/canal permitem). Contratos confirmados endpoint a endpoint
// contra o Java antes de codificar — ver assinatura.model.ts.
import { Component, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { AssinaturaService } from './assinatura.service';
import { AssinaturaEstado, CanaisPagamento, CanalGateway, OpcaoPlano, PlanoCobrancaDto } from '../../core/models/assinatura.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDate, formatUsd } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { PillComponent } from '../../shared/buyer-ui/pill.component';
import { EmptyRowComponent } from '../../shared/buyer-ui/empty-row.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';
import { SubscriptionBannerComponent } from '../../shared/components/subscription-banner.component';

// Só BASE e CORE têm canais automáticos (PLANOS_COM_GATEWAY em
// AssinaturaService.java) — o PRO fica exclusivamente na transferência
// manual. Só telemóveis (EMIS/PayPay) pedem número antes de iniciar o
// pagamento — confirmado que o Java NÃO valida isto no servidor (aceita sem
// telemóvel e o gateway é que decide), portanto isto é só UX do lado do
// cliente, não uma garantia do servidor.
const PLANOS_COM_GATEWAY = ['BASE', 'CORE'];
const CANAIS_COM_TELEMOVEL: CanalGateway[] = ['EMIS_MULTICAIXA', 'PAYPAY'];
const NOME_CANAL: Record<string, string> = {
  EMIS_MULTICAIXA: 'Multicaixa Express',
  PAYPAY: 'PayPay',
  BAI: 'BAI',
  BFA: 'BFA',
  STANDARD_BANK_ANGOLA: 'Standard Bank Angola',
};

const PERIODOS: Record<string, string> = {
  MENSAL: 'por mês', TRIMESTRAL: 'por trimestre', SEMESTRAL: 'por semestre', ANUAL: 'por ano',
};

const ESTADO_PILL: Record<string, string> = {
  PENDENTE: 'pending', COMPROVATIVO_ENVIADO: 'info', CONFIRMADA: 'success', CANCELADA: 'neutral',
};

const ESTADO_TEXTO: Record<string, string> = {
  PENDENTE: 'Por pagar', COMPROVATIVO_ENVIADO: 'Aguarda confirmação da KIXIMA', CONFIRMADA: 'Confirmada', CANCELADA: 'Cancelada',
};

const ROTULO_DIRECAO: Record<string, string> = {
  SUBIR: 'Subir para este plano', DESCER: 'Descer para este plano', RENOVAR: 'Renovar este plano',
};

@Component({
  selector: 'app-assinatura',
  standalone: true,
  imports: [CrumbsComponent, BuyerPageHeadComponent, PillComponent, EmptyRowComponent, ErrorBannerComponent, SuccessBannerComponent, SubscriptionBannerComponent],
  templateUrl: './assinatura.component.html',
})
export class AssinaturaComponent {
  // O Financeiro vê a página e carrega o comprovativo, mas não escolhe o
  // plano nem cancela — confirmado ao vivo que POST /pedir e .../cancelar
  // são só para COMPANY_ADMIN no servidor (403 para FINANCEIRO).
  readonly podeEscolherPlano: boolean;

  readonly data = signal<AssinaturaEstado | null>(null);
  readonly canais = signal<CanaisPagamento | null>(null);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly busy = signal(false);

  readonly PERIODOS = PERIODOS;
  readonly ESTADO_PILL = ESTADO_PILL;
  readonly ESTADO_TEXTO = ESTADO_TEXTO;
  readonly ROTULO_DIRECAO = ROTULO_DIRECAO;
  readonly NOME_CANAL = NOME_CANAL;
  readonly PLANOS_COM_GATEWAY = PLANOS_COM_GATEWAY;

  readonly formatDate = formatDate;
  readonly formatUsd = formatUsd;

  constructor(
    auth: AuthService,
    private readonly assinaturaService: AssinaturaService,
  ) {
    this.podeEscolherPlano = auth.user()?.role === 'COMPANY_ADMIN';
    this.carregar();
  }

  private carregar(): void {
    this.error.set('');
    this.assinaturaService.estado().subscribe({
      next: (d) => this.data.set(d),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
    // Só o Admin/Financeiro chegam a esta página (guardado na rota), por isso
    // não há problema em pedir sempre — canais que faltam configurar não
    // aparecem, não travam a página.
    this.assinaturaService.canais().subscribe({
      next: (c) => this.canais.set(c),
      error: () => this.canais.set({}),
    });
  }

  canaisDisponiveis(): [string, { disponivel: boolean }][] {
    const c = this.canais();
    if (!c) return [];
    return Object.entries(c).filter(([, v]) => v?.disponivel) as [string, { disponivel: boolean }][];
  }

  temCanalDisponivel(): boolean {
    return this.canaisDisponiveis().length > 0;
  }

  nomeCanal(canal: string): string {
    return NOME_CANAL[canal] || canal;
  }

  periodoLabel(periodo: string): string {
    return PERIODOS[periodo] || periodo;
  }

  pagarComGateway(cobrancaId: string, canal: string): void {
    let telemovel: string | undefined;
    if (CANAIS_COM_TELEMOVEL.includes(canal as CanalGateway)) {
      const valor = window.prompt('Número de telemóvel para pedir o pagamento:');
      if (!valor) return;
      telemovel = valor;
    }
    this.busy.set(true);
    this.error.set('');
    this.aviso.set('');
    this.assinaturaService.pagarCom(cobrancaId, { canal: canal as CanalGateway, telemovel }).subscribe({
      next: () => {
        this.aviso.set(`Pedido de pagamento enviado para ${this.nomeCanal(canal)}. Confirme no telemóvel/aplicação — o plano ativa-se automaticamente assim que o pagamento for confirmado.`);
        this.busy.set(false);
        this.carregar();
      },
      error: (e) => {
        // O Java devolve 500 genérico quando o gateway não tem credenciais
        // configuradas neste ambiente (confirmado — não é um erro de negócio
        // estruturado). Sem esta ressalva, a pessoa via uma mensagem de erro
        // técnica em vez de ser encaminhada para a alternativa que funciona.
        this.error.set(
          e instanceof ApiError && e.status !== 500
            ? e.message
            : 'Não foi possível iniciar o pagamento por este canal agora. Tente novamente mais tarde ou pague por transferência bancária.',
        );
        this.busy.set(false);
      },
    });
  }

  pedir(plano: string, aceitaPerdas = false): void {
    this.busy.set(true);
    this.error.set('');
    this.aviso.set('');
    this.assinaturaService.pedir({ plano, aceitaPerdas }).subscribe({
      next: (c: PlanoCobrancaDto) => {
        this.aviso.set(`Cobrança ${c.referencia} emitida. Faça a transferência e carregue o comprovativo aqui.`);
        this.busy.set(false);
        this.carregar();
      },
      error: (e) => {
        this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.busy.set(false);
      },
    });
  }

  // A descida só avança depois de a pessoa ver, por escrito e com números, o
  // que vai perder. O servidor recusa na mesma sem aceitaPerdas — isto aqui é
  // para ela saber, não para a plataforma se proteger.
  pedirComAviso(opcao: OpcaoPlano): void {
    if (!opcao.perdas?.length) {
      this.pedir(opcao.plano);
      return;
    }
    const lista = opcao.perdas.map((p) => `• ${p.quantidade} ${p.label} — ${p.consequencia}`).join('\n');
    const ok = window.confirm(`Descer para o plano ${opcao.plano} faz perder:\n\n${lista}\n\nQuer continuar?`);
    if (ok) this.pedir(opcao.plano, true);
  }

  enviarComprovativo(cobrancaId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.busy.set(true);
    this.error.set('');
    this.aviso.set('');
    this.assinaturaService.comprovativo(cobrancaId, file).subscribe({
      next: () => {
        this.aviso.set('Comprovativo recebido. A KIXIMA confirma a entrada do valor e o plano fica ativo.');
        this.busy.set(false);
        input.value = '';
        this.carregar();
      },
      error: (e) => {
        this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.busy.set(false);
        input.value = '';
      },
    });
  }

  cancelar(cobrancaId: string): void {
    const motivo = window.prompt('Porque está a cancelar esta cobrança?');
    if (!motivo) return;
    this.busy.set(true);
    this.error.set('');
    this.assinaturaService.cancelar(cobrancaId, { motivo }).subscribe({
      next: () => {
        this.busy.set(false);
        this.carregar();
      },
      error: (e) => {
        this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.busy.set(false);
      },
    });
  }

  textoImpedimento(opcao: OpcaoPlano): string {
    const imp = opcao.impedimento;
    if (!imp) return '';
    if (imp.codigo === 'DIMENSAO_EXIGE_PLANO') {
      return `Empresas de dimensão ${imp.dimensao} têm de subscrever o plano ${imp.minimo}.`;
    }
    return `O plano ${imp.plano} inclui ${imp.lugares} lugares e a empresa tem ${imp.ocupados} (utilizadores ativos mais convites por aceitar). Desative os utilizadores em excesso antes de descer de plano.`;
  }

  textoPerdas(opcao: OpcaoPlano): string {
    return (opcao.perdas || []).map((p) => `${p.quantidade} ${p.label}`).join('; ');
  }

  documentosLabel(opcao: OpcaoPlano): string {
    const f = opcao.features;
    return f.documentosPorItem === 1
      ? `${f.imagensPorItem} imagens e 1 documento por item`
      : `${f.imagensPorItem} imagens e ${f.documentosPorItem} documentos por item`;
  }
}
