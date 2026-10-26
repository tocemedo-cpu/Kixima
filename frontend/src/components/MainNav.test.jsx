// src/components/MainNav.test.jsx
// A navegação horizontal. O que isto protege: um item com submenu abre e fecha
// (clicar de novo, Escape, clicar fora, navegar), os contadores aparecem, e
// "Sair" chama o logout. O corte para "Mais" depende de larguras reais, que o
// jsdom não tem — aqui, sem layout, todos os itens ficam à vista.

import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../i18n';
import MainNav from './MainNav';

const ITEMS = [
  { label: 'Dashboard', icon: 'home', to: '/sistema', end: true },
  {
    label: 'Credenciamento', icon: 'dueDiligence', children: [
      { label: 'Cadastro de Empresas', to: '/sistema/due-diligence' },
      { label: 'Empresas', to: '/sistema/empresas' },
    ],
  },
  { label: 'Minha Cesta', icon: 'cart', to: '/comprador/cesta', badge: 'cart' },
  { label: 'Ajuda', icon: 'help', to: '/ajuda' },
  { label: 'Sair', icon: 'logout', action: 'logout' },
];

function montar(props = {}, rota = '/sistema') {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[rota]}>
        <MainNav items={ITEMS} cartCount={2} badges={{}} onLogout={() => {}} {...props} />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('MainNav', () => {
  test('mostra os itens de topo em linha, com o contador e o bloco final', () => {
    montar();
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Minha Cesta/ })).toHaveTextContent('2');
    // Ajuda e Sair vão para o fim da barra, fora da lista principal.
    const fim = nav.querySelector('.mn-tail');
    expect(within(fim).getByRole('link', { name: /Ajuda/ })).toBeInTheDocument();
    expect(within(fim).getByRole('button', { name: /Sair/ })).toBeInTheDocument();
  });

  test('o item activo fica marcado', () => {
    montar();
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveClass('mn-active');
  });

  test('o grupo abre e fecha ao clicar, e só mostra os filhos quando aberto', () => {
    montar();
    const grupo = screen.getByRole('button', { name: /Credenciamento/ });
    expect(grupo).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Empresas' })).not.toBeInTheDocument();

    fireEvent.click(grupo);
    expect(grupo).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Empresas' })).toBeInTheDocument();

    fireEvent.click(grupo);
    expect(grupo).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Empresas' })).not.toBeInTheDocument();
  });

  test('Escape fecha o grupo e devolve o foco ao botão', () => {
    montar();
    const grupo = screen.getByRole('button', { name: /Credenciamento/ });
    fireEvent.click(grupo);
    fireEvent.keyDown(screen.getByRole('link', { name: 'Empresas' }), { key: 'Escape' });
    expect(screen.queryByRole('link', { name: 'Empresas' })).not.toBeInTheDocument();
    expect(grupo).toHaveFocus();
  });

  test('clicar fora fecha o grupo', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Credenciamento/ }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('link', { name: 'Empresas' })).not.toBeInTheDocument();
  });

  test('escolher um filho navega, fecha o grupo e marca o grupo como activo', () => {
    const aoNavegar = vi.fn();
    montar({ onNavigate: aoNavegar });
    fireEvent.click(screen.getByRole('button', { name: /Credenciamento/ }));
    fireEvent.click(screen.getByRole('link', { name: 'Empresas' }));
    expect(aoNavegar).toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Empresas' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Credenciamento/ })).toHaveClass('mn-active-parent');
  });

  test('Sair chama o logout', () => {
    const sair = vi.fn();
    montar({ onLogout: sair });
    fireEvent.click(screen.getByRole('button', { name: /Sair/ }));
    expect(sair).toHaveBeenCalledTimes(1);
  });
});
