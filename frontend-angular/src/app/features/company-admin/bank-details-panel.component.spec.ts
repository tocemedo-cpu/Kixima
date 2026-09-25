import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { of, throwError } from 'rxjs';
import { BankDetailsPanelComponent } from './bank-details-panel.component';
import { OrganizationService } from './organization.service';
import { BankDetails } from '../../core/models/bank-details.model';
import { ApiError } from '../../core/models/api-error.model';

describe('BankDetailsPanelComponent', () => {
  let organizationService: jasmine.SpyObj<OrganizationService>;

  beforeEach(() => {
    organizationService = jasmine.createSpyObj<OrganizationService>('OrganizationService', ['getBankDetails', 'setBankDetails']);
    TestBed.configureTestingModule({});
  });

  function montar(): BankDetailsPanelComponent {
    return TestBed.runInInjectionContext(() => new BankDetailsPanelComponent(organizationService));
  }

  it('ngOnChanges carrega os dados bancários e substitui null por string vazia', () => {
    const bank: BankDetails = { bankName: 'BFA', iban: null, swift: null };
    organizationService.getBankDetails.and.returnValue(of(bank));
    const c = montar();
    c.companyId = 'c1';

    c.ngOnChanges({ companyId: new SimpleChange(undefined, 'c1', true) });

    expect(organizationService.getBankDetails).toHaveBeenCalledWith('c1');
    expect(c.bank).toEqual({ bankName: 'BFA', iban: '', swift: '' });
  });

  it('quando o pedido inicial falha, o painel fica escondido (bank=null)', () => {
    organizationService.getBankDetails.and.returnValue(throwError(() => new ApiError('Sem acesso', 403)));
    const c = montar();
    c.companyId = 'c1';

    c.ngOnChanges({ companyId: new SimpleChange(undefined, 'c1', true) });

    expect(c.bank).toBeNull();
  });

  it('save() chama o serviço e mostra a mensagem de sucesso', fakeAsync(() => {
    organizationService.getBankDetails.and.returnValue(of({ bankName: '', iban: '', swift: '' }));
    organizationService.setBankDetails.and.returnValue(of({ bankName: 'BFA', iban: 'AO06', swift: 'BFMXAOLU' }));
    const c = montar();
    c.companyId = 'c1';
    c.ngOnChanges({ companyId: new SimpleChange(undefined, 'c1', true) });
    c.update('bankName', 'BFA');

    c.save();
    flushMicrotasks();

    expect(organizationService.setBankDetails).toHaveBeenCalledWith('c1', { bankName: 'BFA', iban: '', swift: '' });
    expect(c.msg?.ok).toBeTrue();
    expect(c.saving).toBeFalse();
  }));

  it('save() regista o erro quando o servidor recusa', fakeAsync(() => {
    organizationService.getBankDetails.and.returnValue(of({ bankName: '', iban: '', swift: '' }));
    organizationService.setBankDetails.and.returnValue(throwError(() => new ApiError('IBAN inválido', 400)));
    const c = montar();
    c.companyId = 'c1';
    c.ngOnChanges({ companyId: new SimpleChange(undefined, 'c1', true) });

    c.save();
    flushMicrotasks();

    expect(c.msg?.ok).toBeFalse();
    expect(c.msg?.text).toBe('IBAN inválido');
  }));
});
