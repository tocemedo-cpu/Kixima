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
  // Um acordeão conta como "apoio" quando TODOS os seus filhos já eram — é o
  // caso do menu Chat (Suporte — Chat/Feedback, Chat Comercial), que antes
  // eram três itens soltos aqui reconhecidos um a um pelo `to`.
  const isTail = (item) => item.action === 'logout' || TAIL_PATHS.has(item.to)
    || (item.children?.length > 0 && item.children.every((c) => TAIL_PATHS.has(c.to)));
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
            badgeFor={badgeFor}
            onLogout={onLogout}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="sb-tail">
        <div className="sb-grupo g">{t('Apoio')}</div>
        {tail.map((item, i) => (
          <SidebarItem key={item.to || item.label || i} item={item} badge={badgeFor(item)} badgeFor={badgeFor} onLogout={onLogout} onNavigate={onNavigate} />
        ))}
      </div>
    </aside>
  );
}
