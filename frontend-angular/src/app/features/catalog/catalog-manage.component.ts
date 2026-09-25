// Porta de frontend/src/pages/fornecedor/CatalogManage.jsx. Gestão do
// catálogo do Vendedor: cadastro em 3 abas (Produto, Preço & Disponibilidade,
// Imagens & Documentos), edição, upload de imagem de capa/galeria/documentos,
// remoção, e a tabela de planos para os limites de mídia e a posição na
// pesquisa. Contratos confirmados contra
// backend-java/.../catalog/CatalogController.java — ver PLANO.md.
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PlansService } from '../../core/services/plans.service';
import { CatalogService } from './catalog.service';
import {
  EMPTY_PRODUCT_FORM,
  ProductDocType,
  ProductDocumentDto,
  ProductDto,
  ProductFormBody,
  ProductImageDto,
  PRODUCT_AVAILABILITY,
} from '../../core/models/product.model';
import { PlanoDto } from '../../core/models/plan.model';
import { ApiError } from '../../core/models/api-error.model';
import { UNSPSC_ITEMS, UnspscItem } from '../../core/data/unspsc-catalog';
import { formatMoney } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';
import { FieldComponent } from '../../shared/components/field.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ProductCoverComponent } from '../../shared/components/product-cover.component';
import { DropzoneComponent } from './dropzone.component';

// IVA (lei angolana): 14% sobre tudo (produtos e serviços). Indicador no
// formulário; o cálculo autoritativo é feito no backend (taxService).
const IVA_RATE = 0.14;

// Cascata de classificação, derivada do catálogo UNSPSC verificado (119 itens).
const SETORES = [...new Set(UNSPSC_ITEMS.map((i) => i.setor))].sort((a, b) => a.localeCompare(b, 'pt'));
const categoriasDe = (setor: string) =>
  [...new Set(UNSPSC_ITEMS.filter((i) => i.setor === setor).map((i) => i.categoria))].sort((a, b) => a.localeCompare(b, 'pt'));
const itensDe = (setor: string, cat: string) =>
  UNSPSC_ITEMS.filter((i) => i.setor === setor && i.categoria === cat).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
const kindFromTipo = (tipo: string): 'PRODUTO' | 'SERVICO' => (String(tipo).toLowerCase().startsWith('serv') ? 'SERVICO' : 'PRODUTO');

// Taxonomia Oil & Gas — categoria → subcategorias. Cobre o espetro do setor
// (upstream/midstream/downstream, produtos e serviços). "Outros" + subcategoria
// em texto livre acomodam itens fora da lista, mantendo a diversidade.
const TAXONOMY: Record<string, string[]> = {
  'Perfuração & Poço': ['Brocas & Bits', 'Drill Pipe & Tubulares', 'BOP & Controlo de Poço', 'Ferramentas de Fundo', 'Cimentação', 'Fluidos & Lamas'],
  'Válvulas & Controlo de Fluxo': ['Esfera', 'Gaveta', 'Globo', 'Borboleta', 'Retenção', 'Segurança & Alívio', 'Atuadores'],
  'Tubulação & Acessórios': ['Tubos & Pipe', 'Flanges', 'Conexões & Fittings', 'Juntas & Vedações', 'Suportes & Fixação'],
  'Instrumentação & Automação': ['Sensores & Transmissores', 'Manómetros', 'Medidores de Caudal', 'Controlo & SCADA', 'Calibração'],
  'Equipamentos Rotativos': ['Bombas', 'Compressores', 'Turbinas', 'Motores', 'Geradores'],
  'Equipamentos Estáticos': ['Vasos de Pressão', 'Permutadores de Calor', 'Tanques & Reservatórios', 'Separadores', 'Filtros'],
  'Elétrica & Energia': ['Cabos & Condutores', 'Quadros & Painéis', 'Transformadores', 'Iluminação (Ex)', 'Baterias & UPS'],
  'EPI & Segurança': ['Proteção Individual', 'Deteção de Gás', 'Combate a Incêndio', 'Resgate & Salvamento', 'Sinalização'],
  'Químicos & Consumíveis': ['Químicos de Processo', 'Lubrificantes', 'Consumíveis de Soldadura', 'Limpeza & Manutenção', 'Revestimentos & Tintas'],
  'Offshore & Subsea': ['Equipamento Subsea', 'Umbilicais & Risers', 'ROV & Ferramentas', 'Amarração', 'Apoio Marítimo'],
  'Materiais & Estruturas': ['Aço & Perfis', 'Estruturas Metálicas', 'Chapas', 'Fixadores', 'Isolamento'],
  'Inspeção, Ensaios & Certificação': ['END / NDT', 'Inspeção de Soldadura', 'Certificação', 'Metrologia', 'Auditoria'],
  'Engenharia & Manutenção': ['Projeto & Engenharia', 'Manutenção', 'Comissionamento', 'Construção & Montagem', 'Consultoria'],
  'Logística & Movimentação': ['Transporte', 'Elevação & Rigging', 'Contentores', 'Armazenagem', 'Desalfandegamento'],
  'Formação & Certificação': ['HSE', 'Técnica', 'Operacional', 'Certificação de Pessoal'],
  Outros: [],
};
const CATEGORIES = Object.keys(TAXONOMY);
const CURRENCIES = ['AOA', 'USD', 'EUR'];

