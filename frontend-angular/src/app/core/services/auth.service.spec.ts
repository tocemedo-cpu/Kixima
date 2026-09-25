import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AuthService } from './auth.service';
import { SessionMarkerService } from './session-marker.service';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { KiximaUser, SessionResponse } from '../models/user.model';

const USER: KiximaUser = {
  id: 'u1', name: 'Ana', email: 'ana@empresa.co.ao', role: 'COMPRADOR',
  adminAreas: [], companyId: 'c1', companyName: 'Empresa Lda', companyType: 'CLIENTE', avatarUrl: null,
};

describe('AuthService', () => {
  let http: HttpTestingController;
  let sessionMarker: SessionMarkerService;

  function criar(): AuthService {
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    sessionMarker = TestBed.inject(SessionMarkerService);
  });

  afterEach(() => http.verify());

  it('não pergunta /api/auth/me sem a marca de sessão local', () => {
    spyOn(sessionMarker, 'temSessao').and.returnValue(false);
    const auth = criar();
    http.expectNone('/api/auth/me');
    expect(auth.loading()).toBeFalse();
    expect(auth.user()).toBeNull();
  });

  it('carrega o utilizador quando a marca de sessão existe e /me responde 200', fakeAsync(() => {
    spyOn(sessionMarker, 'temSessao').and.returnValue(true);
    const auth = criar();
    http.expectOne('/api/auth/me').flush({ user: USER });
    flushMicrotasks();
    expect(auth.user()).toEqual(USER);
    expect(auth.loading()).toBeFalse();
  }));

  it('um 401 em /me limpa a marca de sessão e não fica "indeterminada"', fakeAsync(() => {
    spyOn(sessionMarker, 'temSessao').and.returnValue(true);
    const marcar = spyOn(sessionMarker, 'marcarSessao');
    const auth = criar();
    http.expectOne('/api/auth/me').flush({ error: { message: 'Sessão expirada.' } }, { status: 401, statusText: 'Unauthorized' });
    flushMicrotasks();
    expect(auth.user()).toBeNull();
    expect(auth.sessaoIndeterminada()).toBeFalse();
    expect(marcar).toHaveBeenCalledWith(false);
  }));

  it('login guarda a sessão e devolve o utilizador quando não há 2FA', async () => {
    spyOn(sessionMarker, 'temSessao').and.returnValue(false);
    const marcar = spyOn(sessionMarker, 'marcarSessao');
    const auth = criar();

    const resposta: SessionResponse = { token: 'jwt', mfaPendente: false, mfaRestrita: false, mfaPrazo: null, user: USER };
    const promessa = auth.login('ana@empresa.co.ao', 'senha123');
    http.expectOne('/api/auth/login').flush(resposta);
    const resultado = await promessa;

    expect(marcar).toHaveBeenCalledWith(true);
    expect(auth.user()?.id).toBe('u1');
    expect((resultado as SessionResponse).user.id).toBe('u1');
  });

  it('login com 2FA devolve o desafio sem abrir sessão', async () => {
    spyOn(sessionMarker, 'temSessao').and.returnValue(false);
    const marcar = spyOn(sessionMarker, 'marcarSessao');
    const auth = criar();

    const promessa = auth.login('ana@empresa.co.ao', 'senha123');
    http.expectOne('/api/auth/login').flush({ requires2fa: true, metodo: 'TOTP', challenge: 'chal-1' });
    const resultado = await promessa;

    expect(marcar).not.toHaveBeenCalled();
    expect(auth.user()).toBeNull();
    expect((resultado as { requires2fa: boolean }).requires2fa).toBeTrue();
  });

  it('logout limpa o utilizador mesmo que o pedido ao servidor falhe', async () => {
    spyOn(sessionMarker, 'temSessao').and.returnValue(false);
    const auth = criar();
    const promessa = auth.logout();
    http.expectOne('/api/auth/logout').flush(null, { status: 500, statusText: 'Erro' });
    await promessa;
    expect(auth.user()).toBeNull();
  });
});
