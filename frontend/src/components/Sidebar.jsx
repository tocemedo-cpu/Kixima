// src/components/Sidebar.jsx
// Menu lateral escuro e numerado (estilo do mockup). Gera-se a partir do array
// data/sidebar.js. Os itens principais são numerados (1., 2., …); Ajuda e Sair
// aparecem sem número no fundo. O logótipo e o utilizador vivem na navbar.
import SidebarItem from './SidebarItem';

const TAIL_PATHS = new Set(['/ajuda', '/suporte/chat', '/mensagens/chat-comercial']);

export default function Sidebar({ items, cartCount = 0, badges = {}, onLogout, onNavigate }) {
  const badgeFor = (item) => {
    if (item.badge === 'cart') return cartCount > 0 ? cartCount : null;
    const n = badges[item.badge];
    return n > 0 ? n : null;
  };
  const isTail = (item) => item.action === 'logout' || TAIL_PATHS.has(item.to);
  const main = items.filter((i) => !isTail(i));
  const tail = items.filter(isTail);

  return (
    <aside className="sb">
      <nav className="sb-nav">
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
        {tail.map((item, i) => (
          <SidebarItem key={item.to || item.label || i} item={item} onLogout={onLogout} onNavigate={onNavigate} />
        ))}
      </div>
    </aside>
  );
}