// Documentos relevantes para o setor (compliance). Opcionais. Os 6 tipos que
// o backend/schema aceitam (ProductDocType).
const DOC_TYPES: [ProductDocType, string][] = [
  ['FICHA_TECNICA', 'Ficha Técnica'],
  ['DATASHEET', 'Datasheet'],
  ['MANUAL', 'Manual'],
  ['CATALOGO', 'Catálogo PDF'],
  ['CERTIFICADO', 'Certificados'],
  ['DESENHO_TECNICO', 'Desenho Técnico'],
];

// Liga o "setor" do UNSPSC (classificação internacional) à categoria O&G
// livre da KIXIMA — as duas classificações coexistem no formulário sem
// nenhuma ligação hoje. Aqui só se PRÉ-SUGERE a categoria mais próxima ao
// escolher um item; o fornecedor pode sempre ajustar (ver pickItem).
const SETOR_TO_CATEGORY: Record<string, string> = {
  'Bombas e Compressores': 'Equipamentos Rotativos',
  'Elevação, Içamento e Rigging': 'Logística & Movimentação',
  'Elétrico, Iluminação e Automação': 'Elétrica & Energia',
  'Ferramentas e Equipamento de Oficina': 'Engenharia & Manutenção',
  'Geração de Energia': 'Equipamentos Rotativos',
  'Hidráulica e Pneumática': 'Válvulas & Controlo de Fluxo',
  'Inspeção, Testes e Certificação': 'Inspeção, Ensaios & Certificação',
  'Instrumentação e Controlo': 'Instrumentação & Automação',
  'Logística, Transporte e Armazenagem': 'Logística & Movimentação',
  'Material de Escritório e TI': 'Outros',
  'Perfuração e Completação': 'Perfuração & Poço',
  'Produtos Químicos e Fluidos': 'Químicos & Consumíveis',
  'Segurança e EPI': 'EPI & Segurança',
  'Serviços Ambientais e Gestão de Resíduos': 'Outros',
  'Serviços de Engenharia e Manutenção': 'Engenharia & Manutenção',
  'Tubulares e Acessórios (OCTG)': 'Tubulação & Acessórios',
  'Válvulas e Conexões': 'Válvulas & Controlo de Fluxo',
};

// Posição de relevância na pesquisa do marketplace, por plano (0=BASE,
// 1=CORE, 2=PRO — quanto maior, melhor). Convertido para "1º/2º/3º".
function posicaoOrdinal(rank: number): number {
  return 3 - (Number(rank) || 0);
}

