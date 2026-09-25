// Porta directa de frontend/src/auth/AuthContext.jsx para Angular (signals no
// lugar de useState/useContext). Mesma lógica de "três estados de sessão"
// (autenticado / não autenticado / indeterminada) e o MESMO motivo para ela
// existir — ver o comentário longo original, reproduzido abaixo.
import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../models/api-error.model';
import { KiximaUser, LoginResponse, SessionResponse, isRequires2fa } from '../models/user.model';
import { ApiService } from './api.service';
import { SessionMarkerService } from './session-marker.service';

const TENTATIVAS = 3;
const ESPERA_MS = [400, 1200];
const dormir = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSignal = signal<KiximaUser | null>(null);
  private readonly loadingSignal = signal(true);
  private readonly sessaoIndeterminadaSignal = signal(false);

  readonly user = computed(() => this.userSignal());
  readonly loading = computed(() => this.loadingSignal());
  readonly sessaoIndeterminada = computed(() => this.sessaoIndeterminadaSignal());

  constructor(
    private readonly api: ApiService,
    private readonly sessionMarker: SessionMarkerService,
  ) {
    void this.loadMe();
  }

  // SÓ UM 401 SIGNIFICA "ESTA SESSÃO NÃO VALE".
  //
  // Antes (no React), qualquer falha caía no mesmo saco: um 429, uma falha de
  // rede, um 500 de meio segundo — todos apagavam a marca e punham a pessoa no
  // ecrã de entrada, como se a sessão tivesse terminado. Reproduzido aqui
  // ponto por ponto: só um 401 explícito desliga a sessão; qualquer outra
  // falha, após 3 tentativas com espera crescente, marca "indeterminada" — o
  // ecrã mostra "tentar de novo", nunca reenvia para o login sem motivo.
  async loadMe(): Promise<void> {
    if (!this.sessionMarker.temSessao()) {
      this.loadingSignal.set(false);
      return;
    }
    this.sessaoIndeterminadaSignal.set(false);

    for (let tentativa = 0; tentativa < TENTATIVAS; tentativa += 1) {
      try {
        const { user } = await firstValueFrom(this.api.get<{ user: KiximaUser }>('/api/auth/me'));
        this.userSignal.set(user);
        this.loadingSignal.set(false);
        return;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          this.sessionMarker.marcarSessao(false);
          this.loadingSignal.set(false);
          return;
        }
        if (tentativa < TENTATIVAS - 1) await dormir(ESPERA_MS[tentativa]);
      }
    }

    this.sessaoIndeterminadaSignal.set(true);
    this.loadingSignal.set(false);
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const result = await firstValueFrom(this.api.post<LoginResponse>('/api/auth/login', { email, password }));
    if (isRequires2fa(result)) return result;
    this.applySession(result);
    return result;
  }

  async verify2fa(challenge: string, code: string): Promise<SessionResponse> {
    const result = await firstValueFrom(
      this.api.post<SessionResponse>('/api/auth/2fa/verify', { challenge, code }),
    );
    this.applySession(result);
    return result;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/api/auth/logout'));
    } catch {
      // Melhor esforço — o mesmo comportamento do React: limpa localmente na mesma.
    }
    this.sessionMarker.marcarSessao(false);
    this.userSignal.set(null);
  }

  updateUser(patch: Partial<KiximaUser>): void {
    const atual = this.userSignal();
    if (atual) this.userSignal.set({ ...atual, ...patch });
  }

  private applySession(result: SessionResponse): void {
    this.sessionMarker.marcarSessao(true);
    this.userSignal.set({ ...result.user, mfaPendente: result.mfaPendente, mfaPrazo: result.mfaPrazo });
  }
}
