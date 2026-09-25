// Porta da secção TwoFactorSection de frontend/src/pages/shared/Security.jsx.
// Dois métodos — EMAIL por omissão (sem instalar nada) e TOTP (app de
// autenticação) atrás de "prefiro usar uma app". Contratos confirmados por
// um agente de pesquisa dedicado (distintos do desafio de 2FA no login).
import { Component, signal } from '@angular/core';
import { Observable } from 'rxjs';
import QRCode from 'qrcode';
import { SecurityService } from './security.service';
import { MfaEmailEnvio, TotpSetup, TotpStatus } from '../../core/models/security.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDate } from '../../shared/domain';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';
import { FieldComponent } from '../../shared/components/field.component';

type Etapa = '' | 'EMAIL' | 'TOTP';

@Component({
  selector: 'app-two-factor-section',
  standalone: true,
  imports: [ErrorBannerComponent, SuccessBannerComponent, FieldComponent],
  templateUrl: './two-factor-section.component.html',
})
export class TwoFactorSectionComponent {
  readonly status = signal<TotpStatus | null>(null);
  readonly etapa = signal<Etapa>('');
  readonly setup = signal<TotpSetup | null>(null);
  readonly envio = signal<MfaEmailEnvio | null>(null);
  readonly qr = signal('');
  readonly code = signal('');
  readonly disableCode = signal('');
  readonly error = signal('');
  readonly success = signal('');
  readonly busy = signal(false);

  readonly formatDate = formatDate;

  constructor(private readonly securityService: SecurityService) {
    this.load();
  }

  private load(): void {
    this.securityService.totpStatus().subscribe({
      next: (s) => this.status.set(s),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  private gerarQr(): void {
    const url = this.setup()?.otpauthUrl;
    if (!url) {
      this.qr.set('');
      return;
    }
    QRCode.toDataURL(url, { width: 180, margin: 1 })
      .then((dataUrl) => this.qr.set(dataUrl))
      .catch(() => this.qr.set(''));
  }

  private run<T>(acao: () => Observable<T>, aoTerminar: (resultado: T) => void): void {
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    acao().subscribe({
      next: (r) => {
        aoTerminar(r);
        this.busy.set(false);
      },
      error: (e) => {
        this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.busy.set(false);
      },
    });
  }

  comecarEmail(): void {
    this.run(
      () => this.securityService.enviarCodigoEmail(),
      (envio) => {
        this.envio.set(envio);
        this.etapa.set('EMAIL');
      },
    );
  }

  reenviarEmail(): void {
    this.run(
      () => this.securityService.enviarCodigoEmail(),
      (envio) => {
        this.envio.set(envio);
        this.success.set('Enviámos outro código.');
      },
    );
  }

  comecarApp(): void {
    this.run(
      () => this.securityService.setupTotp(),
      (setup) => {
        this.setup.set(setup);
        this.etapa.set('TOTP');
        this.gerarQr();
      },
    );
  }

  cancelar(): void {
    this.etapa.set('');
    this.setup.set(null);
    this.envio.set(null);
    this.code.set('');
    this.error.set('');
    this.qr.set('');
  }

  confirmar(): void {
    this.run(
      () => this.securityService.enableTotp({ code: this.code().trim() }),
      (r) => {
        this.cancelar();
        this.success.set(
          r.metodo === 'EMAIL'
            ? 'Verificação em dois passos ATIVADA. A partir de agora, ao entrar, enviamos-lhe um código por email.'
            : 'Verificação em dois passos ATIVADA. A partir de agora o login pede também o código da app.',
        );
        this.load();
      },
    );
  }

  pedirCodigoParaDesativar(): void {
    this.run(
      () => this.securityService.reenviarCodigoEmail(),
      (r) => this.success.set(`Enviámos um código para ${r.enviadoPara}.`),
    );
  }

  disable(): void {
    this.run(
      () => this.securityService.disableTotp({ code: this.disableCode().trim() }),
      () => {
        this.disableCode.set('');
        this.success.set('Verificação em dois passos desativada.');
        this.load();
      },
    );
  }
}
