// Porta de frontend/src/pages/adminSistema/Contracts.jsx. Gestão de
// contratos-quadro pelo Admin do Sistema — lista os existentes e permite
// criar novos; a partir daí, qualquer PO do cliente para o fornecedor
// coberto passa a ser automaticamente um Call-off. Contratos confirmados
// contra ContractController.java/CreateContractRequest.java por um agente de
// pesquisa dedicado.
import { Component, signal } from '@angular/core';
import { ContractsService } from '../contracts/contracts.service';
import { CompaniesService } from './companies.service';
import { ContractDto, CreateContractBody } from '../../core/models/contract.model';
import { CompanyListItem } from '../../core/models/company.model';
import { ApiError } from '../../core/models/api-error.model';
import { CONTRACT_STATUS, BILLING_PERIODICITY, formatMoney, formatDate } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { FieldComponent } from '../../shared/components/field.component';
import { DataTableComponent } from '../../shared/components/data-table.component';
import { TableColumnDirective } from '../../shared/components/table-column.directive';
import { BadgeComponent } from '../../shared/components/badge.component';

interface FormularioContrato {
  clientCompanyId: string;
  supplierCompanyId: string;
  categoriesCovered: string;
  totalValue: string;
  currency: string;
  billingPeriodicity: string;
  paymentTermDays: string;
  validFrom: string;
  validUntil: string;
}

const EMPTY_FORM: FormularioContrato = {
  clientCompanyId: '',
  supplierCompanyId: '',
  categoriesCovered: '',
  totalValue: '',
  currency: 'AOA',
  billingPeriodicity: 'TRIMESTRAL',
  paymentTermDays: '30',
  validFrom: '',
  validUntil: '',
};

@Component({
  selector: 'app-admin-contracts',
  standalone: true,
  imports: [
    PageHeaderComponent, ErrorBannerComponent, SuccessBannerComponent, LoadingComponent,
    FieldComponent, DataTableComponent, TableColumnDirective, BadgeComponent,
  ],
  templateUrl: './admin-contracts.component.html',
})
export class AdminContractsComponent {
  readonly contracts = signal<ContractDto[] | null>(null);
  readonly clients = signal<CompanyListItem[]>([]);
  readonly suppliers = signal<CompanyListItem[]>([]);
  readonly error = signal('');
  readonly success = signal('');
  readonly showForm = signal(false);
  readonly form = signal<FormularioContrato>({ ...EMPTY_FORM });
  readonly saving = signal(false);

  readonly CONTRACT_STATUS = CONTRACT_STATUS;
  readonly BILLING_PERIODICITY = BILLING_PERIODICITY;
  readonly BILLING_PERIODICITY_KEYS = Object.keys(BILLING_PERIODICITY);
  readonly formatMoney = formatMoney;
  readonly formatDate = formatDate;

  constructor(
    private readonly contractsService: ContractsService,
    private readonly companiesService: CompaniesService,
  ) {
    this.loadContracts();
    // Empresas aprovadas para preencher os selects (cliente/fornecedor).
    this.companiesService.list('APROVADA', 'CLIENTE').subscribe({ next: (l) => this.clients.set(l), error: () => {} });
    this.companiesService.list('APROVADA', 'FORNECEDOR').subscribe({ next: (l) => this.suppliers.set(l), error: () => {} });
  }

  private loadContracts(): void {
    this.contractsService.list().subscribe({
      next: (data) => this.contracts.set(data),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  toggleForm(): void {
    this.showForm.update((v) => !v);
    this.success.set('');
    this.error.set('');
  }

  setCampo(campo: keyof FormularioContrato, valor: string): void {
    this.form.update((f) => ({ ...f, [campo]: valor }));
  }

  submit(): void {
    this.error.set('');
    this.success.set('');
    const f = this.form();

    const categorias = f.categoriesCovered.split(',').map((c) => c.trim()).filter(Boolean);
    if (categorias.length === 0) {
      this.error.set('Indique pelo menos uma categoria coberta pelo contrato.');
      return;
    }

    // As datas do <input type=date> vêm como "YYYY-MM-DD" — o Java exige um
    // instante ISO-8601 completo (ver comentário em contract.model.ts).
    const body: CreateContractBody = {
      clientCompanyId: f.clientCompanyId,
      supplierCompanyId: f.supplierCompanyId,
      categoriesCovered: categorias,
      totalValue: Number(f.totalValue),
      currency: f.currency || 'AOA',
      billingPeriodicity: f.billingPeriodicity as CreateContractBody['billingPeriodicity'],
      paymentTermDays: Number(f.paymentTermDays),
      validFrom: new Date(f.validFrom).toISOString(),
      validUntil: new Date(f.validUntil).toISOString(),
    };

    this.saving.set(true);
    this.contractsService.create(body).subscribe({
      next: (created) => {
        this.success.set(`Contrato ${created.reference} criado. As POs elegíveis passam agora a Call-off.`);
        this.form.set({ ...EMPTY_FORM });
        this.showForm.set(false);
        this.saving.set(false);
        this.loadContracts();
      },
      error: (e) => {
        this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.saving.set(false);
      },
    });
  }

  nomeEmpresa(row: ContractDto, lado: 'client' | 'supplier'): string {
    const company = lado === 'client' ? row.clientCompany : row.supplierCompany;
    return company?.name || '—';
  }

  periodicidadeLabel(row: ContractDto): string {
    return `${row.paymentTermDays} dias · ${BILLING_PERIODICITY[row.billingPeriodicity] || row.billingPeriodicity}`;
  }

  vigenciaLabel(row: ContractDto): string {
    return `${formatDate(row.validFrom)} → ${formatDate(row.validUntil)}`;
  }
}
