import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AssinaturaService } from './assinatura.service';

describe('AssinaturaService', () => {
  let service: AssinaturaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AssinaturaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('estado() chama GET /api/assinatura', () => {
    service.estado().subscribe();
    const req = http.expectOne('/api/assinatura');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('canais() chama GET /api/assinatura/canais', () => {
    service.canais().subscribe();
    const req = http.expectOne('/api/assinatura/canais');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('pedir() chama POST /api/assinatura/pedir', () => {
    service.pedir({ plano: 'CORE', aceitaPerdas: true }).subscribe();
    const req = http.expectOne('/api/assinatura/pedir');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ plano: 'CORE', aceitaPerdas: true });
    req.flush({});
  });

  it('pagarCom() chama POST /api/assinatura/:id/pagar-com', () => {
    service.pagarCom('c1', { canal: 'EMIS_MULTICAIXA', telemovel: '923456789' }).subscribe();
    const req = http.expectOne('/api/assinatura/c1/pagar-com');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ canal: 'EMIS_MULTICAIXA', telemovel: '923456789' });
    req.flush({});
  });

  it('comprovativo() chama POST /api/assinatura/:id/comprovativo com o campo "comprovativo"', () => {
    const ficheiro = new File(['x'], 'comprovativo.pdf', { type: 'application/pdf' });
    service.comprovativo('c1', ficheiro).subscribe();
    const req = http.expectOne('/api/assinatura/c1/comprovativo');
    expect(req.request.method).toBe('POST');
    const fd = req.request.body as FormData;
    expect(fd.get('comprovativo')).toBe(ficheiro);
    req.flush({});
  });

  it('cancelar() chama POST /api/assinatura/:id/cancelar', () => {
    service.cancelar('c1', { motivo: 'Pedido por engano' }).subscribe();
    const req = http.expectOne('/api/assinatura/c1/cancelar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'Pedido por engano' });
    req.flush({});
  });

  it('fila() chama GET /api/assinatura/fila', () => {
    service.fila().subscribe();
    const req = http.expectOne('/api/assinatura/fila');
    expect(req.request.method).toBe('GET');
    req.flush({ emAberto: [], vencidas: [], emGrace: [], restritas: [], porConfirmar: 0, porPagar: 0 });
  });

  it('confirmar() chama POST /api/assinatura/:id/confirmar com notas', () => {
    service.confirmar('c1', { notas: 'Confirmado via BAI' }).subscribe();
    const req = http.expectOne('/api/assinatura/c1/confirmar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ notas: 'Confirmado via BAI' });
    req.flush({});
  });

  it('confirmar() envia corpo vazio quando não há notas', () => {
    service.confirmar('c1').subscribe();
    const req = http.expectOne('/api/assinatura/c1/confirmar');
    expect(req.request.body).toEqual({});
    req.flush({});
  });
});
