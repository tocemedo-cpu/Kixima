// Porta de BankDetailsPanel em frontend/src/pages/companyAdmin/Organization.jsx:16-74.
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { OrganizationService } from './organization.service';
import { BankDetails } from '../../core/models/bank-details.model';
import { ApiError } from '../../core/models/api-error.model';
import { FieldComponent } from '../../shared/components/field.component';

@Component({
  selector: 'app-bank-details-panel',
  standalone: true,
  imports: [FieldComponent],
  templateUrl: './bank-details-panel.component.html',
})
export class BankDetailsPanelComponent implements OnChanges {
  @Input({ required: true }) companyId!: string;

  bank: BankDetails | null = null;
  saving = false;
  msg: { ok: boolean; text: string } | null = null;

  constructor(private readonly organizationService: OrganizationService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['companyId']) {
      this.organizationService.getBankDetails(this.companyId).subscribe({
        next: (b) => (this.bank = { bankName: b.bankName || '', iban: b.iban || '', swift: b.swift || '' }),
        error: () => (this.bank = null),
      });
    }
  }

  update(field: keyof BankDetails, value: string): void {
    if (!this.bank) return;
    this.bank = { ...this.bank, [field]: value };
  }

  async save(): Promise<void> {
    if (!this.bank) return;
    this.saving = true;
    this.msg = null;
    try {
      await new Promise<void>((resolve, reject) => {
        this.organizationService.setBankDetails(this.companyId, this.bank!).subscribe({ next: () => resolve(), error: (e) => reject(e) });
      });
      this.msg = { ok: true, text: 'Dados bancários guardados — passam a aparecer nas faturas.' };
    } catch (e) {
      this.msg = { ok: false, text: e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.' };
    } finally {
      this.saving = false;
    }
  }
}
