// src/components/Navbar.jsx
// Barra de topo (mockup): hambúrguer, logótipo, pesquisa global, carrinho,
// notificações e menu do utilizador. Full-width acima do menu e do conteúdo.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { Icon } from './icons';

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

export default function Navbar({ user, roleLabel, cartCount = 0, unread = 0, onMenuToggle, onBell, onLogout }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  const isBuyer = user.role === 'COMPRADOR';

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function submitSearch(e) {
    e.preventDefault();
    const query = q.trim();
    if (isBuyer) navigate(`/comprador/servicos${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  }

  return (
    <header className="navbar">
      <div className="nav-left">
        <button className="nav-burger" onClick={onMenuToggle} aria-label="Menu">☰</button>
        <Link to="/" className="nav-logo"><Logo size={18} mark={40} subtitle /></Link>
      </div>

      <form className="nav-search" onSubmit={submitSearch}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar produtos, serviços ou fornecedores…" />
        <button type="submit" className="nav-search-btn" aria-label="Pesquisar"><Icon name="search" size={18} /></button>
      </form>

      <div className="nav-actions">
        {isBuyer ? (
          <Link to="/comprador/cesta" className="nav-icon" aria-label="Cesta">
            <Icon name="cart" size={20} />
            {cartCount > 0 ? <span className="nav-badge">{cartCount}</span> : null}
          </Link>
        ) : null}
        <button className="nav-icon" onClick={onBell} aria-label="Notificações">
          <Icon name="bell" size={20} />
          {unread > 0 ? <span className="nav-badge">{unread}</span> : null}
        </button>
        <div className="nav-user" ref={ref}>
          <button className="nav-user-btn" onClick={() => setMenu((v) => !v)}>
            <span className="nav-avatar">{initials(user.name)}</span>
            <span className="nav-user-meta"><strong>{user.name}</strong><span>{roleLabel}</span></span>
            <span className="nav-chevron">▾</span>
          </button>
          {menu ? (
            <div className="nav-dropdown">
              <Link to="/perfil" onClick={() => setMenu(false)}>Perfil</Link>
              <Link to="/seguranca" onClick={() => setMenu(false)}>Segurança</Link>
              <button onClick={onLogout}>Sair</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
