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
  contract: `<g ${P}><path d="M6 3h9l3 3v15H6z" /><path d="M9 9h6M9 13h6M9 17h4" /></g>`,
  history: `<g ${P}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4M12 7v5l3 2" /></g>`,
  help: `<g ${P}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3" /><path d="M12 17h.01" /></g>`,
  wallet: `<g ${P}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 14h2" /></g>`,
  offshore: `<g ${P}><path d="M12 3v18M5 8l7-5 7 5" /><circle cx="12" cy="14" r="3" /><path d="M3 21h18" /></g>`,
  box: `<g ${P}><path d="M3 8v8l9 5 9-5V8l-9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></g>`,
  search: `<g ${P}><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></g>`,
  catalog: `<g ${P}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></g>`,
  orders: `<g ${P}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></g>`,
  checkout: `<g ${P}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M2 10h20" /></g>`,
  payment: `<g ${P}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></g>`,
  truck: `<g ${P}><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></g>`,
  reception: `<g ${P}><path d="m9 12 2 2 4-4" /><rect x="4" y="4" width="16" height="16" rx="2" /></g>`,
  invoice: `<g ${P}><path d="M6 2h9l3 3v17l-2.5-1.5L13 22l-2.5-1.5L8 22l-2.5-1.5L6 22z" /><path d="M9 8h6M9 12h6" /></g>`,
  shield: `<g ${P}><path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" /></g>`,
  report: `<g ${P}><path d="M6 2h9l3 3v17H6z" /><path d="M9 13l2 2 4-4M9 8h6" /></g>`,
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
