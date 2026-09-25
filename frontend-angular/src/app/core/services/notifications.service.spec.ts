import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(NotificationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() chama GET /api/notifications', () => {
    service.list().subscribe();
    const req = http.expectOne((r) => r.url === '/api/notifications');
    expect(req.request.method).toBe('GET');
    req.flush({ itens: [], total: 0, pagina: 1, porPagina: 20, paginas: 0, porLer: 0 });
  });
});
