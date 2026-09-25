import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TwoFactorSectionComponent } from './two-factor-section.component';
import { SecurityService } from './security.service';
import { TotpStatus } from '../../core/models/security.model';
import { ApiError } from '../../core/models/api-error.model';

function status(overrides: Partial<TotpStatus> = {}): TotpStatus {
  return { enabled: false, enabledAt: null, metodo: null, emailIndisponivel: null, email: 'a***b@a.co', ...overrides };
}

function montar(estadoInicial: TotpStatus = status()) {
  const securityService = jasmine.createSpyObj<SecurityService>('SecurityService', [
    'totpStatus', 'enviarCodigoEmail', 'reenviarCodigoEmail', 'setupTotp', 'enableTotp', 'disableTotp',
  ]);
  securityService.totpStatus.and.returnValue(of(estadoInicial));
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new TwoFactorSectionComponent(securityService));
  return { componente, securityService };
}

describe('TwoFactorSectionComponent', () => {
  it('carrega o estado ao arrancar', () => {
    const { componente } = montar();
    expect(componente.status()?.email).toBe('a***b@a.co');
  });

  it('comecarEmail() envia o código e muda para a etapa EMAIL', () => {
    const { componente, securityService } = montar();
    securityService.enviarCodigoEmail.and.returnValue(of({ enviadoPara: 'a@a.co', expiraEm: '2026-01-01', validadeMinutos: 10 }));
    componente.comecarEmail();
    expect(componente.etapa()).toBe('EMAIL');
    expect(componente.envio()?.enviadoPara).toBe('a@a.co');
  });

  it('comecarApp() gera o setup e muda para a etapa TOTP', () => {
    const { componente, securityService } = montar();
    securityService.setupTotp.and.returnValue(of({ secret: 'ABCDEF', otpauthUrl: 'otpauth://totp/KIXIMA?secret=ABCDEF' }));
    componente.comecarApp();
    expect(componente.etapa()).toBe('TOTP');
    expect(componente.setup()?.secret).toBe('ABCDEF');
  });

  it('cancelar() repõe o estado inicial do fluxo', () => {
    const { componente, securityService } = montar();
    securityService.setupTotp.and.returnValue(of({ secret: 'ABCDEF', otpauthUrl: 'otpauth://x' }));
    componente.comecarApp();
    componente.cancelar();
    expect(componente.etapa()).toBe('');
    expect(componente.setup()).toBeNull();
    expect(componente.code()).toBe('');
  });

  it('confirmar() activa por EMAIL e recarrega o estado', () => {
    const { componente, securityService } = montar();
    securityService.enableTotp.and.returnValue(of({ enabled: true, enabledAt: '2026-01-01', metodo: 'EMAIL' }));
    securityService.totpStatus.and.returnValue(of(status({ enabled: true, metodo: 'EMAIL', enabledAt: '2026-01-01' })));
    componente.code.set('123456');
    componente.confirmar();
    expect(securityService.enableTotp).toHaveBeenCalledWith({ code: '123456' });
    expect(componente.success()).toContain('email');
    expect(componente.etapa()).toBe('');
  });

  it('confirmar() activa por TOTP com a mensagem correspondente', () => {
    const { componente, securityService } = montar();
    securityService.enableTotp.and.returnValue(of({ enabled: true, enabledAt: '2026-01-01', metodo: 'TOTP' }));
    componente.code.set('654321');
    componente.confirmar();
    expect(componente.success()).toContain('app');
  });

  it('disable() desactiva o 2FA e recarrega o estado', () => {
    const { componente, securityService } = montar(status({ enabled: true, metodo: 'EMAIL', enabledAt: '2026-01-01' }));
    securityService.disableTotp.and.returnValue(of({ enabled: false }));
    securityService.totpStatus.and.returnValue(of(status()));
    componente.disableCode.set('999999');
    componente.disable();
    expect(securityService.disableTotp).toHaveBeenCalledWith({ code: '999999' });
    expect(componente.success()).toBe('Verificação em dois passos desativada.');
  });

  it('regista o erro quando uma ação falha (ex.: código errado)', () => {
    const { componente, securityService } = montar();
    securityService.setupTotp.and.returnValue(throwError(() => new ApiError('Código incorreto.', 401)));
    componente.comecarApp();
    expect(componente.error()).toBe('Código incorreto.');
  });
});