const TABS = ['Produto', 'Preço & Disponibilidade', 'Imagens & Documentos'];

// Cinco campos livres, comuns a qualquer produto ou serviço.
const UNIVERSAL_FIELDS: [keyof ProductFormBody, string, string][] = [
  ['model', 'Modelo / Referência', 'Ex.: T30, iPhone 15 Pro, Plano Preventivo.'],
  ['keySpec', 'Especificação principal', 'A característica que melhor define o item (dimensão, capacidade, potência, âmbito).'],
  ['standard', 'Norma / Certificação', 'Ex.: API 6D, ISO 9001, ANSI 150. Ou “Não aplicável”.'],
  ['warranty', 'Garantia / Validade', 'Ex.: 12 meses, 2 anos, ou SLA para serviços.'],
  ['incoterm', 'Incoterm', 'Condição de entrega (ex.: DAP, EXW, CIF). Usado na comparação de fornecedores.'],
];

interface FicheiroComPreview {
  file: File;
  preview: string;
}

type ListFilter = 'TODOS' | 'PRODUTO' | 'SERVICO';

@Component({
  selector: 'app-catalog-manage',
  standalone: true,
  imports: [
    RouterLink,
    PageHeaderComponent,
    LoadingComponent,
    ErrorBannerComponent,
    SuccessBannerComponent,
    FieldComponent,
    IconComponent,
    ProductCoverComponent,
    DropzoneComponent,
  ],
  templateUrl: './catalog-manage.component.html',
})
export class CatalogManageComponent {
  readonly SETORES = SETORES;
  readonly CATEGORIES = CATEGORIES;
  readonly CURRENCIES = CURRENCIES;
  readonly DOC_TYPES = DOC_TYPES;
  readonly UNIVERSAL_FIELDS = UNIVERSAL_FIELDS;
  readonly TABS = TABS;
  readonly PRODUCT_AVAILABILITY = PRODUCT_AVAILABILITY;
  readonly IVA_RATE = IVA_RATE;
  readonly formatMoney = formatMoney;
  categoriasDe = categoriasDe;
  itensDe = itensDe;

  readonly products = signal<ProductDto[] | null>(null);
  readonly error = signal<string | ApiError | null>(null);
  readonly success = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly tab = signal(0);
  readonly form = signal<ProductFormBody>(EMPTY_PRODUCT_FORM);
  readonly setor = signal('');
  readonly categoria = signal('');
  readonly listFilter = signal<ListFilter>('TODOS');
  readonly mainImage = signal<FicheiroComPreview | null>(null);
  readonly gallery = signal<FicheiroComPreview[]>([]);
  readonly docs = signal<Partial<Record<ProductDocType, File[]>>>({});
  readonly submitting = signal(false);

  readonly editingId = signal<string | null>(null);
  readonly existingImages = signal<ProductImageDto[]>([]);
  readonly existingDocs = signal<ProductDocumentDto[]>([]);
  readonly existingGalleryImages = computed(() => this.existingImages().filter((img) => !img.isPrimary));

  readonly FILTER_OPTIONS: [ListFilter, string][] = [
    ['TODOS', 'Todos'],
    ['PRODUTO', 'Produtos'],
    ['SERVICO', 'Serviços'],
  ];

  readonly planos = signal<PlanoDto[] | null>(null);
  readonly uploadingId = signal<string | null>(null);

  readonly Math = Math;

  toNumber(v: string): number {
    return Number(v) || 0;
  }

  taxonomySubcategorias(categoria: string): string[] {
    return TAXONOMY[categoria] || [];
  }

