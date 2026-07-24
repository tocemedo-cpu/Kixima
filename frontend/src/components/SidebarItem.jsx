// src/components/SidebarItem.jsx
// Item de topo da sidebar. Três variantes conforme a definição em data/sidebar.js:
//   - com `children` -> accordion expansível (submenus com animação);
//   - com `action: 'logout'` -> botão de ação;
//   - caso contrário -> link direto (NavLink).
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from './icons';
import SidebarSubItem from './SidebarSubItem';

// Uma rota "pertence" ao módulo se for igual a um `to` de um filho ou começar por ele.
function moduleIsActive(children, pathname) {
  return children.some((c) => pathname === c.to || pathname.startsWith(c.to + '/'));
}

export default function SidebarItem({ item, badge, num, onLogout, onNavigate }) {
  const { pathname } = useLocation();
  const numEl = num ? <span className="sb-num">{num}.</span> : null;

  // Ação (Sair).
  if (item.action === 'logout') {
    return (
      <button type="button" className="sb-item sb-action" onClick={onLogout}>
        <Icon name={item.icon} size={18} className="sb-ico" />
        <span>{item.label}</span>
      </button>
    );
  }

  // Accordion (tem submenus).
  if (item.children?.length) {
    return <AccordionItem item={item} pathname={pathname} num={num} onNavigate={onNavigate} />;
  }

  // Link direto.
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) => `sb-item${isActive ? ' sb-active' : ''}`}
    >
      {numEl}
      <Icon name={item.icon} size={18} className="sb-ico" />
      <span>{item.label}</span>
      {badge ? <span className="sb-badge">{badge}</span> : null}
    </NavLink>
  );
}

function AccordionItem({ item, pathname, num, onNavigate }) {
  const active = moduleIsActive(item.children, pathname);
  // Abre por defeito quando a rota atual pertence ao módulo; o utilizador pode
  // depois abrir/fechar manualmente.
  const [open, setOpen] = useState(active);

  // Mantém o submenu aberto ao navegar para uma página do mesmo módulo.
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div className="sb-group">
      <button
        type="button"
        className={`sb-item sb-toggle${active ? ' sb-active-parent' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {num ? <span className="sb-num">{num}.</span> : null}
        <Icon name={item.icon} size={18} className="sb-ico" />
        <span>{item.label}</span>
        <Icon name="chevron" size={15} className={`sb-arrow${open ? ' sb-arrow-open' : ''}`} />
      </button>

      {/* Wrapper animado (grid 0fr->1fr anima a altura suavemente). */}
      <div className={`sb-sub-wrap${open ? ' open' : ''}`}>
        <div className="sb-sub-inner">
          {item.children.map((child) => (
            <SidebarSubItem key={child.to} item={child} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
}
