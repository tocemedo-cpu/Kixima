import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AddonsService } from './addons.service';

describe('AddonsService', () => {
  let service: AddonsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AddonsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('catalogo() chama GET /api/addons/catalogo', () => {
    service.catalogo().subscribe();
    const req = http.expectOne('/api/addons/catalogo');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('fila() chama GET /api/addons/fila', () => {
    service.fila().subscribe();
    const req = http.expectOne('/api/addons/fila');
    expect(req.request.method).toBe('GET');
    req.flush({ emAberto: [], porConfirmar: 0, porPagar: 0 });
  });

  it('confirmar() chama POST /api/addons/:id/confirmar', () => {
    service.confirmar('a1', { notas: 'ok' }).subscribe();
    const req = http.expectOne('/api/addons/a1/confirmar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ notas: 'ok' });
    req.flush({});
  });

  it('cancelar() chama POST /api/addons/:id/cancelar', () => {
    service.cancelar('a1', { motivo: 'Pedido por engano' }).subscribe();
    const req = http.expectOne('/api/addons/a1/cancelar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'Pedido por engano' });
    req.flush({});
  });
});
