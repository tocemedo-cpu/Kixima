// src/components/SidebarSubItem.jsx
// Folha de um submenu (accordion). Navega com o Link/NavLink do React Router
// (equivalente ao Link do Next.js nesta stack). Indentado para a direita.
import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function SidebarSubItem({ item, onNavigate }) {
  const { t } = useI18n();
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) => `sb-subitem${isActive ? ' sb-active' : ''}`}
    >
      <span className="sb-dot" aria-hidden="true" />
      <span>{t(item.label)}</span>
    </NavLink>
  );
}
