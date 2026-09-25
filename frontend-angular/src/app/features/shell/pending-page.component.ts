// Página honesta para uma rota que ainda não foi migrada do React para
// Angular. Nunca finge conteúdo que não existe — diz claramente que a
// funcionalidade continua a funcionar hoje no frontend React (frontend/),
// e onde consultar o plano de migração.
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-pending-page',
  standalone: true,
  template: `
    <div class="card card-pad" style="max-width:560px;margin:40px auto;text-align:center">
      <h2 style="margin-top:0">{{ titulo }}</h2>
      <p class="helptext">
        Este ecrã ainda não foi migrado para Angular nesta fase. Continua
        disponível e a funcionar normalmente no frontend actual (React), sem
        qualquer perda de funcionalidade.
      </p>
      <p class="helptext">Ver <code>docs/migracao-angular/PLANO.md</code> para a ordem de migração prevista.</p>
    </div>
  `,
})
export class PendingPageComponent {
  @Input() titulo = 'Em migração';
}
