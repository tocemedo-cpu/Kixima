// Casca de layout para as rotas autenticadas. Versão inicial e deliberadamente
// simples — o AppLayout original (frontend/src/components/AppLayout.jsx) tem
// uma barra lateral completa por persona (ver frontend/src/data/sidebar.js)
// que ainda não foi portada; ver docs/migracao-angular/PLANO.md. O que aqui
// existe já cobre o essencial pedido: mostrar quem está autenticado, permitir
// sair, e reproduzir o estado de "sessão indeterminada" do RequireAuth
// original (frontend/src/auth/RequireAuth.jsx) — nunca expulsa alguém para o
// login só porque um pedido falhou por 429/rede.
import { Component } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LogoComponent } from '../../shared/components/logo.component';
import { TemaSelectorComponent } from '../../shared/tema/tema-selector.component';
import { ROLE_LABELS } from '../../shared/domain';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, LogoComponent, TemaSelectorComponent],
  template: `
    @if (auth.loading()) {
      <div class="loading-text">A verificar sessão…</div>
    } @else if (!auth.user() && auth.sessaoIndeterminada()) {
      <div class="loading-text">
        <p>Não foi possível confirmar a sua sessão. A ligação ao servidor falhou.</p>
        <button type="button" class="btn btn-accent" (click)="auth.loadMe()">Tentar de novo</button>
      </div>
    } @else {
      <div class="shell-min">
        <header class="navbar">
          <a routerLink="/" style="display:flex;align-items:center;text-decoration:none;color:inherit">
            <app-logo [size]="16"></app-logo>
          </a>
          <div style="display:flex;align-items:center;gap:14px">
            @if (auth.user(); as user) {
              <span class="helptext">{{ user.name }} · {{ roleLabel(user.role) }}</span>
            }
            <app-tema-selector [compacto]="true"></app-tema-selector>
            <button type="button" class="btn btn-ghost btn-sm" (click)="sair()">Sair</button>
          </div>
        </header>
        <main class="shell-min-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    }
  `,
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  constructor(
    readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  roleLabel(role: keyof typeof ROLE_LABELS): string {
    return ROLE_LABELS[role];
  }

  async sair(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
