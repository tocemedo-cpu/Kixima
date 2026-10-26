// src/components/MainNav.jsx
// Navegação principal HORIZONTAL (computador): uma barra por baixo da barra de
// aplicação com os itens de topo em linha. Os itens com submenu (acordeões na
// definição de data/sidebar.js) abrem como menu suspenso; o que não cabe na
// largura vai para um menu "Mais". O bloco final (Ajuda, Sair) fica à direita.
//
// Usa exactamente os mesmos dados que a gaveta móvel (Sidebar) — itens,
// submenus, contadores e filtragem por áreas continuam a vir de
// data/sidebar.js. Abaixo de 900px o AppLayout volta a usar a gaveta.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from './icons';
import { useI18n } from '../i18n';

const TAIL_PATHS = new Set(['/ajuda', '/suporte/chat', '/suporte/feedback', '/mensagens/chat-comercial']);

// Têm de coincidir com o `gap` de .mn-list e a largura do botão "Mais" em CSS.
const GAP = 2;
const LARGURA_MAIS = 84;

const chave = (item) => item.to || item.label;

// Uma rota pertence ao grupo se for igual a um `to` de um filho ou começar por ele.
function grupoActivo(children, pathname) {
  return children.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`));
}

// Quantos itens cabem na largura disponível (reservando o botão "Mais" se
// alguns ficarem de fora). Sem largura medida (testes) mostra tudo.
function quantosCabem(larguras, disponivel) {
  if (!disponivel) return larguras.length;
  const total = larguras.reduce((a, w) => a + w, 0) + GAP * Math.max(0, larguras.length - 1);
  if (total <= disponivel) return larguras.length;
  let usado = LARGURA_MAIS + GAP;
  let n = 0;
  for (const w of larguras) {
    if (usado + w + GAP > disponivel) break;
    usado += w + GAP;
    n += 1;
  }
  return Math.max(n, 1);
}

export default function MainNav({ items, cartCount = 0, badges = {}, onLogout, onNavigate }) {
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const navRef = useRef(null);
  const listRef = useRef(null);
  const larguras = useRef([]);
  // null = a medir (renderiza todos); número = quantos itens ficam visíveis.
  const [cabem, setCabem] = useState(null);
  const [aberto, setAberto] = useState(null);

  const badgeFor = (item) => {
    if (item.badge === 'cart') return cartCount > 0 ? cartCount : null;
    const n = badges[item.badge];
    return n > 0 ? n : null;
  };
  const isTail = (item) => item.action === 'logout' || TAIL_PATHS.has(item.to);
  const main = items.filter((i) => !isTail(i));
  const tail = items.filter(isTail);

  // Tudo o que altera a largura dos itens obriga a medir de novo.
  const chaveMedida = `${lang}|${main.map((i) => `${i.label}:${badgeFor(i) ?? ''}`).join(';')}`;
  useLayoutEffect(() => { setCabem(null); }, [chaveMedida]);

  useLayoutEffect(() => {
    if (cabem !== null) return;
    const lista = listRef.current;
    if (!lista) return;
    const els = lista.querySelectorAll(':scope > li[data-mn]');
    larguras.current = Array.from(els, (el) => el.getBoundingClientRect().width);
    setCabem(quantosCabem(larguras.current, lista.clientWidth));
  }, [cabem]);

  // Redimensionar muda o espaço — e a escrita dos ícones muda por breakpoint,
  // logo as larguras guardadas deixam de valer: mede-se outra vez.
  useEffect(() => {
    const lista = listRef.current;
    if (!lista || typeof ResizeObserver === 'undefined') return undefined;
    let primeira = true;
    const ro = new ResizeObserver(() => {
      if (primeira) { primeira = false; return; }
      setCabem(null);
    });
    ro.observe(lista);
    return () => ro.disconnect();
  }, []);

  // Fecha o menu suspenso ao navegar, ao clicar fora e com Escape (devolvendo
  // o foco ao botão que o abriu).
  useEffect(() => { setAberto(null); }, [pathname]);
  useEffect(() => {
    if (aberto === null) return undefined;
    const fora = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setAberto(null); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  function onKeyDown(e) {
    if (e.key !== 'Escape' || aberto === null) return;
    const botao = Array.from(navRef.current?.querySelectorAll('button[data-k]') || []).find((b) => b.dataset.k === aberto);
    setAberto(null);
    botao?.focus();
  }

  const visiveis = cabem === null ? main : main.slice(0, cabem);
  const escondidos = cabem === null ? [] : main.slice(cabem);
  const maisActivo = escondidos.some((i) => (i.children?.length
    ? grupoActivo(i.children, pathname)
    : i.to && (pathname === i.to || (!i.end && pathname.startsWith(`${i.to}/`)))));

  const fecharENavegar = () => { setAberto(null); onNavigate?.(); };

  const folha = (item, extra = '') => (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={fecharENavegar}
      className={({ isActive }) => `mn-item${isActive ? ' mn-active' : ''}${extra}`}
    >
      <Icon name={item.icon} size={16} className="mn-ico" />
      <span>{t(item.label)}</span>
      {badgeFor(item) ? <span className="mn-badge">{badgeFor(item)}</span> : null}
    </NavLink>
  );

  const filhos = (children) => children.map((c) => (
    <NavLink
      key={c.to}
      to={c.to}
      end={c.end}
      onClick={fecharENavegar}
      className={({ isActive }) => `mn-sub${isActive ? ' mn-active' : ''}`}
    >
      {t(c.label)}
    </NavLink>
  ));

  return (
    <nav className="mainnav" aria-label={t('Navegação')} ref={navRef} onKeyDown={onKeyDown}>
      <ul className="mn-list" ref={listRef}>
        {visiveis.map((item, i) => {
          const k = chave(item);
          if (!item.children?.length) {
            return <li key={k} className="mn-li" data-mn>{folha(item)}</li>;
          }
          const activo = grupoActivo(item.children, pathname);
          // Os dois últimos abrem alinhados à direita para não saírem do ecrã.
          const aoFundo = i >= visiveis.length - 2;
          return (
            <li key={k} className="mn-li" data-mn>
              <button
                type="button"
                className={`mn-item mn-toggle${activo ? ' mn-active-parent' : ''}`}
                aria-expanded={aberto === k}
                aria-haspopup="true"
                data-k={k}
                onClick={() => setAberto((v) => (v === k ? null : k))}
              >
                <Icon name={item.icon} size={16} className="mn-ico" />
                <span>{t(item.label)}</span>
                <Icon name="chevron" size={13} className="mn-arrow" />
              </button>
              {aberto === k ? (
                <div className={`mn-drop${aoFundo ? ' mn-drop-right' : ''}`}>{filhos(item.children)}</div>
              ) : null}
            </li>
          );
        })}

        {escondidos.length ? (
          <li className="mn-li mn-more">
            <button
              type="button"
              className={`mn-item mn-toggle${maisActivo ? ' mn-active-parent' : ''}`}
              aria-expanded={aberto === '__mais'}
              aria-haspopup="true"
              data-k="__mais"
              onClick={() => setAberto((v) => (v === '__mais' ? null : '__mais'))}
            >
              <span>{t('Mais')}</span>
              <Icon name="chevron" size={13} className="mn-arrow" />
            </button>
            {aberto === '__mais' ? (
              <div className="mn-drop mn-drop-right mn-drop-mais">
                {escondidos.map((item) => (item.children?.length ? (
                  <div key={chave(item)} className="mn-drop-grupo">
                    <div className="mn-drop-label">{t(item.label)}</div>
                    {filhos(item.children)}
                  </div>
                ) : (
                  <div key={chave(item)}>{folha(item, ' mn-item-drop')}</div>
                )))}
              </div>
            ) : null}
          </li>
        ) : null}
      </ul>

      {tail.length ? (
        <ul className="mn-tail">
          {tail.map((item, i) => (
            <li key={chave(item) || i} className="mn-li">
              {item.action === 'logout' ? (
                <button type="button" className="mn-item mn-action" onClick={onLogout}>
                  <Icon name={item.icon} size={16} className="mn-ico" />
                  <span>{t(item.label)}</span>
                </button>
              ) : folha(item)}
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}
