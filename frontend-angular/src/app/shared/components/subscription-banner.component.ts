// Porta de frontend/src/components/SubscriptionBanner.jsx. Usado dentro da
// própria página de Assinatura (mostrarBotao=false) — o aviso global em
// QUALQUER página (AppLayout.jsx) depende da barra lateral por persona ainda
// não portada para o Angular (ver docs/migracao-angular/PLANO.md), por isso
// fica fora do âmbito desta migração de página.
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AssinaturaEstado } from '../../core/models/assinatura.model';

@Component({
  selector: 'app-subscription-banner',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (data && data.estadoSubscricao !== 'ATIVA') {
      <div class="banner" [class.banner-warn]="classe === 'warn'" [class.banner-danger]="classe === 'danger'"
           style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between">
        <span>{{ texto }}</span>
        @if (mostrarBotao) {
          <a class="btn btn-accent btn-sm" routerLink="/empresa/assinatura">
            {{ data.estadoSubscricao === 'A_EXPIRAR' ? 'Renovar plano' : 'Renovar agora' }}
          </a>
        }
      </div>
    }
  `,
})
export class SubscriptionBannerComponent {
  @Input() data: AssinaturaEstado | null = null;
  @Input() mostrarBotao = true;

  get classe(): 'warn' | 'danger' {
    return this.data?.estadoSubscricao === 'A_EXPIRAR' ? 'warn' : 'danger';
  }

  get texto(): string {
    if (!this.data) return '';
    const { estadoSubscricao: estado, diasAteExpirar, planoAtual } = this.data;
    if (estado === 'A_EXPIRAR') {
      return `A subscrição da sua empresa vence em ${diasAteExpirar} dias. Renove para continuar a utilizar todos os recursos do plano ${planoAtual}.`;
    }
    if (estado === 'GRACE') {
      return 'A subscrição da sua empresa expirou. Os seus dados continuam seguros. Envie o comprovativo de pagamento para renovar o acesso aos recursos pagos.';
    }
    return 'A subscrição da sua empresa está vencida. Os seus dados continuam seguros, mas alguns recursos pagos (novos utilizadores, integrações, funcionalidades premium) estão bloqueados até regularizar.';
  }
}
