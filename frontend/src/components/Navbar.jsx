// src/components/Navbar.jsx
// A barra de aplicação da Proposta 04 · Bancada: "uma só barra no topo com
// marca, pesquisa global, notificações e conta. Nunca desaparece e é a mesma
// nas cinco personas. Na KIXIMA fica preta com o fio Samakaka por baixo."
// Full-width acima do menu e do conteúdo. Tudo o que aqui estava continua
// (hambúrguer, cesta do comprador, sino, idioma, perfil, segurança, sair) —
// o nome e o papel da pessoa passam para o cabeçalho do menu da conta, e a
// barra mostra a empresa, como na proposta.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { Icon } from './icons';
import { useI18n, LANGS } from '../i18n';
import { SeletorDeFundo } from '../tema/TemaContext';

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

export default function Navbar({ user, roleLabel, empresa: empresaProp, cartCount = 0, unread = 0, onMenuToggle, onBell, onLogout }) {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  const isBuyer = user.role === 'COMPRADOR';

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function submitSearch(e) {
    e.preventDefault();
    const query = q.trim();
    if (isBuyer) navigate(`/comprador/servicos${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  }

  // O Admin do Sistema não tem empresa: a barra diz a plataforma, como na proposta.
  const empresa = empresaProp || user.companyName || (user.role === 'ADMIN_SISTEMA' ? 'APP-KIXIMA.NET' : '');

  return (
    <header className="navbar shell">
      <div className="nav-left">
        <button className="nav-burger" onClick={onMenuToggle} aria-label={t('Menu')}>☰</button>
        <Link to="/" className="nav-logo" aria-label="KIXIMA"><Logo size={14} mark={22} light net /></Link>
        <span className="nav-sep" aria-hidden="true" />
      </div>

      <form className="nav-search busca" onSubmit={submitSearch} role="search">
        <button type="submit" className="nav-search-btn" aria-label={t('Pesquisar')}><Icon name="search" size={17} /></button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Pesquisar produtos, serviços ou fornecedores…')} />
      </form>

      <div className="nav-actions acc">
        {isBuyer ? (
          <Link to="/comprador/cesta" className="nav-icon sino" aria-label={t('Cesta')}>
            <Icon name="cart" size={19} />
            {cartCount > 0 ? <b className="nav-badge">{cartCount}</b> : null}
          </Link>
        ) : null}
        <button className="nav-icon sino" onClick={onBell} aria-label={t('Notificações')}>
          <Icon name="bell" size={19} />
          {unread > 0 ? <b className="nav-badge">{unread}</b> : null}
        </button>
        {empresa ? <span className="nav-company" title={empresa}>{empresa}</span> : null}
        <div className="nav-user" ref={ref}>
          <button className="nav-user-btn" onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} aria-label={t('Conta')}>
            <span className="nav-avatar av">{user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} /> : initials(user.name)}</span>
            <span className="nav-user-meta"><strong>{user.name}</strong><span>{t(roleLabel)}</span></span>
            <span className="nav-chevron">▾</span>
          </button>
          {menu ? (
            <div className="nav-dropdown">
              <div className="nav-dropdown-head">
                <strong>{user.name}</strong>
                <span>{t(roleLabel)}{empresa ? ` · ${empresa}` : ''}</span>
              </div>
              <Link to="/perfil" onClick={() => setMenu(false)}>{t('Perfil')}</Link>
              <Link to="/seguranca" onClick={() => setMenu(false)}>{t('Segurança')}</Link>
              <div className="nav-langs" role="group" aria-label={t('Idioma')}>
                <span className="nav-langs-label">{t('Idioma')}</span>
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    className={`nav-lang${l.code === lang ? ' on' : ''}`}
                    onClick={() => { setLang(l.code); setMenu(false); }}
                    title={l.label}
                  >
                    {l.flag} {l.label}
                  </button>
                ))}
              </div>
              <div className="nav-fundo">
                <span className="nav-langs-label">{t('Fundo')}</span>
                <SeletorDeFundo />
              </div>
              <button onClick={onLogout}>{t('Sair')}</button>
            </div>
          ) : null}
        </div>
      </div>
      {/* O fio Samakaka por baixo da barra preta — vermelho, ocre, marfim. */}
      <div className="fio" aria-hidden="true" />
    </header>
  );
}
