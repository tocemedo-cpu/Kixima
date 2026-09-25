import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TeamService } from './team.service';

describe('TeamService', () => {
  let service: TeamService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TeamService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listUsers() chama GET /api/companies/users', () => {
    service.listUsers().subscribe();
    http.expectOne({ url: '/api/companies/users', method: 'GET' }).flush([]);
  });

  it('listInvites() chama GET /api/companies/invites', () => {
    service.listInvites().subscribe();
    http.expectOne({ url: '/api/companies/invites', method: 'GET' }).flush([]);
  });

  it('createInvite() envia POST /api/companies/invites com o corpo exacto', () => {
    const body = { role: 'COMPRADOR', name: 'Ana', email: 'ana@a.co' };
    service.createInvite(body).subscribe();
    const req = http.expectOne({ url: '/api/companies/invites', method: 'POST' });
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('resendInvite() e cancelInvite() chamam os endpoints correctos', () => {
    service.resendInvite('inv1').subscribe();
    http.expectOne({ url: '/api/companies/invites/inv1/resend', method: 'POST' }).flush({});

    service.cancelInvite('inv1').subscribe();
    http.expectOne({ url: '/api/companies/invites/inv1/cancel', method: 'POST' }).flush({});
  });

  it('activateUser() e removeUser() chamam os endpoints correctos', () => {
    service.activateUser('u1').subscribe();
    http.expectOne({ url: '/api/companies/users/u1/activate', method: 'PATCH' }).flush({});

    service.removeUser('u1').subscribe();
    http.expectOne({ url: '/api/companies/users/u1', method: 'DELETE' }).flush({});
  });
});