  readonly meuPlano = computed<PlanoDto | null>(() => {
    const planos = this.planos();
    const alvo = this.auth.user()?.companyPlan || 'BASE';
    return (planos || []).find((p) => p.plano === alvo) || null;
  });
  readonly limiteImagens = computed(() => (this.meuPlano() ? this.meuPlano()!.features.imagensPorItem : null));
  readonly limiteDocs = computed(() => (this.meuPlano() ? this.meuPlano()!.features.documentosPorItem : null));
  readonly totalImagens = computed(
    () => (this.mainImage() ? 1 : 0) + this.gallery().length + (this.editingId() ? this.existingImages().length : 0),
  );
  readonly totalDocs = computed(
    () =>
      DOC_TYPES.reduce((n, [type]) => n + (this.docs()[type]?.length || 0), 0) +
      (this.editingId() ? this.existingDocs().length : 0),
  );
  readonly imagensNoLimite = computed(
    () => !!(this.meuPlano() && this.limiteImagens() != null && this.totalImagens() >= this.limiteImagens()!),
  );
  readonly docsNoLimite = computed(
    () => !!(this.meuPlano() && this.limiteDocs() != null && this.totalDocs() >= this.limiteDocs()!),
  );
  readonly filteredProducts = computed(
    () => (this.products() || []).filter((p) => this.listFilter() === 'TODOS' || (p.kind || 'PRODUTO') === this.listFilter()),
  );

  constructor(
    private readonly auth: AuthService,
    private readonly catalogService: CatalogService,
    private readonly plansService: PlansService,
  ) {
    this.load();
    this.plansService.planos().subscribe({ next: (r) => this.planos.set(r.planos), error: () => {} });
  }

  private load(): void {
    const companyId = this.auth.user()!.companyId!;
    this.catalogService.list({ supplierId: companyId }).subscribe({
      next: (produtos) => this.products.set(produtos),
      error: (e) => this.error.set(e),
    });
  }

  contagemPorFiltro(k: ListFilter): number {
    const produtos = this.products() || [];
    return produtos.filter((p) => k === 'TODOS' || (p.kind || 'PRODUTO') === k).length;
  }

  update<K extends keyof ProductFormBody>(field: K, value: ProductFormBody[K]): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  pickSetor(v: string): void {
    this.setor.set(v);
    this.categoria.set('');
  }

  // Ao escolher um Item, preenche automaticamente nome, unidade, tipo (IVA) e
  // a classificação UNSPSC (código, título, segmento, família, classe).
  pickItem(code: string): void {
    const it = UNSPSC_ITEMS.find((i: UnspscItem) => i.code === code);
    if (!it) return;
    this.form.update((f) => ({
      ...f,
      name: f.name || it.nome,
      kind: kindFromTipo(it.tipo),
      measurementUnit: f.measurementUnit || it.uom || '',
      description: f.description || it.descricao || '',
      category: f.category || SETOR_TO_CATEGORY[it.setor] || f.category,
      unspscCode: it.code,
      unspscTitle: it.tituloEN || '',
      unspscSegment: it.segmento,
      unspscFamily: it.familiaCode,
      unspscClass: it.classe,
      imageUrl: it.img || '',
    }));
  }

  private resetForm(): void {
    this.gallery().forEach((g) => URL.revokeObjectURL(g.preview));
    const capa = this.mainImage();
    if (capa) URL.revokeObjectURL(capa.preview);
    this.form.set(EMPTY_PRODUCT_FORM);
    this.setor.set('');
    this.categoria.set('');
    this.mainImage.set(null);
    this.gallery.set([]);
    this.docs.set({});
    this.tab.set(0);
    this.editingId.set(null);
    this.existingImages.set([]);
    this.existingDocs.set([]);
  }

  cancelar(): void {
    this.showForm.set(false);
    this.resetForm();
  }

  novoItem(): void {
    this.resetForm();
    this.showForm.set(true);
  }

