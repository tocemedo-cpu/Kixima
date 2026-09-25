import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CatalogManageComponent } from './catalog-manage.component';
import { AuthService } from '../../core/services/auth.service';
import { PlansService } from '../../core/services/plans.service';
import { CatalogService } from './catalog.service';
import { ProductDto } from '../../core/models/product.model';
import { PlanoDto } from '../../core/models/plan.model';
import { KiximaUser } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(companyPlan: string | null = 'BASE'): KiximaUser {
  return { id: 'u1', name: 'Bruno', email: 'b@a.co', role: 'FORNECEDOR', adminAreas: [], companyId: 'c1', companyType: 'FORNECEDOR', avatarUrl: null, companyPlan };
}

function produto(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: 'p1', supplierId: 'c1', name: 'Bomba centrífuga', category: 'Equipamentos Rotativos',
    unitPrice: '1000', currency: 'AOA', kind: 'PRODUTO', certifications: [], tags: [],
    active: true, reviewCount: 0, viewCount: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  };
}

function plano(nome: 'BASE' | 'CORE' | 'PRO', overrides: Partial<PlanoDto['features']> = {}): PlanoDto {
  return {
    plano: nome,
    preco: { valorUsd: 0, periodo: 'mensal', meses: 1, porMesUsd: 0 },
    features: {
      itensNoCatalogo: null, posicaoNaPesquisa: nome === 'BASE' ? 0 : nome === 'CORE' ? 1 : 2, selo: false,
      lugaresIncluidos: null, kits: false, carregamentoEmMassa: false,
      documentosPorItem: 1, imagensPorItem: 3, cotacoesPorMes: null, historicoRelatoriosMeses: null,
      frameworkContracts: false, erpIntegration: false, relatorioConteudoLocal: false, apiCatalogo: false,
      supplierComparison: false, auditTrail: false, categoryManagement: false,
      ...overrides,
    },
  };
}

