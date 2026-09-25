import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RegisterService } from './register.service';
import { RegisterCompanyBody } from '../../core/models/company.model';

function corpo(overrides: Partial<RegisterCompanyBody> = {}): RegisterCompanyBody {
  return {
    type: 'CLIENTE', name: 'Empresa X', taxId: 'AO-1', contactEmail: 'x@x.co', adminName: 'Ana',
    adminEmail: 'ana@x.co', adminPassword: 'senha123456', ...overrides,
  };
}

describe('RegisterService', () => {
  let service: RegisterService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RegisterService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('register() envia POST multipart para /api/companies/register com os campos e documentos do cliente', () => {
    const certidao = new File(['x'], 'certidao.pdf');
    service.register(corpo(), { CERTIDAO_COMERCIAL: certidao }).subscribe();

    const req = http.expectOne({ url: '/api/companies/register', method: 'POST' });
    const fd = req.request.body as FormData;
    expect(fd instanceof FormData).toBeTrue();
    expect(fd.get('type')).toBe('CLIENTE');
    expect(fd.get('name')).toBe('Empresa X');
    expect(fd.get('termsAccepted')).toBe('true');
    expect(fd.get('CERTIDAO_COMERCIAL')).toBe(certidao);
    // Campos da apólice NÃO vão para um cadastro CLIENTE.
    expect(fd.has('insurer')).toBeFalse();
    req.flush({ id: 'c1', name: 'Empresa X' });
  });

  it('register() inclui os campos da apólice só para FORNECEDOR', () => {
    service.register(corpo({ type: 'FORNECEDOR', insurer: 'Seguradora X', coverageAmount: '1000' }), {}).subscribe();

    const req = http.expectOne({ url: '/api/companies/register', method: 'POST' });
    const fd = req.request.body as FormData;
    expect(fd.get('insurer')).toBe('Seguradora X');
    expect(fd.get('coverageAmount')).toBe('1000');
    req.flush({ id: 'c1', name: 'Empresa X' });
  });
});