  // Abre o formulário pré-preenchido para editar um item já publicado. Busca
  // o produto completo (a listagem do catálogo não traz galeria/documentos).
  async startEdit(p: ProductDto): Promise<void> {
    this.error.set(null);
    this.success.set(null);
    try {
      const full = await new Promise<ProductDto>((resolve, reject) => {
        this.catalogService.get(p.id).subscribe({ next: resolve, error: reject });
      });
      const it = full.unspscCode ? UNSPSC_ITEMS.find((i) => i.code === full.unspscCode) : null;
      this.setor.set(it?.setor || '');
      this.categoria.set(it?.categoria || '');
      this.form.set({
        kind: full.kind || 'PRODUTO',
        unspscCode: full.unspscCode || '',
        unspscTitle: full.unspscTitle || '',
        unspscSegment: full.unspscSegment || '',
        unspscFamily: full.unspscFamily || '',
        unspscClass: full.unspscClass || '',
        imageUrl: full.imageUrl || '',
        name: full.name || '',
        category: full.category || '',
        subcategory: full.subcategory || '',
        brand: full.brand || '',
        description: full.description || '',
        measurementUnit: full.measurementUnit || '',
        countryOfOrigin: full.countryOfOrigin || '',
        model: full.model || '',
        keySpec: full.keySpec || '',
        standard: full.standard || '',
        warranty: full.warranty || '',
        incoterm: full.incoterm || '',
        supplierNotes: full.supplierNotes || '',
        currency: full.currency || 'AOA',
        unitPrice: full.unitPrice != null ? String(full.unitPrice) : '',
        promoPrice: full.promoPrice != null ? String(full.promoPrice) : '',
        availability: full.availability || 'Em stock',
        stockQuantity: full.stockQuantity != null ? String(full.stockQuantity) : '',
        leadTimeDays: full.leadTimeDays != null ? String(full.leadTimeDays) : '',
      });
      this.editingId.set(full.id);
      this.existingImages.set(full.images || []);
      this.existingDocs.set(full.documents || []);
      this.mainImage.set(null);
      this.gallery.set([]);
      this.docs.set({});
      this.tab.set(0);
      this.showForm.set(true);
    } catch (e) {
      this.error.set(e as ApiError);
    }
  }

