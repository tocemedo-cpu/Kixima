import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from './error.interceptor';
import { ApiError } from '../models/api-error.model';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpCtrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpCtrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpCtrl.verify());

  it('transforma o envelope { error: { code, message } } do backend num ApiError', (done) => {
    http.get('/api/quotes/123').subscribe({
      error: (err: unknown) => {
        expect(err instanceof ApiError).toBeTrue();
        const apiError = err as ApiError;
        expect(apiError.message).toBe('Pedido de cotação não encontrado.');
        expect(apiError.code).toBe('NOT_FOUND');
        expect(apiError.status).toBe(404);
        done();
      },
    });
    httpCtrl.expectOne('/api/quotes/123').flush(
      { error: { code: 'NOT_FOUND', message: 'Pedido de cotação não encontrado.' } },
      { status: 404, statusText: 'Not Found' },
    );
  });

  it('usa uma mensagem por omissão quando o corpo não tem o envelope esperado', (done) => {
    http.get('/api/quotes').subscribe({
      error: (err: unknown) => {
        expect((err as ApiError).message).toBe('Erro 500 ao contactar a API.');
        done();
      },
    });
    httpCtrl.expectOne('/api/quotes').flush(null, { status: 500, statusText: 'Erro' });
  });
});
