// src/pages/fornecedor/CatalogManage.test.jsx
// Melhorias ao catálogo do Fornecedor: indicador de posição na pesquisa,
// edição de um item publicado (pré-preenchimento), limite de mídia do plano
// em tempo real, e sugestão automática de categoria a partir do UNSPSC sem
// sobrescrever uma escolha manual.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n';
import { UNSPSC_ITEMS } from '../../data/unspscCatalog';

const PLANOS = [
  { plano: 'BASE', features: { imagensPorItem: 3, documentosPorItem: 1, posicaoNaPesquisa: 0, kits: false, carregamentoEmMassa: false } },
  { plano: 'CORE', features: { imagensPorItem: 10, documentosPorItem: 3, posicaoNaPesquisa: 1, kits: true, carregamentoEmMassa: false } },
  { plano: 'PRO', features: { imagensPorItem: 10, documentosPorItem: 6, posicaoNaPesquisa: 2, kits: true, carregamentoEmMassa: true } },
];

const PRODUCTS = [
  { id: 'p1', name: 'Produto Um', category: 'Materiais & Estruturas', description: 'Descrição do produto um', unitPrice: 1000, currency: 'AOA', imageUrl: null, kind: 'PRODUTO' },
];

const FULL_PRODUCT = {
  ...PRODUCTS[0],
  kind: 'PRODUTO', unspscCode: '', unspscTitle: '', unspscSegment: '', unspscFamily: '', unspscClass: '',
  subcategory: '', brand: '', measurementUnit: '', countryOfOrigin: '',
  model: '', keySpec: '', standard: '', warranty: '', incoterm: '', supplierNotes: '',
  promoPrice: null, availability: 'Em stock', stockQuantity: 5, leadTimeDays: 10,
  images: [
    { id: 'img-1', url: '/img1.png', isPrimary: true, sortOrder: 0 },
    { id: 'img-2', url: '/img2.png', isPrimary: false, sortOrder: 1 },
    { id: 'img-3', url: '/img3.png', isPrimary: false, sortOrder: 2 },
  ],
  documents: [{ id: 'doc-1', type: 'FICHA_TECNICA', originalName: 'ficha.pdf' }],
};

let getMock;
let putMock;
// Mutável para poder mudar o plano da empresa entre testes sem re-mockar o
// módulo (vi.mock é fixado ao import estático, resolvido uma única vez).
const mockUser = { companyId: 'c1', role: 'FORNECEDOR', companyPlan: 'CORE' };

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));
vi.mock('../../api/client', () => ({
  api: {
    get: (...args) => getMock(...args),
    put: (...args) => putMock(...args),
    post: vi.fn(() => Promise.resolve({})),
    postForm: vi.fn(() => Promise.resolve({})),
    upload: vi.fn(() => Promise.resolve({})),
    del: vi.fn(() => Promise.resolve({})),
  },
}));

// eslint-disable-next-line import/first
import CatalogManage from './CatalogManage';

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nProvider><CatalogManage /></I18nProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockUser.companyPlan = 'CORE';
  getMock = vi.fn((path) => {
    if (path === '/api/planos') return Promise.resolve({ planos: PLANOS });
    if (path === '/api/catalog') return Promise.resolve(PRODUCTS);
    if (path === '/api/catalog/p1') return Promise.resolve(FULL_PRODUCT);
    return Promise.resolve(null);
  });
  putMock = vi.fn(() => Promise.resolve({ ...FULL_PRODUCT }));
});

describe('Indicador de posição na pesquisa', () => {
  test('mostra a posição do plano CORE (2º) e o link para os planos', async () => {
    renderPage();
    expect(await screen.findByText(/2º na relevância da pesquisa/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver planos/i })).toHaveAttribute('href', '/planos');
  });
});

describe('Editar um item publicado', () => {
  test('pré-preenche o formulário e usa PUT ao guardar', async () => {
    const user = userEvent.setup();
    renderPage();

    const editar = await screen.findByRole('button', { name: /Editar/i });
    await user.click(editar);

    // O formulário abriu pré-preenchido com o nome do produto.
    expect(await screen.findByDisplayValue('Produto Um')).toBeInTheDocument();
    // O botão de submeter passa a dizer "Guardar alterações", não "Publicar produto".
    expect(screen.getByRole('button', { name: /Guardar alterações/i })).toBeInTheDocument();

    const nome = screen.getByDisplayValue('Produto Um');
    await user.clear(nome);
    await user.type(nome, 'Produto Um Editado');
    await user.click(screen.getByRole('button', { name: /Guardar alterações/i }));

    expect(putMock).toHaveBeenCalledWith('/api/catalog/p1', expect.objectContaining({ name: 'Produto Um Editado' }));
  });

  test('mostra o limite de imagens do plano e desativa o acrescento ao atingi-lo (BASE = 3)', async () => {
    // Muda a empresa para o plano BASE (imagensPorItem: 3) — o produto de
    // teste já tem 3 imagens (isPrimary + 2 de galeria), logo já está no limite.
    mockUser.companyPlan = 'BASE';
    const user = userEvent.setup();
    const { container } = renderPage();

    const editar = await screen.findByRole('button', { name: /Editar/i });
    await user.click(editar);
    await screen.findByDisplayValue('Produto Um');

    // Aba 3 — Imagens & Documentos.
    await user.click(screen.getByRole('button', { name: /Imagens & Documentos/i }));

    expect(await screen.findByText(/3 de 3 imagens do plano BASE — limite atingido/)).toBeInTheDocument();
    // O input de acrescentar à galeria fica desativado.
    const inputs = container.querySelectorAll('input[type="file"]');
    const galeriaInput = Array.from(inputs).find((el) => el.multiple && el.accept === 'image/*');
    expect(galeriaInput).toBeDisabled();
  });
});

describe('Sugestão automática de categoria a partir do UNSPSC', () => {
  test('preenche a categoria quando ainda está vazia', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /\+ Novo item/i }));

    const item = UNSPSC_ITEMS.find((i) => i.setor === 'Válvulas e Conexões');
    expect(item).toBeTruthy();

    await user.selectOptions(screen.getByLabelText('Setor'), item.setor);
    await user.selectOptions(screen.getByLabelText('Categoria'), item.categoria);
    await user.selectOptions(screen.getByLabelText('Produto ou Serviço'), item.code);

    // O campo livre, obrigatório ("Categoria *"), distinto do "Categoria" da cascata.
    const categoriaLivre = screen.getByLabelText(/^Categoria \*/);
    expect(categoriaLivre.value).toBe('Válvulas & Controlo de Fluxo');
  });

  test('não sobrescreve uma categoria já escolhida manualmente', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /\+ Novo item/i }));

    // Escolhe manualmente a categoria livre primeiro.
    const categoriaLivre = screen.getByLabelText(/^Categoria \*/);
    await user.selectOptions(categoriaLivre, 'EPI & Segurança');

    const item = UNSPSC_ITEMS.find((i) => i.setor === 'Perfuração e Completação');
    expect(item).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Setor'), item.setor);
    await user.selectOptions(screen.getByLabelText('Categoria'), item.categoria);
    await user.selectOptions(screen.getByLabelText('Produto ou Serviço'), item.code);

    expect(categoriaLivre.value).toBe('EPI & Segurança');
  });
});
