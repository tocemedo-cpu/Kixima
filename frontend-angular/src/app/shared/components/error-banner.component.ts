// Porta de ErrorBanner em frontend/src/components/Common.jsx:87-116, incluindo
// o caso especial do "muro de plano" (PLANO_INSUFICIENTE): mostra um caminho
// para subscrever/gerir o plano, conforme o papel de quem vê o erro.
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PersonaRole } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

const PODE_SUBSCREVER: PersonaRole[] = ['COMPANY_ADMIN'];
const VE_SUBSCRICAO: PersonaRole[] = ['COMPANY_ADMIN', 'FINANCEIRO'];

@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (texto) {
      @if (!muroDePlano) {
        <div class="banner banner-error">{{ texto }}</div>
      } @else {
        <div class="banner banner-error" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between">
          <span>{{ texto }}</span>
          @if (papel && podeSubscrever(papel)) {
            <a class="btn btn-accent btn-sm" routerLink="/empresa/assinatura">Ver planos e subscrever</a>
          } @else if (papel && veSubscricao(papel)) {
            <a class="btn btn-ghost btn-sm" routerLink="/empresa/assinatura">Ver a subscrição</a>
          } @else {
            <!-- Sem botão para quem não pode pagar — mandá-lo para uma página
                 que lhe devolve 403 seria pior do que não ter botão. -->
            <span class="helptext">Só o administrador da empresa pode mudar de plano — fale com ele.</span>
          }
        </div>
      }
    }
  `,
})
export class ErrorBannerComponent {
  @Input() message: string | ApiError | null = null;
  @Input() error: ApiError | null = null;
  @Input() papel: PersonaRole | null = null;

  get erro(): ApiError | null {
    return typeof this.message === 'object' && this.message ? this.message : this.error;
  }

  get texto(): string | null {
    if (typeof this.message === 'string') return this.message;
    return this.erro?.message ?? null;
  }

  get muroDePlano(): boolean {
    return this.erro?.code === 'PLANO_INSUFICIENTE';
  }

  podeSubscrever(role: PersonaRole): boolean {
    return PODE_SUBSCREVER.includes(role);
  }

  veSubscricao(role: PersonaRole): boolean {
    return VE_SUBSCRICAO.includes(role);
  }
}
