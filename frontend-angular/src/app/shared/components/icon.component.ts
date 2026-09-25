// Porta PARCIAL de frontend/src/components/icons.jsx (Icon + PATHS). Só os
// glifos usados pelos ecrãs já migrados foram portados até agora — os
// restantes (o ficheiro original tem largas dezenas) ficam para quando os
// ecrãs que os usam forem migrados (ver docs/migracao-angular/PLANO.md).
// Um nome sem path definido cai em 'box', tal como no original.
import { Component, Input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const P = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

const PATHS: Record<string, string> = {
  policy: `<g ${P}><path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" /><path d="m9 12 2 2 4-4" /></g>`,
  certification: `<g ${P}><circle cx="12" cy="9" r="5" /><path d="m9 13-1.5 8L12 19l4.5 2L15 13" /><path d="m10 9 1.5 1.5L14 8" /></g>`,
  chart: `<g ${P}><path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></g>`,
  approvals: `<g ${P}><path d="M4 5h16v12H4z" /><path d="m8 11 2.5 2.5L16 8" /></g>`,
  box: `<g ${P}><path d="M3 8v8l9 5 9-5V8l-9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></g>`,
};

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" aria-hidden="true" [innerHTML]="body"></svg>`,
})
export class IconComponent {
  @Input({ required: true }) name = 'box';
  @Input() size = 18;

  constructor(private readonly sanitizer: DomSanitizer) {}

  get body(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(PATHS[this.name] || PATHS['box']);
  }
}