describe('CatalogManageComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let catalogService: jasmine.SpyObj<CatalogService>;
  let plansService: jasmine.SpyObj<PlansService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    catalogService = jasmine.createSpyObj<CatalogService>('CatalogService', [
      'list', 'get', 'create', 'update', 'addMedia', 'uploadImage', 'removeImage', 'removeDocument', 'deactivate',
    ]);
    plansService = jasmine.createSpyObj<PlansService>('PlansService', ['planos']);
    auth.user.and.returnValue(utilizador());
    catalogService.list.and.returnValue(of([produto()]));
    plansService.planos.and.returnValue(of({ planos: [plano('BASE'), plano('CORE'), plano('PRO')], taxaPorTransacao: { porOrdemUsd: 0, porFaturaUsd: 0, limiarUsd: 0, percentagemAcima: 0 } }));
    TestBed.configureTestingModule({});
  });

  function montar(): CatalogManageComponent {
    return TestBed.runInInjectionContext(() => new CatalogManageComponent(auth, catalogService, plansService));
  }

  it('carrega os produtos do fornecedor autenticado e o plano actual ao arrancar', () => {
    const c = montar();

    expect(catalogService.list).toHaveBeenCalledWith({ supplierId: 'c1' });
    expect(c.products()?.length).toBe(1);
    expect(c.meuPlano()?.plano).toBe('BASE');
  });

  it('filteredProducts() filtra por PRODUTO/SERVICO; contagemPorFiltro() conta correctamente', () => {
    catalogService.list.and.returnValue(of([produto({ id: 'p1', kind: 'PRODUTO' }), produto({ id: 'p2', kind: 'SERVICO' })]));
    const c = montar();

    expect(c.filteredProducts().length).toBe(2);
    c.listFilter.set('SERVICO');
    expect(c.filteredProducts().map((p) => p.id)).toEqual(['p2']);
    expect(c.contagemPorFiltro('PRODUTO')).toBe(1);
    expect(c.contagemPorFiltro('TODOS')).toBe(2);
  });

  it('pickSetor() limpa a categoria; pickItem() preenche nome/tipo/unidade/classificação UNSPSC', () => {
    const c = montar();
    c.categoria.set('lixo');

    c.pickSetor('Bombas e Compressores');
    expect(c.categoria()).toBe('');

    c.pickItem('40151503'); // Bomba centrífuga — Produto
    expect(c.form().name).toBe('Bomba centrífuga');
    expect(c.form().kind).toBe('PRODUTO');
    expect(c.form().unspscCode).toBe('40151503');
    expect(c.form().category).toBe('Equipamentos Rotativos'); // sugerido via SETOR_TO_CATEGORY
  });

  it('novoItem() abre o formulário limpo; cancelar() fecha e reinicia', () => {
    const c = montar();
    c.update('name', 'lixo');

    c.novoItem();
    expect(c.showForm()).toBeTrue();
    expect(c.form().name).toBe('');

    c.update('name', 'outro lixo');
    c.cancelar();
    expect(c.showForm()).toBeFalse();
    expect(c.form().name).toBe('');
  });

  it('handleSubmit() valida campos obrigatórios com salto de aba', () => {
    const c = montar();
    c.novoItem();

    c.handleSubmit();
    expect(c.error()).toBe('Indique o nome do produto.');
    expect(c.tab()).toBe(0);

    c.update('name', 'Válvula');
    c.handleSubmit();
    expect(c.error()).toBe('Indique a categoria.');

    c.update('category', 'Válvulas & Controlo de Fluxo');
    c.handleSubmit();
    expect(c.error()).toBe('Escreva uma descrição curta (aparece nos cartões).');

    c.update('description', 'Válvula esfera 2".');
    c.handleSubmit();
    expect(c.error()).toBe('Indique o preço unitário.');
    expect(c.tab()).toBe(1);
  });

  it('handleSubmit() cria um produto novo por multipart e recarrega a lista', fakeAsync(() => {
    catalogService.create.and.returnValue(of(produto()));
    const c = montar();
    c.novoItem();
    c.update('name', 'Válvula esfera');
    c.update('category', 'Válvulas & Controlo de Fluxo');
    c.update('description', 'Válvula esfera 2".');
    c.update('unitPrice', '500');

    c.handleSubmit();
    flushMicrotasks();

    expect(catalogService.create).toHaveBeenCalledTimes(1);
    const fd = catalogService.create.calls.mostRecent().args[0] as FormData;
    expect(fd.get('name')).toBe('Válvula esfera');
    expect(fd.get('unitPrice')).toBe('500');
    expect(c.success()).toBe('Produto publicado no catálogo com a ficha completa.');
    expect(c.showForm()).toBeFalse();
    expect(catalogService.list).toHaveBeenCalledTimes(2);
  }));

  it('handleSubmit() em edição envia PUT em JSON e não chama create()', fakeAsync(() => {
    catalogService.update.and.returnValue(of(produto()));
    const c = montar();
    c.editingId.set('p1');
    c.update('name', 'Bomba revista');
    c.update('category', 'Equipamentos Rotativos');
    c.update('description', 'Revisão completa.');
    c.update('unitPrice', '900');

    c.handleSubmit();
    flushMicrotasks();

    expect(catalogService.update).toHaveBeenCalledWith('p1', jasmine.objectContaining({ name: 'Bomba revista', unitPrice: '900' }));
    expect(catalogService.create).not.toHaveBeenCalled();
    expect(c.success()).toBe('Alterações guardadas.');
  }));

  it('handleSubmit() regista o erro (objecto ApiError, não só a mensagem) quando o servidor recusa', fakeAsync(() => {
    const erro = new ApiError('Limite de imagens do plano atingido', 403, 'PLANO_INSUFICIENTE');
    catalogService.create.and.returnValue(throwError(() => erro));
    const c = montar();
    c.novoItem();
    c.update('name', 'X');
    c.update('category', 'Outros');
    c.update('description', 'desc');
    c.update('unitPrice', '1');

    c.handleSubmit();
    flushMicrotasks();

    expect(c.error()).toBe(erro);
    expect(c.submitting()).toBeFalse();
  }));

  it('startEdit() busca o produto completo e preenche o formulário, incluindo galeria/documentos', fakeAsync(() => {
    const completo = produto({
      id: 'p1', unspscCode: '40151503', images: [{ id: 'i1', url: 'https://x/1.jpg', isPrimary: true, sortOrder: 0 }],
      documents: [{ id: 'd1', type: 'DATASHEET', fileUrl: 'https://x/d.pdf', originalName: 'ficha.pdf' }],
    });
    catalogService.get.and.returnValue(of(completo));
    const c = montar();

    c.startEdit(produto());
    flushMicrotasks();

    expect(catalogService.get).toHaveBeenCalledWith('p1');
    expect(c.editingId()).toBe('p1');
    expect(c.existingImages().length).toBe(1);
    expect(c.existingDocs().length).toBe(1);
    expect(c.showForm()).toBeTrue();
    expect(c.setor()).toBe('Bombas e Compressores');
  }));

  it('handleRemoveExistingImage() remove a imagem da lista local após o servidor confirmar', fakeAsync(() => {
    catalogService.removeImage.and.returnValue(of({ id: 'i1', removida: true }));
    const c = montar();
    c.editingId.set('p1');
    c.existingImages.set([{ id: 'i1', url: 'x', isPrimary: false, sortOrder: 0 }]);

    c.handleRemoveExistingImage('i1');
    flushMicrotasks();

    expect(catalogService.removeImage).toHaveBeenCalledWith('p1', 'i1');
    expect(c.existingImages().length).toBe(0);
  }));

  it('handleCardPhoto() envia a foto pelo endpoint dedicado e recarrega a lista', fakeAsync(() => {
    catalogService.uploadImage.and.returnValue(of(produto()));
    const c = montar();
    const ficheiro = new File(['x'], 'foto.png', { type: 'image/png' });

    c.handleCardPhoto('p1', ficheiro);
    flushMicrotasks();

    expect(catalogService.uploadImage).toHaveBeenCalledWith('p1', ficheiro);
    expect(catalogService.list).toHaveBeenCalledTimes(2);
    expect(c.uploadingId()).toBeNull();
  }));

  it('handleDeactivate() desactiva e recarrega', fakeAsync(() => {
    catalogService.deactivate.and.returnValue(of(produto()));
    const c = montar();

    c.handleDeactivate('p1');
    flushMicrotasks();

    expect(catalogService.deactivate).toHaveBeenCalledWith('p1');
    expect(catalogService.list).toHaveBeenCalledTimes(2);
  }));

  it('imagensNoLimite()/docsNoLimite() reflectem o plano do fornecedor', () => {
    auth.user.and.returnValue(utilizador('CORE'));
    const c = montar();

    expect(c.meuPlano()?.plano).toBe('CORE');
    expect(c.limiteImagens()).toBe(3);
    expect(c.imagensNoLimite()).toBeFalse();

    c.gallery.set([{ file: new File(['a'], 'a.png'), preview: 'a' }, { file: new File(['b'], 'b.png'), preview: 'b' }, { file: new File(['c'], 'c.png'), preview: 'c' }]);
    expect(c.imagensNoLimite()).toBeTrue();
  });
});
