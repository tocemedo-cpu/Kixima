// Porta de frontend/src/components/AvatarUploader.jsx. Foto de perfil com
// duas origens: carregar um ficheiro ou capturar pela câmera (getUserMedia).
// Envia para POST /api/users/me/avatar (campo "image") / DELETE mesma rota.
import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, signal } from '@angular/core';
import { ProfileService } from '../../features/account/profile.service';
import { ApiError } from '../../core/models/api-error.model';
import { IconComponent } from './icon.component';

function initials(name = ''): string {
  return (
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?'
  );
}

@Component({
  selector: 'app-avatar-uploader',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './avatar-uploader.component.html',
})
export class AvatarUploaderComponent implements OnDestroy {
  @Input({ required: true }) name = '';
  @Input() avatarUrl: string | null = null;
  @Input() size = 96;
  @Output() readonly avatarChange = new EventEmitter<string | null>();

  @ViewChild('ficheiroInput') ficheiroInput?: ElementRef<HTMLInputElement>;
  @ViewChild('video') video?: ElementRef<HTMLVideoElement>;

  readonly menu = signal(false);
  readonly cam = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  private stream: MediaStream | null = null;

  constructor(private readonly profileService: ProfileService) {}

  get initials(): string {
    return initials(this.name);
  }

  toggleMenu(): void {
    this.menu.update((v) => !v);
  }

  abrirSeletorFicheiro(): void {
    this.ficheiroInput?.nativeElement.click();
  }

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.uploadFile(file);
    input.value = '';
  }

  private uploadFile(file: File): void {
    this.busy.set(true);
    this.error.set('');
    this.profileService.uploadAvatar(file).subscribe({
      next: (user) => {
        this.avatarChange.emit(user.avatarUrl);
        this.busy.set(false);
        this.menu.set(false);
      },
      error: (e) => {
        this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.busy.set(false);
        this.menu.set(false);
      },
    });
  }

  async abrirCamera(): Promise<void> {
    this.menu.set(false);
    this.error.set('');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      this.cam.set(true);
      // O <video> só existe no DOM depois deste set() aplicar — o próximo
      // tick já tem a referência via ViewChild.
      setTimeout(() => {
        if (this.video && this.stream) {
          this.video.nativeElement.srcObject = this.stream;
          this.video.nativeElement.play().catch(() => {});
        }
      });
    } catch {
      this.error.set('Não foi possível aceder à câmera. Verifique as permissões do browser.');
    }
  }

  pararCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.cam.set(false);
  }

  capturar(): void {
    const v = this.video?.nativeElement;
    if (!v) return;
    const canvas = document.createElement('canvas');
    const s = Math.min(v.videoWidth, v.videoHeight);
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, s, s);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], 'camera.jpg', { type: 'image/jpeg' });
          this.uploadFile(file);
        }
        this.pararCamera();
      },
      'image/jpeg',
      0.9,
    );
  }

  remover(): void {
    this.busy.set(true);
    this.profileService.removeAvatar().subscribe({
      next: (user) => {
        this.avatarChange.emit(user.avatarUrl);
        this.busy.set(false);
        this.menu.set(false);
      },
      error: (e) => {
        this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.busy.set(false);
        this.menu.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}
