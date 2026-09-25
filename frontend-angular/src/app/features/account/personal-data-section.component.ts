// Porta da secção DadosPessoaisSection de frontend/src/pages/shared/Security.jsx.
// Direitos do titular dos dados (Lei 22/11): aceder e pedir eliminação.
import { Component, signal } from '@angular/core';
import { SecurityService } from './security.service';
import { ResultadoAnonimizacao } from '../../core/models/security.model';
import { ApiError } from '../../core/models/api-error.model';
import { FieldComponent } from '../../shared/components/field.component';

@Component({
  selector: 'app-personal-data-section',
  standalone: true,
  imports: [FieldComponent],
  templateUrl: './personal-data-section.component.html',
})
export class PersonalDataSectionComponent {
  readonly aExportar = signal(false);
  readonly confirmar = signal(false);
  readonly senha = signal('');
  readonly erro = signal('');
  readonly feito = signal<ResultadoAnonimizacao | null>(null);

  constructor(private readonly securityService: SecurityService) {}

  exportar(): void {
    this.aExportar.set(true);
    this.erro.set('');
    this.securityService.dadosPessoais().subscribe({
      next: (doc) => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kixima-os-meus-dados.json';
        a.click();
        URL.revokeObjectURL(url);
        this.aExportar.set(false);
      },
      error: (e) => {
        this.erro.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.aExportar.set(false);
      },
    });
  }

  pedirConfirmacao(): void {
    this.confirmar.set(true);
  }

  cancelarConfirmacao(): void {
    this.confirmar.set(false);
    this.senha.set('');
    this.erro.set('');
  }

  anonimizar(): void {
    this.erro.set('');
    this.securityService.anonimizar({ password: this.senha() }).subscribe({
      next: (r) => this.feito.set(r),
      error: (e) => this.erro.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }
}
