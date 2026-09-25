// Porta de frontend/src/pages/shared/Register.jsx.
import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RegisterService } from './register.service';
import { RegisterCompanyBody, RegisteredCompany } from '../../core/models/company.model';
import { ApiError } from '../../core/models/api-error.model';
import { AuthHeroComponent } from '../../shared/components/auth-hero.component';
import { FieldComponent } from '../../shared/components/field.component';

interface RequiredDoc {
  type: string;
  label: string;
}

// Documentos obrigatórios por tipo — tem de espelhar o backend (utils/schemas.js).
const REQUIRED_DOCS: Record<string, RequiredDoc[]> = {
  CLIENTE: [
    { type: 'CERTIDAO_COMERCIAL', label: 'Certidão Comercial' },
    { type: 'ALVARA_COMERCIAL', label: 'Alvará Comercial' },
  ],
  FORNECEDOR: [
    { type: 'ALVARA_COMERCIAL', label: 'Alvará Comercial' },
    { type: 'LICENCA_ANPG', label: 'Licença da ANPG' },
    { type: 'CERTIDAO_COMERCIAL', label: 'Certidão Comercial' },
  ],
};

const EMPTY_FORM: RegisterCompanyBody = {
  type: 'CLIENTE', employees: '', annualRevenueUsd: '', name: '', taxId: '', contactEmail: '',
  contactPhone: '', address: '', adminName: '', adminEmail: '', adminPassword: '',
  insurer: '', policyNumber: '', coverageAmount: '', policyCurrency: 'AOA', policyValidFrom: '', policyValidUntil: '',
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, AuthHeroComponent, FieldComponent],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  readonly form = signal<RegisterCompanyBody>(EMPTY_FORM);
  readonly docs = signal<Record<string, File>>({});
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly done = signal<RegisteredCompany | null>(null);
  readonly termsAccepted = signal(false);

  readonly requiredDocs = computed(() => REQUIRED_DOCS[this.form().type] || []);
  readonly isSupplier = computed(() => this.form().type === 'FORNECEDOR');

  constructor(
    route: ActivatedRoute,
    private readonly registerService: RegisterService,
  ) {
    // "Registar como comprador/fornecedor" da home corporativa chega aqui com
    // ?tipo=CLIENTE|FORNECEDOR para pré-selecionar o tipo.
    const tipo = route.snapshot.queryParamMap.get('tipo');
    if (tipo === 'CLIENTE' || tipo === 'FORNECEDOR') {
      this.form.set({ ...EMPTY_FORM, type: tipo });
    }
  }

  update<K extends keyof RegisterCompanyBody>(field: K, value: RegisterCompanyBody[K]): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  onDoc(type: string, evento: Event): void {
    const ficheiro = (evento.target as HTMLInputElement).files?.[0];
    this.docs.update((d) => {
      const next = { ...d };
      if (ficheiro) next[type] = ficheiro;
      else delete next[type];
      return next;
    });
  }

  async submit(): Promise<void> {
    this.error.set('');
    const docsAtual = this.docs();
    const missing = this.requiredDocs().filter((d) => !docsAtual[d.type]);
    if (missing.length) {
      this.error.set(`Anexe os documentos: ${missing.map((d) => d.label).join(', ')}.`);
      return;
    }
    if (this.isSupplier() && !docsAtual['APOLICE_SEGURO']) {
      this.error.set('Anexe o documento da apólice de seguro (Fornecedor→KIXIMA).');
      return;
    }
    if (!this.termsAccepted()) {
      this.error.set('É necessário aceitar os Termos de Uso e a Política de Privacidade.');
      return;
    }

    this.submitting.set(true);
    try {
      const company = await new Promise<RegisteredCompany>((resolve, reject) => {
        this.registerService.register(this.form(), docsAtual).subscribe({ next: resolve, error: reject });
      });
      this.done.set(company);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
    } finally {
      this.submitting.set(false);
    }
  }
}
