// src/pages/fornecedor/CatalogManage.jsx
// Gestão do catálogo do Vendedor. Cadastro do produto num formulário enxuto de
// 3 abas — apenas o essencial: Produto (nome, categoria, marca, descrição,
// unidade), Preço & Disponibilidade e Imagens & Documentos.
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import { formatMoney } from '../../domain';
import ProductCover from '../../components/ProductCover';
import { Icon } from '../../components/icons';
import { useI18n } from '../../i18n';
import { UNSPSC_ITEMS } from '../../data/unspscCatalog';

// IVA (lei angolana): 14% sobre tudo (produtos e serviços). Indicador no
// formulário; o cálculo autoritativo é feito no backend (taxService).
const IVA_RATE = 0.14;
const IVA = { PRODUTO: IVA_RATE, SERVICO: IVA_RATE };
const ivaPct = () => '14%';

// Cascata de classificação, derivada do catálogo UNSPSC verificado (119 itens).
const SETORES = [...new Set(UNSPSC_ITEMS.map((i) => i.setor))].sort((a, b) => a.localeCompare(b, 'pt'));
const categoriasDe = (setor) => [...new Set(UNSPSC_ITEMS.filter((i) => i.setor === setor).map((i) => i.categoria))].sort((a, b) => a.localeCompare(b, 'pt'));
const itensDe = (setor, cat) => UNSPSC_ITEMS.filter((i) => i.setor === setor && i.categoria === cat).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
const kindFromTipo = (tipo) => (String(tipo).toLowerCase().startsWith('serv') ? 'SERVICO' : 'PRODUTO');

// Taxonomia Oil & Gas — categoria → subcategorias. Cobre o espetro do setor
// (upstream/midstream/downstream, produtos e serviços). "Outros" + subcategoria
// em texto livre acomodam itens fora da lista, mantendo a diversidade.
const TAXONOMY = {
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
  'Outros': [],
};
const CATEGORIES = Object.keys(TAXONOMY);
const CURRENCIES = ['AOA', 'USD', 'EUR'];
const AVAILABILITY = ['Em stock', 'Sob encomenda', 'Esgotado'];

// Documentos relevantes para o setor (compliance). Opcionais.
const DOC_TYPES = [
  ['FICHA_TECNICA', 'Ficha Técnica'],
  ['CERTIFICADO', 'Certificados'],
  ['CATALOGO', 'Catálogo PDF'],
];

const TABS = ['Produto', 'Preço & Disponibilidade', 'Imagens & Documentos'];

// Apenas os campos essenciais/importantes para publicar um item no marketplace.
const EMPTY_FORM = {
  // Classificação (UNSPSC) + tipo (Produto/Serviço — determina o IVA)
  kind: 'PRODUTO', unspscCode: '', unspscTitle: '', unspscSegment: '', unspscFamily: '', unspscClass: '',
  imageUrl: '', // imagem de referência do catálogo (auto)
  // Produto
  name: '', category: '', subcategory: '', brand: '', description: '', measurementUnit: '', countryOfOrigin: '',
  // Atributos universais (livres) + comentários
  model: '', keySpec: '', standard: '', warranty: '', incoterm: '', supplierNotes: '',
  // Preço & disponibilidade
  currency: 'AOA', unitPrice: '', promoPrice: '',
  availability: 'Em stock', stockQuantity: '', leadTimeDays: '',
};

// Cinco campos livres, comuns a qualquer produto ou serviço (iphone, válvula,
// manutenção de AC, drilling…). A Marca tem campo próprio acima.
const UNIVERSAL_FIELDS = [
  ['model', 'Modelo / Referência', 'Ex.: T30, iPhone 15 Pro, Plano Preventivo.'],
  ['keySpec', 'Especificação principal', 'A característica que melhor define o item (dimensão, capacidade, potência, âmbito).'],
  ['standard', 'Norma / Certificação', 'Ex.: API 6D, ISO 9001, ANSI 150. Ou “Não aplicável”.'],
  ['warranty', 'Garantia / Validade', 'Ex.: 12 meses, 2 anos, ou SLA para serviços.'],
  ['incoterm', 'Incoterm', 'Condição de entrega (ex.: DAP, EXW, CIF). Usado na comparação de fornecedores.'],
];

