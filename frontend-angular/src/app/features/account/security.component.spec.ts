import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SecurityComponent } from './security.component';
import { SecurityService } from './security.service';
import { ApiError } from '../../core/models/api-error.model';

function montar() {
  const securityService = jasmine.createSpyObj<SecurityService>('SecurityService', ['changePassword']);
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new SecurityComponent(securityService));
  return { componente, securityService };
}

describe('SecurityComponent', () => {
  it('submit() recusa nova senha com menos de 10 caracteres', () => {
    const { componente, securityService } = montar();
    componente.form.set({ currentPassword: 'atual12345', newPassword: 'curta', confirm: 'curta' });
    componente.submit();
    expect(componente.error()).toBe('A nova senha deve ter pelo menos 10 caracteres.');
    expect(securityService.changePassword).not.toHaveBeenCalled();
  });

  it('submit() recusa quando a confirmação não coincide', () => {
    const { componente, securityService } = montar();
    componente.form.set({ currentPassword: 'atual12345', newPassword: 'novaSenha12345', confirm: 'outraSenha12345' });
    componente.submit();
    expect(componente.error()).toBe('A confirmação não coincide com a nova senha.');
    expect(securityService.changePassword).not.toHaveBeenCalled();
  });

  it('submit() chama o serviço e limpa o formulário em caso de sucesso', () => {
    const { componente, securityService } = montar();
    securityService.changePassword.and.returnValue(of({ ok: true }));
    componente.form.set({ currentPassword: 'atual12345', newPassword: 'novaSenha12345', confirm: 'novaSenha12345' });
    componente.submit();
    expect(securityService.changePassword).toHaveBeenCalledWith({ currentPassword: 'atual12345', newPassword: 'novaSenha12345' });
    expect(componente.success()).toBe('Senha alterada com sucesso.');
    expect(componente.form()).toEqual({ currentPassword: '', newPassword: '', confirm: '' });
  });

  it('submit() regista o erro do servidor (ex.: senha actual errada, 401)', () => {
    const { componente, securityService } = montar();
    securityService.changePassword.and.returnValue(throwError(() => new ApiError('A senha atual está incorreta.', 401, 'UNAUTHORIZED')));
    componente.form.set({ currentPassword: 'errada12345', newPassword: 'novaSenha12345', confirm: 'novaSenha12345' });
    componente.submit();
    expect(componente.error()).toBe('A senha atual está incorreta.');
  });
});
