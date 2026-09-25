import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() chama GET /api/catalog com o filtro como query params', () => {
    service.list({ supplierId: 'c1' }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/catalog');
    expect(req.request.params.get('supplierId')).toBe('c1');
    req.flush([]);
  });

  it('get() chama GET /api/catalog/:id', () => {
    service.get('p1').subscribe();
    const req = http.expectOne('/api/catalog/p1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('create() chama POST /api/catalog com o FormData tal como recebido', () => {
    const fd = new FormData();
    fd.append('name', 'Válvula');
    service.create(fd).subscribe();
    const req = http.expectOne('/api/catalog');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(fd);
    req.flush({});
  });

  it('update() chama PUT /api/catalog/:id em JSON', () => {
    service.update('p1', { name: 'Novo nome' }).subscribe();
    const req = http.expectOne('/api/catalog/p1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'Novo nome' });
    req.flush({});
  });

  it('addMedia() chama POST /api/catalog/:id/media com FormData', () => {
    const fd = new FormData();
    service.addMedia('p1', fd).subscribe();
    const req = http.expectOne('/api/catalog/p1/media');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(fd);
    req.flush({});
  });

  it('uploadImage() chama POST /api/catalog/:id/image com o campo "image"', () => {
    const file = new File(['x'], 'capa.png', { type: 'image/png' });
    service.uploadImage('p1', file).subscribe();
    const req = http.expectOne('/api/catalog/p1/image');
    expect(req.request.method).toBe('POST');
    const fd = req.request.body as FormData;
    expect(fd.get('image')).toBe(file);
    req.flush({});
  });

  it('removeImage() chama DELETE /api/catalog/:id/images/:imageId', () => {
    service.removeImage('p1', 'i1').subscribe();
    const req = http.expectOne('/api/catalog/p1/images/i1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ id: 'i1', removida: true });
  });

  it('removeDocument() chama DELETE /api/catalog/:id/documents/:docId', () => {
    service.removeDocument('p1', 'd1').subscribe();
    const req = http.expectOne('/api/catalog/p1/documents/d1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ id: 'd1', removido: true });
  });

  it('deactivate() chama DELETE /api/catalog/:id', () => {
    service.deactivate('p1').subscribe();
    const req = http.expectOne('/api/catalog/p1');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