export default function CatalogManage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  // Cascata de classificação: Setor -> Categoria -> Item.
  const [setor, setSetor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [listFilter, setListFilter] = useState('TODOS'); // TODOS | PRODUTO | SERVICO
  const [mainImage, setMainImage] = useState(null); // { file, preview }
  const [gallery, setGallery] = useState([]);        // [{ file, preview }]
  const [docs, setDocs] = useState({});              // { TYPE: File[] }
  const [submitting, setSubmitting] = useState(false);

  // gestão da foto do cartão existente (produtos já publicados)
  const [uploadingId, setUploadingId] = useState(null);
  const cardInputs = useRef({});

  function load() {
    api.get('/api/catalog', { supplierId: user.companyId }).then(setProducts).catch((e) => setError(e));
  }
  useEffect(load, [user.companyId]);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  function pickSetor(v) { setSetor(v); setCategoria(''); }
  // Ao escolher um Item, preenche automaticamente nome, unidade, tipo (IVA) e a
  // classificação UNSPSC (código, título, segmento, família, classe).
  function pickItem(code) {
    const it = UNSPSC_ITEMS.find((i) => i.code === code);
    if (!it) return;
    setForm((f) => ({
      ...f,
      name: f.name || it.nome,
      kind: kindFromTipo(it.tipo),
      measurementUnit: f.measurementUnit || it.uom || '',
      description: f.description || it.descricao || '',
      unspscCode: it.code,
      unspscTitle: it.tituloEN || '',
      unspscSegment: it.segmento,
      unspscFamily: it.familiaCode,
      unspscClass: it.classe,
      // A imagem de referência acompanha sempre o item escolhido (a foto
      // própria do fornecedor é separada — carregada na aba Imagens).
      imageUrl: it.img || '',
    }));
  }

  function resetForm() {
    gallery.forEach((g) => URL.revokeObjectURL(g.preview));
    if (mainImage) URL.revokeObjectURL(mainImage.preview);
    setForm(EMPTY_FORM);
    setSetor('');
    setCategoria('');
    setMainImage(null);
    setGallery([]);
    setDocs({});
    setTab(0);
  }

  function addMainImage(fileList) {
    const file = fileList[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (mainImage) URL.revokeObjectURL(mainImage.preview);
    setMainImage({ file, preview: URL.createObjectURL(file) });
  }
  function addGallery(fileList) {
    const imgs = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    setGallery((g) => [...g, ...imgs.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  }
  function removeGallery(i) {
    setGallery((g) => {
      URL.revokeObjectURL(g[i].preview);
      return g.filter((_, idx) => idx !== i);
    });
  }
  function addDocs(type, fileList) {
    const files = Array.from(fileList);
    setDocs((d) => ({ ...d, [type]: [...(d[type] || []), ...files] }));
  }
  function removeDoc(type, i) {
    setDocs((d) => ({ ...d, [type]: d[type].filter((_, idx) => idx !== i) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    // Validação dos campos obrigatórios com salto para a aba certa.
    if (!form.name.trim()) { setTab(0); setError(t('Indique o nome do produto.')); return; }
    if (!form.category.trim()) { setTab(0); setError(t('Indique a categoria.')); return; }
    if (!form.description.trim()) { setTab(0); setError(t('Escreva uma descrição curta (aparece nos cartões).')); return; }
    if (!form.unitPrice) { setTab(1); setError(t('Indique o preço unitário.')); return; }

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v !== '' && v != null) fd.append(k, v); });
    if (mainImage) fd.append('mainImage', mainImage.file);
    gallery.forEach((g) => fd.append('gallery', g.file));
    DOC_TYPES.forEach(([type]) => (docs[type] || []).forEach((file) => fd.append(type, file)));

    setSubmitting(true);
    try {
      await api.postForm('/api/catalog', fd);
      setSuccess(t('Produto publicado no catálogo com a ficha completa.'));
      resetForm();
      setShowForm(false);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCardPhoto(productId, file) {
    if (!file) return;
    setUploadingId(productId);
    try {
      await api.upload(`/api/catalog/${productId}/image`, file);
      load();
    } catch (err) {
      setError(err);
    } finally {
      setUploadingId(null);
    }
  }
  async function handleDeactivate(id) {
    try { await api.del(`/api/catalog/${id}`); load(); } catch (err) { setError(err); }
  }

  return (
    <div>
      <PageHeader
        title="Catálogo de Produtos e Serviços"
        subtitle="Publique os seus itens com o essencial — produto, preço e disponibilidade, imagens e documentos."
        action={<button className="btn btn-accent" onClick={() => { setShowForm((v) => !v); if (showForm) resetForm(); }}>{showForm ? t('Cancelar') : t('+ Novo item')}</button>}
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {showForm && (
        <div className="card card-pad" style={{ marginBottom: 22 }}>
          <div className="tabs">
            {TABS.map((tabLabel, i) => (
              <button key={tabLabel} type="button" className={`tab ${tab === i ? 'tab-active' : ''}`} onClick={() => setTab(i)}>
                <span className="tab-num">{i + 1}</span>{t(tabLabel)}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="prod-form">
            {/* ABA 1 — Produto */}
            <div className="tab-panel" style={{ display: tab === 0 ? 'block' : 'none' }}>
              {/* Classificação em cascata (UNSPSC) — preenche o essencial sozinha */}
              <label className="reg-section" style={{ display: 'block' }}>{t('Classificação')}</label>
              <p className="helptext" style={{ marginTop: 0 }}>{t('Escolha o item na lista — o código de classificação, o tipo e a unidade preenchem-se automaticamente.')}</p>
              <div className="grid-cols grid-2">
                <div className="field">
                  <label>{t('Setor')}</label>
                  <select value={setor} onChange={(e) => pickSetor(e.target.value)}>
                    <option value="">{t('— Escolher setor —')}</option>
                    {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>{t('Categoria')}</label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={!setor}>
                    <option value="">{setor ? t('— Escolher categoria —') : t('Escolha o setor primeiro')}</option>
                    {setor && categoriasDe(setor).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>{t('Produto ou Serviço')}</label>
                <select value={form.unspscCode} onChange={(e) => pickItem(e.target.value)} disabled={!setor || !categoria}>
                  <option value="">{categoria ? t('— Escolher item —') : t('Escolha setor e categoria primeiro')}</option>
                  {setor && categoria && itensDe(setor, categoria).map((i) => (
                    <option key={i.code} value={i.code}>{i.nome} — {i.tipo}</option>
                  ))}
                </select>
              </div>
              {form.unspscCode ? (
                <div className="cls-box cls-box-img">
                  {form.imageUrl ? <img className="cls-thumb" src={form.imageUrl} alt={form.name} /> : null}
                  <div className="cls-info">
                    <div><span className="cls-k">{t('Classificação internacional')}</span><strong>{form.unspscTitle}</strong></div>
                    <div className="cls-row">
                      <span className="badge badge-neutral bz-mono">UNSPSC {form.unspscCode}</span>
                      <span className={`badge ${form.kind === 'SERVICO' ? 'badge-info' : 'badge-neutral'}`}>{form.kind === 'SERVICO' ? t('Serviço') : t('Produto')}</span>
                      <span className="badge badge-success">IVA {ivaPct(form.kind)}</span>
                    </div>
                    {form.imageUrl ? <small className="helptext">{t('Imagem de referência do catálogo — será usada se não carregar uma foto própria (aba Imagens).')}</small> : null}
                  </div>
                </div>
              ) : null}

              <label className="reg-section" style={{ display: 'block', marginTop: 16 }}>{t('Dados do item')}</label>
              <div className="field">
                <label>{t('Nome do Produto')} <span className="req">*</span></label>
                <input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder={t('Preenchido pela escolha acima; pode ajustar.')} />
              </div>
              <div className="grid-cols grid-2">
                <div className="field">
                  <label>{t('Categoria')} <span className="req">*</span></label>
                  <select value={form.category} onChange={(e) => { update('category', e.target.value); update('subcategory', ''); }}>
                    <option value="">{t('Selecione…')}</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>{t('Subcategoria')}</label>
                  <input
                    list="subcat-list"
                    value={form.subcategory}
                    onChange={(e) => update('subcategory', e.target.value)}
                    placeholder={form.category ? t('Selecione ou escreva…') : t('Escolha a categoria primeiro')}
                    disabled={!form.category}
                  />
                  <datalist id="subcat-list">{(TAXONOMY[form.category] || []).map((s) => <option key={s} value={s} />)}</datalist>
                </div>
              </div>
              <div className="grid-cols grid-2">
                <div className="field">
                  <label>{t('Marca')}</label>
                  <input value={form.brand} onChange={(e) => update('brand', e.target.value)} />
                </div>
                <div className="field">
                  <label>{t('Unidade de Medida')}</label>
                  <input value={form.measurementUnit} onChange={(e) => update('measurementUnit', e.target.value)} placeholder={t('Ex.: un, m, kg, caixa')} />
                </div>
              </div>
              <div className="field">
                <label>{t('País de origem (proveniência do fabrico)')}</label>
                <input value={form.countryOfOrigin} onChange={(e) => update('countryOfOrigin', e.target.value)} placeholder={t('Ex.: Angola, EUA, China, UE — opcional')} />
                <small className="helptext">{t('Opcional. O fornecedor é sempre angolano; este campo indica só a origem do fabrico do bem.')}</small>
              </div>
              <div className="field">
                <label>{t('Descrição Curta')} <span className="req">*</span></label>
                <textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} />
                <small className="helptext">{t('Aparece nos cartões do marketplace.')}</small>
              </div>

              <label className="reg-section" style={{ display: 'block', marginTop: 8 }}>{t('Atributos (comuns a qualquer item)')}</label>
              <div className="grid-cols grid-2">
                {UNIVERSAL_FIELDS.map(([k, label, help]) => (
                  <div className="field" key={k}>
                    <label>{t(label)}</label>
                    <input value={form[k]} onChange={(e) => update(k, e.target.value)} placeholder={t(help)} />
                  </div>
                ))}
              </div>
              <div className="field">
                <label>{t('Comentários')}</label>
                <textarea rows={3} value={form.supplierNotes} onChange={(e) => update('supplierNotes', e.target.value)}
                  placeholder={t('Qualquer requisito ou informação adicional que não caiba nos campos acima.')} />
              </div>
            </div>

            {/* ABA 2 — Preço & Disponibilidade */}
            <div className="tab-panel" style={{ display: tab === 1 ? 'block' : 'none' }}>
              <div className="grid-cols grid-2">
                <div className="field">
                  <label>{t('Moeda')}</label>
                  <select value={form.currency} onChange={(e) => update('currency', e.target.value)}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>{t('Preço Unitário')} <span className="req">*</span></label>
                  <input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => update('unitPrice', e.target.value)} />
                </div>
                <div className="field">
                  <label>{t('Preço Promocional')}</label>
                  <input type="number" min="0" step="0.01" value={form.promoPrice} onChange={(e) => update('promoPrice', e.target.value)} />
                </div>
                <div className="field">
                  <label>{t('Disponibilidade')}</label>
                  <select value={form.availability} onChange={(e) => update('availability', e.target.value)}>
                    {AVAILABILITY.map((a) => <option key={a} value={a}>{t(a)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>{t('Quantidade em Stock')}</label>
                  <input type="number" min="0" value={form.stockQuantity} onChange={(e) => update('stockQuantity', e.target.value)} />
                </div>
                <div className="field">
                  <label>{t('Prazo de Entrega (dias)')}</label>
                  <input type="number" min="0" value={form.leadTimeDays} onChange={(e) => update('leadTimeDays', e.target.value)} />
                </div>
              </div>
              {form.unitPrice ? (
                <div className="cls-box">
                  <span className="cls-k">{t('Impostos (lei angolana)')} — {form.kind === 'SERVICO' ? t('serviço') : t('produto')}</span>
                  <div className="cls-row" style={{ justifyContent: 'space-between' }}>
                    <span>{t('Preço sem IVA:')} <strong>{formatMoney(Number(form.unitPrice), form.currency)}</strong></span>
                    <span>{t('IVA (14%):')} <strong>{formatMoney(Number(form.unitPrice) * IVA_RATE, form.currency)}</strong></span>
                    <span>{t('Com IVA:')} <strong>{formatMoney(Number(form.unitPrice) * (1 + IVA_RATE), form.currency)}</strong></span>
                  </div>
                  {form.kind === 'SERVICO' ? (
                    <div className="cls-row" style={{ justifyContent: 'space-between' }}>
                      <span>{t('Retenção na fonte II (6,5%):')} <strong>− {formatMoney(Number(form.unitPrice) * 0.065, form.currency)}</strong></span>
                      <span>{t('Líquido a receber:')} <strong>{formatMoney(Number(form.unitPrice) * (1 + IVA_RATE) - Number(form.unitPrice) * 0.065, form.currency)}</strong></span>
                    </div>
                  ) : null}
                  <small className="helptext">
                    {t('O preço é')} <strong>{t('sem IVA')}</strong>. {t('O IVA (14%) soma-se à fatura.')}
                    {form.kind === 'SERVICO' ? ` ${t('Nos serviços, o comprador retém 6,5% (Imposto Industrial) e entrega à AGT — reduz o líquido que recebe.')}` : ''}
                  </small>
                </div>
              ) : null}
            </div>

            {/* ABA 3 — Imagens & Documentos */}
            <div className="tab-panel" style={{ display: tab === 2 ? 'block' : 'none' }}>
              <label className="reg-section" style={{ display: 'block' }}>{t('Imagem Principal')}</label>
              <Dropzone onFiles={addMainImage} hint={t('Arraste a imagem principal ou clique para escolher')}>
                {mainImage ? <img src={mainImage.preview} alt={t('principal')} className="dz-thumb" /> : null}
              </Dropzone>

              <label className="reg-section" style={{ display: 'block', marginTop: 16 }}>{t('Galeria')}</label>
              <Dropzone multiple onFiles={addGallery} hint={t('Arraste várias imagens ou clique para escolher')} />
              {gallery.length > 0 && (
                <div className="dz-grid">
                  {gallery.map((g, i) => (
                    <div key={i} className="dz-item">
                      <img src={g.preview} alt={t('galeria {n}', { n: i + 1 })} />
                      <button type="button" className="dz-remove" onClick={() => removeGallery(i)} aria-label={t('Remover')}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <label className="reg-section" style={{ display: 'block', marginTop: 16 }}>{t('Documentos')}</label>
              <p className="helptext" style={{ marginTop: 0 }}>{t('PDF ou imagem, até 15 MB cada. Opcional — pode anexar vários por tipo.')}</p>
              {DOC_TYPES.map(([type, label]) => (
                <div className="field" key={type}>
                  <label>{t(label)}</label>
                  <input type="file" multiple accept="application/pdf,image/*" onChange={(e) => { addDocs(type, e.target.files); e.target.value = ''; }} />
                  {(docs[type] || []).length > 0 && (
                    <ul className="doc-chips">
                      {docs[type].map((f, i) => (
                        <li key={i}><Icon name="invoice" size={13} /> {f.name}
                          <button type="button" onClick={() => removeDoc(type, i)} aria-label={t('Remover')}>×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="prod-form-footer">
              <div className="tab-nav">
                <button type="button" className="btn btn-ghost" disabled={tab === 0} onClick={() => setTab((v) => Math.max(0, v - 1))}>{t('Anterior')}</button>
                {tab < TABS.length - 1
                  ? <button type="button" className="btn btn-ghost" onClick={() => setTab((v) => Math.min(TABS.length - 1, v + 1))}>{t('Seguinte')}</button>
                  : null}
              </div>
              <button className="btn btn-accent" type="submit" disabled={submitting}>
                {submitting ? t('A publicar…') : t('Publicar produto')}
              </button>
            </div>
          </form>
        </div>
      )}

      {!products ? (
        <Loading />
      ) : products.length === 0 ? (
        <div className="empty-state">
          <h3>{t('Ainda não publicou nenhum item')}</h3>
          <p>{t('Adicione produtos ou serviços para começar a receber ordens de compra.')}</p>
        </div>
      ) : (
        <>
        <div className="cat-filter">
          {[['TODOS', 'Todos'], ['PRODUTO', 'Produtos'], ['SERVICO', 'Serviços']].map(([k, label]) => {
            const n = products.filter((p) => k === 'TODOS' || (p.kind || 'PRODUTO') === k).length;
            return (
              <button key={k} type="button" className={`chip ${listFilter === k ? 'chip-active' : ''}`} onClick={() => setListFilter(k)}>
                {t(label)} <span className="cat-filter-n">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="mk-grid">
          {products.filter((p) => listFilter === 'TODOS' || (p.kind || 'PRODUTO') === listFilter).map((p) => (
            <div key={p.id} className="mk-card">
              <div className="mk-cover">
                <ProductCover imageUrl={p.imageUrl} category={p.category} name={p.name} />
                <input ref={(el) => (cardInputs.current[p.id] = el)} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleCardPhoto(p.id, e.target.files[0])} />
                <button type="button" className="mk-photo-btn" onClick={() => cardInputs.current[p.id]?.click()} disabled={uploadingId === p.id}>
                  <Icon name="catalog" size={13} />
                  {uploadingId === p.id ? t('A enviar…') : p.imageUrl ? t('Trocar foto') : t('Carregar foto')}
                </button>
              </div>
              <div className="mk-body">
                <div className="mk-supplier"><span className="badge badge-neutral">{p.category}</span></div>
                <strong className="mk-title" style={{ cursor: 'default' }}>{p.name}</strong>
                <p className="mk-desc">{p.description}</p>
                <div className="mk-meta">
                  <span className="mk-price">{formatMoney(p.unitPrice, p.currency)}</span>
                  {p.leadTimeDays ? <span className="mk-lead">{t('Prazo {n} dias', { n: p.leadTimeDays })}</span> : null}
                </div>
                <div className="mk-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDeactivate(p.id)}>{t('Remover')}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}

// Área de arrastar/soltar + clique. Chama onFiles(FileList).
function Dropzone({ onFiles, hint, multiple, children }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone ${over ? 'dropzone-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files); }}
    >
      <input ref={inputRef} type="file" accept="image/*" multiple={multiple} style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ''; }} />
      {children}
      <div className="dz-hint"><Icon name="catalog" size={16} /> {hint}</div>
    </div>
  );
}
