import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AvatarUploaderComponent } from './avatar-uploader.component';
import { ProfileService } from '../../features/account/profile.service';
import { UserPublicDto } from '../../core/models/profile.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(overrides: Partial<UserPublicDto> = {}): UserPublicDto {
  return { id: 'u1', name: 'Ana', email: 'a@a.co.ao', role: 'COMPRADOR', avatarUrl: null, companyId: 'c1', createdAt: '2026-01-01', ...overrides };
}

function montar() {
  const profileService = jasmine.createSpyObj<ProfileService>('ProfileService', ['uploadAvatar', 'removeAvatar']);
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new AvatarUploaderComponent(profileService));
  componente.name = 'Ana Comprador';
  return { componente, profileService };
}

describe('AvatarUploaderComponent', () => {
  it('initials extrai as iniciais das duas primeiras palavras do nome', () => {
    const { componente } = montar();
    expect(componente.initials).toBe('AC');
  });

  it('toggleMenu() alterna a visibilidade do menu', () => {
    const { componente } = montar();
    componente.toggleMenu();
    expect(componente.menu()).toBeTrue();
    componente.toggleMenu();
    expect(componente.menu()).toBeFalse();
  });

  it('onPick() envia o ficheiro seleccionado e emite o novo avatarUrl', () => {
    const { componente, profileService } = montar();
    profileService.uploadAvatar.and.returnValue(of(utilizador({ avatarUrl: 'https://cdn/foto.png' })));
    const emitidos: (string | null)[] = [];
    componente.avatarChange.subscribe((v) => emitidos.push(v));
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    componente.onPick({ target: input } as unknown as Event);
    expect(profileService.uploadAvatar).toHaveBeenCalledWith(file);
    expect(emitidos).toEqual(['https://cdn/foto.png']);
    expect(componente.busy()).toBeFalse();
  });

  it('onPick() regista o erro quando o envio falha', () => {
    const { componente, profileService } = montar();
    profileService.uploadAvatar.and.returnValue(throwError(() => new ApiError('Imagem inválida.', 422)));
    const file = new File(['x'], 'foto.txt', { type: 'text/plain' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    componente.onPick({ target: input } as unknown as Event);
    expect(componente.error()).toBe('Imagem inválida.');
  });

  it('remover() chama removeAvatar() e emite o avatarUrl (null)', () => {
    const { componente, profileService } = montar();
    profileService.removeAvatar.and.returnValue(of(utilizador({ avatarUrl: null })));
    const emitidos: (string | null)[] = [];
    componente.avatarChange.subscribe((v) => emitidos.push(v));
    componente.remover();
    expect(profileService.removeAvatar).toHaveBeenCalled();
    expect(emitidos).toEqual([null]);
  });

  it('ngOnDestroy() pára a câmera se estiver activa', () => {
    const { componente } = montar();
    const track = jasmine.createSpyObj('track', ['stop']);
    (componente as unknown as { stream: MediaStream }).stream = { getTracks: () => [track] } as unknown as MediaStream;
    componente.ngOnDestroy();
    expect(track.stop).toHaveBeenCalled();
  });
});
