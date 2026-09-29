// src/components/Sidebar.jsx
// Navegação lateral da Proposta 04 · Bancada: fundo branco, rótulos de grupo em
// mono, o item activo com fundo areia e a barra vermelha à esquerda. Gera-se a
// partir do array data/sidebar.js — os itens, os acordeões, os contadores e o
// bloco final (Suporte, Chat Comercial, Ajuda, Sair) são exactamente os que já
// existiam. O logótipo e a conta vivem na barra de aplicação (Navbar).
import SidebarItem from './SidebarItem';
import { useI18n } from '../i18n';

const TAIL_PATHS = new Set(['/ajuda', '/suporte/chat', '/suporte/feedback', '/mensagens/chat-comercial']);

export default function Sidebar({ items, cartCount = 0, badges = {}, grupo, onLogout, onNavigate }) {
  const { t } = useI18n();
  const badgeFor = (item) => {
    if (item.badge === 'cart') return cartCount > 0 ? cartCount : null;
    const n = badges[item.badge];
    return n > 0 ? n : null;
  };
  const isTail = (item) => item.action === 'logout' || TAIL_PATHS.has(item.to);
  const main = items.filter((i) => !isTail(i));
  const tail = items.filter(isTail);

  return (
    <aside className="sb lateral">
      <nav className="sb-nav" aria-label={t('Navegação')}>
        {grupo ? <div className="sb-grupo g">{t(grupo)}</div> : null}
        {main.map((item, i) => (
          <SidebarItem
            key={`${item.to || item.label}-${i}`}
            item={item}
            num={i + 1}
            badge={badgeFor(item)}
            onLogout={onLogout}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="sb-tail">
        <div className="sb-grupo g">{t('Apoio')}</div>
        {tail.map((item, i) => (
          <SidebarItem key={item.to || item.label || i} item={item} badge={badgeFor(item)} onLogout={onLogout} onNavigate={onNavigate} />
        ))}
      </div>
    </aside>
  );
}