  async handleRemoveExistingImage(imageId: string): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    try {
      await new Promise<void>((resolve, reject) => {
        this.catalogService.removeImage(id, imageId).subscribe({ next: () => resolve(), error: reject });
      });
      this.existingImages.update((imgs) => imgs.filter((i) => i.id !== imageId));
    } catch (e) {
      this.error.set(e as ApiError);
    }
  }

  async handleRemoveExistingDoc(docId: string): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    try {
      await new Promise<void>((resolve, reject) => {
        this.catalogService.removeDocument(id, docId).subscribe({ next: () => resolve(), error: reject });
      });
      this.existingDocs.update((ds) => ds.filter((d) => d.id !== docId));
    } catch (e) {
      this.error.set(e as ApiError);
    }
  }

  addMainImage(fileList: FileList): void {
    const file = fileList[0];
    if (!file || !file.type.startsWith('image/')) return;
    const capa = this.mainImage();
    if (capa) URL.revokeObjectURL(capa.preview);
    this.mainImage.set({ file, preview: URL.createObjectURL(file) });
  }

  addGallery(fileList: FileList): void {
    const imgs = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    this.gallery.update((g) => [...g, ...imgs.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  }

  removeGallery(i: number): void {
    this.gallery.update((g) => {
      URL.revokeObjectURL(g[i].preview);
      return g.filter((_, idx) => idx !== i);
    });
  }

  addDocs(type: ProductDocType, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.docs.update((d) => ({ ...d, [type]: [...(d[type] || []), ...files] }));
    input.value = '';
  }

  removeDoc(type: ProductDocType, i: number): void {
    this.docs.update((d) => ({ ...d, [type]: (d[type] || []).filter((_, idx) => idx !== i) }));
  }

  async handleSubmit(): Promise<void> {
    this.error.set(null);
    this.success.set(null);
    const f = this.form();
    // Validação dos campos obrigatórios com salto para a aba certa.
    if (!f.name.trim()) {
      this.tab.set(0);
      this.error.set('Indique o nome do produto.');
      return;
    }
    if (!f.category.trim()) {
      this.tab.set(0);
      this.error.set('Indique a categoria.');
      return;
    }
    if (!f.description.trim()) {
      this.tab.set(0);
      this.error.set('Escreva uma descrição curta (aparece nos cartões).');
      return;
    }
    if (!f.unitPrice) {
      this.tab.set(1);
      this.error.set('Indique o preço unitário.');
      return;
    }

    this.submitting.set(true);
    try {
      const editingId = this.editingId();
      if (editingId) {
        // Edição: campos de texto/preço/classificação por JSON (PUT); media
        // nova (se houver) por multipart, à parte — a foto de capa continua a
        // ir por /:id/image (mesmo endpoint que "Trocar foto" no cartão).
        const body: Record<string, string> = {};
        Object.entries(f).forEach(([k, v]) => {
          if (v !== '' && v != null) body[k] = v as string;
        });
        await new Promise<void>((resolve, reject) => {
          this.catalogService.update(editingId, body).subscribe({ next: () => resolve(), error: reject });
        });

        const docsAtual = this.docs();
        const temMediaNova = this.gallery().length > 0 || DOC_TYPES.some(([type]) => (docsAtual[type] || []).length > 0);
        if (temMediaNova) {
          const fd = new FormData();
          this.gallery().forEach((g) => fd.append('gallery', g.file));
          DOC_TYPES.forEach(([type]) => (docsAtual[type] || []).forEach((file) => fd.append(type, file)));
          await new Promise<void>((resolve, reject) => {
            this.catalogService.addMedia(editingId, fd).subscribe({ next: () => resolve(), error: reject });
          });
        }
        const capa = this.mainImage();
        if (capa) {
          await new Promise<void>((resolve, reject) => {
            this.catalogService.uploadImage(editingId, capa.file).subscribe({ next: () => resolve(), error: reject });
          });
        }
        this.success.set('Alterações guardadas.');
      } else {
        const fd = new FormData();
        Object.entries(f).forEach(([k, v]) => {
          if (v !== '' && v != null) fd.append(k, v as string);
        });
        const capa = this.mainImage();
        if (capa) fd.append('mainImage', capa.file);
        this.gallery().forEach((g) => fd.append('gallery', g.file));
        const docsAtual = this.docs();
        DOC_TYPES.forEach(([type]) => (docsAtual[type] || []).forEach((file) => fd.append(type, file)));
        await new Promise<void>((resolve, reject) => {
          this.catalogService.create(fd).subscribe({ next: () => resolve(), error: reject });
        });
        this.success.set('Produto publicado no catálogo com a ficha completa.');
      }
      this.resetForm();
      this.showForm.set(false);
      this.load();
    } catch (e) {
      this.error.set(e as ApiError);
    } finally {
      this.submitting.set(false);
    }
  }

  async handleCardPhoto(productId: string, file: File | null | undefined): Promise<void> {
    if (!file) return;
    this.uploadingId.set(productId);
    try {
      await new Promise<void>((resolve, reject) => {
        this.catalogService.uploadImage(productId, file).subscribe({ next: () => resolve(), error: reject });
      });
      this.load();
    } catch (e) {
      this.error.set(e as ApiError);
    } finally {
      this.uploadingId.set(null);
    }
  }

  async handleDeactivate(id: string): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.catalogService.deactivate(id).subscribe({ next: () => resolve(), error: reject });
      });
      this.load();
    } catch (e) {
      this.error.set(e as ApiError);
    }
  }

  posicaoOrdinal(rank: number): number {
    return posicaoOrdinal(rank);
  }
}
