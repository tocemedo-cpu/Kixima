import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CatalogImportComponent } from './catalog-import.component';
import { AuthService } from '../../core/services/auth.service';
import { PlansService } from '../../core/services/plans.service';
import { CatalogService } from './catalog.service';
import { PlanoDto } from '../../core/models/plan.model';
import { KiximaUser } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(companyPlan: string | null = 'BASE'): KiximaUser {
  return { id: 'u1', name: 'Duarte', email: 'd@a.co', role: 'FORNECEDOR', adminAreas: [], companyId: 'c1', companyType: 'FORNECEDOR', avatarUrl: null, companyPlan };
}

function plano(nome: 'BASE' | 'CORE' | 'PRO', carregamentoEmMassa: boolean): PlanoDto {
  return {
    plano: nome,
    preco: { valorUsd: 0, periodo: 'mensal', meses: 1, porMesUsd: 0 },
    features: {
      itensNoCatalogo: null, posicaoNaPesquisa: 0, selo: false, lugaresIncluidos: null, kits: false,
      carregamentoEmMassa, documentosPorItem: 1, imagensPorItem: 3, cotacoesPorMes: null, historicoRelatoriosMeses: null,
      frameworkContracts: false, erpIntegration: false, relatorioConteudoLocal: false, apiCatalogo: false,
      supplierComparison: false, auditTrail: false, categoryManagement: false,
    },
  };
}

describe('CatalogImportComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let plansService: jasmine.SpyObj<PlansService>;
  let catalogService: jasmine.SpyObj<CatalogService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    plansService = jasmine.createSpyObj<PlansService>('PlansService', ['planos']);
    catalogService = jasmine.createSpyObj<CatalogService>('CatalogService', ['importCatalog']);
    auth.user.and.returnValue(utilizador());
    TestBed.configureTestingModule({});
  });

  function montar(): CatalogImportComponent {
    return TestBed.runInInjectionContext(() => new CatalogImportComponent(auth, plansService, catalogService));
  }

  it('semAcesso() é true quando o plano actual não inclui carregamento em massa', () => {
    plansService.planos.and.returnValue(of({ planos: [plano('BASE', false)], taxaPorTransacao: { porOrdemUsd: 0, porFaturaUsd: 0, limiarUsd: 0, percentagemAcima: 0 } }));
    const c = montar();

    expect(c.semAcesso()).toBeTrue();
  });

  it('semAcesso() é false quando o plano inclui carregamento em massa', () => {
    auth.user.and.returnValue(utilizador('PRO'));
    plansService.planos.and.returnValue(of({ planos: [plano('PRO', true)], taxaPorTransacao: { porOrdemUsd: 0, porFaturaUsd: 0, limiarUsd: 0, percentagemAcima: 0 } }));
    const c = montar();

    expect(c.semAcesso()).toBeFalse();
  });

  it('handleSubmit() exige um ficheiro escolhido', fakeAsync(() => {
    plansService.planos.and.returnValue(of({ planos: [], taxaPorTransacao: { porOrdemUsd: 0, porFaturaUsd: 0, limiarUsd: 0, percentagemAcima: 0 } }));
    const c = montar();

    c.handleSubmit();
    flushMicrotasks();

    expect(c.error()).toBe('Escolha um ficheiro Excel (.xlsx).');
    expect(catalogService.importCatalog).not.toHaveBeenCalled();
  }));

  it('handleSubmit() envia o ficheiro e mostra o resultado', fakeAsync(() => {
    plansService.planos.and.returnValue(of({ planos: [], taxaPorTransacao: { porOrdemUsd: 0, porFaturaUsd: 0, limiarUsd: 0, percentagemAcima: 0 } }));
    const resultado = { total: 5, created: 3, updated: 2, withImages: 1, warnings: [], errors: [] };
    catalogService.importCatalog.and.returnValue(of(resultado));
    const c = montar();
    const ficheiro = new File(['x'], 'catalogo.xlsx');
    c.onFileChange({ target: { files: [ficheiro] } } as unknown as Event);

    c.handleSubmit();
    flushMicrotasks();

    expect(catalogService.importCatalog).toHaveBeenCalledWith(ficheiro);
    expect(c.result()).toEqual(resultado);
  }));

  it('handleSubmit() regista o erro (objecto ApiError, não só a mensagem) quando o plano é insuficiente', fakeAsync(() => {
    plansService.planos.and.returnValue(of({ planos: [], taxaPorTransacao: { porOrdemUsd: 0, porFaturaUsd: 0, limiarUsd: 0, percentagemAcima: 0 } }));
    const erro = new ApiError('Precisa do plano PRO', 400, 'PLANO_INSUFICIENTE');
    catalogService.importCatalog.and.returnValue(throwError(() => erro));
    const c = montar();
    c.onFileChange({ target: { files: [new File(['x'], 'catalogo.xlsx')] } } as unknown as Event);

    c.handleSubmit();
    flushMicrotasks();

    expect(c.error()).toBe(erro);
  }));
});
