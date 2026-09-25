import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { RegisterComponent } from './register.component';
import { RegisterService } from './register.service';
import { ApiError } from '../../core/models/api-error.model';

function rota(tipo: string | null = null): ActivatedRoute {
  return { snapshot: { queryParamMap: { get: () => tipo } } } as unknown as ActivatedRoute;
}

function ficheiro(nome: string): File {
  return new File(['x'], nome);
}

describe('RegisterComponent', () => {
  let registerService: jasmine.SpyObj<RegisterService>;

  beforeEach(() => {
    registerService = jasmine.createSpyObj<RegisterService>('RegisterService', ['register']);
    TestBed.configureTestingModule({});
  });

  it('pré-seleciona o tipo a partir de ?tipo= na query string', () => {
    const c = TestBed.runInInjectionContext(() => new RegisterComponent(rota('FORNECEDOR'), registerService));
    expect(c.form().type).toBe('FORNECEDOR');
    expect(c.isSupplier()).toBeTrue();
  });

  it('ignora um ?tipo= inválido e mantém CLIENTE por omissão', () => {
    const c = TestBed.runInInjectionContext(() => new RegisterComponent(rota('QUALQUER_COISA'), registerService));
    expect(c.form().type).toBe('CLIENTE');
  });

  it('requiredDocs() muda consoante o tipo — CLIENTE tem 2, FORNECEDOR tem 3', () => {
    const cliente = TestBed.runInInjectionContext(() => new RegisterComponent(rota('CLIENTE'), registerService));
    expect(cliente.requiredDocs().length).toBe(2);

    const fornecedor = TestBed.runInInjectionContext(() => new RegisterComponent(rota('FORNECEDOR'), registerService));
    expect(fornecedor.requiredDocs().length).toBe(3);
  });

  it('submit() recusa sem os documentos obrigatórios, sem chamar o serviço', async () => {
    const c = TestBed.runInInjectionContext(() => new RegisterComponent(rota('CLIENTE'), registerService));
    c.termsAccepted.set(true);

    await c.submit();

    expect(c.error()).toContain('Anexe os documentos');
    expect(registerService.register).not.toHaveBeenCalled();
  });

  it('submit() recusa um fornecedor sem o documento da apólice', async () => {
    const c = TestBed.runInInjectionContext(() => new RegisterComponent(rota('FORNECEDOR'), registerService));
    c.termsAccepted.set(true);
    c.onDoc('ALVARA_COMERCIAL', { target: { files: [ficheiro('a.pdf')] } } as unknown as Event);
    c.onDoc('LICENCA_ANPG', { target: { files: [ficheiro('l.pdf')] } } as unknown as Event);
    c.onDoc('CERTIDAO_COMERCIAL', { target: { files: [ficheiro('c.pdf')] } } as unknown as Event);

    await c.submit();

    expect(c.error()).toContain('apólice de seguro');
    expect(registerService.register).not.toHaveBeenCalled();
  });

  it('submit() recusa sem aceitar os termos', async () => {
    const c = TestBed.runInInjectionContext(() => new RegisterComponent(rota('CLIENTE'), registerService));
    c.onDoc('CERTIDAO_COMERCIAL', { target: { files: [ficheiro('c.pdf')] } } as unknown as Event);
    c.onDoc('ALVARA_COMERCIAL', { target: { files: [ficheiro('a.pdf')] } } as unknown as Event);

    await c.submit();

    expect(c.error()).toContain('Termos de Uso');
    expect(registerService.register).not.toHaveBeenCalled();
  });

  it('submit() chama o serviço com o formulário e os documentos quando tudo está completo', fakeAsync(() => {
    registerService.register.and.returnValue(of({ id: 'c1', name: 'Empresa X' }));
    const c = TestBed.runInInjectionContext(() => new RegisterComponent(rota('CLIENTE'), registerService));
    c.update('name', 'Empresa X');
    c.termsAccepted.set(true);
    c.onDoc('CERTIDAO_COMERCIAL', { target: { files: [ficheiro('c.pdf')] } } as unknown as Event);
    c.onDoc('ALVARA_COMERCIAL', { target: { files: [ficheiro('a.pdf')] } } as unknown as Event);

    c.submit();
    flushMicrotasks();

    expect(registerService.register).toHaveBeenCalled();
    const [corpo, docs] = registerService.register.calls.mostRecent().args;
    expect(corpo.name).toBe('Empresa X');
    expect(Object.keys(docs)).toEqual(['CERTIDAO_COMERCIAL', 'ALVARA_COMERCIAL']);
    expect(c.done()?.name).toBe('Empresa X');
  }));

  it('submit() regista o erro quando o servidor recusa', fakeAsync(() => {
    registerService.register.and.returnValue(throwError(() => new ApiError('NIF já registado', 409)));
    const c = TestBed.runInInjectionContext(() => new RegisterComponent(rota('CLIENTE'), registerService));
    c.termsAccepted.set(true);
    c.onDoc('CERTIDAO_COMERCIAL', { target: { files: [ficheiro('c.pdf')] } } as unknown as Event);
    c.onDoc('ALVARA_COMERCIAL', { target: { files: [ficheiro('a.pdf')] } } as unknown as Event);

    c.submit();
    flushMicrotasks();

    expect(c.error()).toBe('NIF já registado');
  }));
});
