import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { ProfileService } from './profile.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileResponse } from '../../core/models/profile.model';
import { KiximaUser, PersonaRole } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(role: PersonaRole = 'COMPRADOR'): KiximaUser {
  return { id: 'u1', name: 'Ana', email: 'a@a.co.ao', role, adminAreas: [], companyId: 'c1', companyType: 'CLIENTE', avatarUrl: null };
}

function perfil(overrides: Partial<ProfileResponse> = {}): ProfileResponse {
  return {
    user: { id: 'u1', name: 'Ana', email: 'a@a.co.ao', role: 'COMPRADOR', avatarUrl: null, createdAt: '2026-01-01' },
    company: {
      id: 'c1', name: 'Petro Angola', taxId: 'AO-123', type: 'CLIENTE', status: 'APROVADA',
      contactEmail: 'contacto@petro.co.ao', contactPhone: '923000000', city: 'Luanda', country: 'Angola', verified: true,
    },
    kind: 'buyer',
    cards: [
      { icon: 'orders', tone: 'info', label: 'Ordens de Compra', value: 12, sub: 'Este ano' },
      { icon: 'payment', tone: 'success', label: 'Valor Total Comprado', value: 500000, money: true, sub: 'Este ano' },
    ],
    recent: [{ reference: 'PO-1', party: 'Fornecedora Lda', status: 'CONCLUIDA', at: '2026-01-01' }],
    ...overrides,
  };
}

function montar(role: PersonaRole = 'COMPRADOR') {
  const profileService = jasmine.createSpyObj<ProfileService>('ProfileService', ['profile']);
  profileService.profile.and.returnValue(of(perfil()));
  const auth = jasmine.createSpyObj<AuthService>('AuthService', ['user', 'updateUser']);
  auth.user.and.returnValue(utilizador(role));
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new ProfileComponent(auth, profileService));
  return { componente, profileService, auth };
}

describe('ProfileComponent', () => {
  it('carrega o perfil ao arrancar', () => {
    const { componente } = montar();
    expect(componente.data()?.kind).toBe('buyer');
  });

  it('trail() aponta "Home" para a home da persona actual', () => {
    const { componente } = montar('FORNECEDOR');
    const trail = componente.trail();
    expect(trail[0]).toEqual({ label: 'Home', to: '/fornecedor' });
  });

  it('kpiCards() formata os valores em dinheiro com formatMoney, mantém os outros crus', () => {
    const { componente } = montar();
    const cards = componente.kpiCards();
    expect(cards[0].value).toBe(12);
    expect(typeof cards[1].value).toBe('string');
    expect(cards[1].value as string).toContain('Kz');
  });

  it('localizacao() junta cidade e país, cai em "Angola" sem empresa', () => {
    const { componente } = montar();
    expect(componente.localizacao()).toBe('Luanda, Angola');
  });

  it('setAvatar() actualiza o perfil local e propaga para o AuthService', () => {
    const { componente, auth } = montar();
    componente.setAvatar('https://cdn/avatar.jpg');
    expect(componente.data()?.user.avatarUrl).toBe('https://cdn/avatar.jpg');
    expect(auth.updateUser).toHaveBeenCalledWith({ avatarUrl: 'https://cdn/avatar.jpg' });
  });

  it('regista o erro quando o carregamento falha', () => {
    const profileService = jasmine.createSpyObj<ProfileService>('ProfileService', ['profile']);
    profileService.profile.and.returnValue(throwError(() => new ApiError('Falha ao carregar.', 500)));
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['user', 'updateUser']);
    auth.user.and.returnValue(utilizador());
    TestBed.configureTestingModule({});
    const componente = TestBed.runInInjectionContext(() => new ProfileComponent(auth, profileService));
    expect(componente.error()).toBe('Falha ao carregar.');
  });
});
