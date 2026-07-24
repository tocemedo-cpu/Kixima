// src/components/Sidebar.jsx
// Sidebar ERP dinâmica: gera todo o menu a partir de um array (data/sidebar.js)
// por map(), sem código repetido. Suporta links, accordions multinível e a ação
// de sair. Fundo preto, item ativo vermelho, ícones/texto brancos, cantos
// arredondados, transições suaves e scroll automático.
import SidebarItem from './SidebarItem';
import Logo from './Logo';

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

export default function Sidebar({ items, user, roleLabel, cartCount = 0, onLogout, onNavigate }) {
  const badgeFor = (item) => (item.badge === 'cart' && cartCount > 0 ? cartCount : null);

  return (
    <aside className="sb">
      <div className="sb-brand">
        <Logo size={20} mark={48} subtitle light />
      </div>

      <nav className="sb-nav">
        {items.map((item, i) => (
          <SidebarItem
            key={item.to || `${item.label}-${i}`}
            item={item}
            badge={badgeFor(item)}
            onLogout={onLogout}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="sb-user">
        <span className="sb-avatar">{initials(user?.name)}</span>
        <span className="sb-user-meta">
          <strong>{user?.name}</strong>
          <span>{roleLabel}</span>
        </span>
      </div>
    </aside>
  );
}
