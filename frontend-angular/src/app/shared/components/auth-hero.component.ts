// Porta de frontend/src/components/AuthHero.jsx. A tradução (t()) ainda não
// foi portada (ver shared/domain.ts) — os textos ficam em português, a
// língua-fonte do dicionário original.
import { Component } from '@angular/core';
import { LogoComponent } from './logo.component';
import { IconComponent } from './icon.component';

interface Feature {
  icon: string;
  label: string;
}

const FEATURES: Feature[] = [
  { icon: 'policy', label: 'Transparência total' },
  { icon: 'certification', label: 'Conformidade garantida' },
  { icon: 'chart', label: 'Processos eficientes' },
  { icon: 'approvals', label: 'Rede qualificada e verificada' },
];

@Component({
  selector: 'app-auth-hero',
  standalone: true,
  imports: [LogoComponent, IconComponent],
  template: `
    <div class="login-hero auth-hero">
      <div class="auth-hero-top">
        <app-logo [size]="30" [mark]="64" [subtitle]="true" [light]="true"></app-logo>
      </div>
      <div class="auth-hero-mid">
        <h1 class="auth-hero-title">Due diligence uma vez. <span class="accent">Confiança em cada transação.</span></h1>
        <p class="auth-hero-sub">Conectamos operadoras, fornecedores e prestadores de serviços num ecossistema seguro, transparente e auditável.</p>
      </div>
      <div class="auth-hero-feats">
        @for (f of features; track f.label) {
          <div class="auth-feat">
            <span class="auth-feat-ico"><app-icon [name]="f.icon" [size]="20"></app-icon></span>
            <span class="auth-feat-label">{{ f.label }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class AuthHeroComponent {
  readonly features = FEATURES;
}
