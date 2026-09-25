import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PersonalDataSectionComponent } from './personal-data-section.component';
import { SecurityService } from './security.service';
import { ApiError } from '../../core/models/api-error.model';

function montar() {
  const securityService = jasmine.createSpyObj<SecurityService>('SecurityService', ['dadosPessoais', 'anonimizar']);
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new PersonalDataSectionComponent(securityService));
  return { componente, securityService };
}

describe('PersonalDataSectionComponent', () => {
  it('exportar() descarrega os dados e limpa o estado de "a preparar"', () => {
    const { componente, securityService } = montar();
    securityService.dadosPessoais.and.returnValue(of({ geradoEm: '2026-01-01', aviso: '', conta: {}, atividade: { ordensCriadas: [], ordensAprovadas: [], pagamentosAutorizados: [], registoDeAcoes: [], notificacoesRecebidas: [] }, totais: {} }));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:fake');
    spyOn(URL, 'revokeObjectURL');
    const link = document.createElement('a');
    spyOn(link, 'click');
    spyOn(document, 'createElement').and.returnValue(link);
    componente.exportar();
    expect(securityService.dadosPessoais).toHaveBeenCalled();
    expect(link.click).toHaveBeenCalled();
    expect(componente.aExportar()).toBeFalse();
  });

  it('exportar() regista o erro se falhar', () => {
    const { componente, securityService } = montar();
    securityService.dadosPessoais.and.returnValue(throwError(() => new ApiError('Falha.', 500)));
    componente.exportar();
    expect(componente.erro()).toBe('Falha.');
    expect(componente.aExportar()).toBeFalse();
  });

  it('pedirConfirmacao()/cancelarConfirmacao() alternam o passo de confirmação', () => {
    const { componente } = montar();
    componente.pedirConfirmacao();
    expect(componente.confirmar()).toBeTrue();
    componente.senha.set('123');
    componente.cancelarConfirmacao();
    expect(componente.confirmar()).toBeFalse();
    expect(componente.senha()).toBe('');
  });

  it('anonimizar() guarda o resultado quando a senha está certa', () => {
    const { componente, securityService } = montar();
    const resultado = {
      utilizador: { id: 'u1', name: 'Utilizador anonimizado', email: 'anonimizado-u1@anonimo.kixima', active: false },
      registosDeAuditoriaPreservados: 3, notificacoesEliminadas: 5, motivo: null, anonimizadoEm: '2026-01-01', nota: 'preservado',
    };
    securityService.anonimizar.and.returnValue(of(resultado));
    componente.senha.set('senha12345');
    componente.anonimizar();
    expect(securityService.anonimizar).toHaveBeenCalledWith({ password: 'senha12345' });
    expect(componente.feito()).toEqual(resultado);
  });

  it('anonimizar() regista o erro quando a senha está errada (422, não 401)', () => {
    const { componente, securityService } = montar();
    securityService.anonimizar.and.returnValue(throwError(() => new ApiError('Confirme a sua senha atual para eliminar os dados.', 422, 'VALIDATION_ERROR')));
    componente.senha.set('errada');
    componente.anonimizar();
    expect(componente.erro()).toBe('Confirme a sua senha atual para eliminar os dados.');
    expect(componente.feito()).toBeNull();
  });
});
