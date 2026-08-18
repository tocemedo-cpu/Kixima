// src/components/icons.jsx
// Conjunto de ícones inline (SVG, stroke = currentColor) para a navegação por
// módulo e para as categorias do setor. Um único sítio para a iconografia.

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };

const PATHS = {
  home: <path {...P} d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  search: <g {...P}><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></g>,
  catalog: <g {...P}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></g>,
  cart: <g {...P}><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.4 12.2a1 1 0 0 0 1 .8h9.1a1 1 0 0 0 1-.8L21 7H6" /></g>,
  orders: <g {...P}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></g>,
  checkout: <g {...P}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M2 10h20" /></g>,
  payment: <g {...P}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></g>,
  truck: <g {...P}><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></g>,
  reception: <g {...P}><path d="m9 12 2 2 4-4" /><rect x="4" y="4" width="16" height="16" rx="2" /></g>,
  suppliers: <g {...P}><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /><path d="M9 10h.01M15 10h.01" /></g>,
  building: <g {...P}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2" /></g>,
  users: <g {...P}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5" /><path d="M16 6a3 3 0 0 1 0 6M21 20c0-2.2-1.2-3.8-3-4.5" /></g>,
  approvals: <g {...P}><path d="M4 5h16v12H4z" /><path d="m8 11 2.5 2.5L16 8" /></g>,
  contract: <g {...P}><path d="M6 3h9l3 3v15H6z" /><path d="M9 9h6M9 13h6M9 17h4" /></g>,
  invoice: <g {...P}><path d="M6 2h9l3 3v17l-2.5-1.5L13 22l-2.5-1.5L8 22l-2.5-1.5L6 22z" /><path d="M9 8h6M9 12h6" /></g>,
  policy: <g {...P}><path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" /><path d="m9 12 2 2 4-4" /></g>,
  history: <g {...P}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4M12 7v5l3 2" /></g>,
  dueDiligence: <g {...P}><circle cx="11" cy="11" r="7" /><path d="m21 21-3.5-3.5M9 11l1.5 1.5L14 9" /></g>,
  chart: <g {...P}><path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></g>,
  profile: <g {...P}><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.3 3-6 7-6s7 2.7 7 6" /></g>,
  help: <g {...P}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.3" /><path d="M12 17h.01" /></g>,
  activities: <g {...P}><path d="M3 12h4l2 6 4-14 2 8h6" /></g>,

  // --- Categorias do setor ---
  valve: <g {...P}><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.5 5.5 8 8M16 16l2.5 2.5M18.5 5.5 16 8M8 16l-2.5 2.5" /></g>,
  inspection: <g {...P}><circle cx="11" cy="11" r="7" /><path d="m21 21-3.5-3.5M8.5 11l1.8 1.8L14 9" /></g>,
  engineering: <g {...P}><path d="M5 20V9l7-5 7 5v11" /><path d="M9 20v-5h6v5" /></g>,
  offshore: <g {...P}><path d="M12 3v18M5 8l7-5 7 5" /><circle cx="12" cy="14" r="3" /><path d="M3 21h18" /></g>,
  certification: <g {...P}><circle cx="12" cy="9" r="5" /><path d="m9 13-1.5 8L12 19l4.5 2L15 13" /><path d="m10 9 1.5 1.5L14 8" /></g>,
  consulting: <g {...P}><path d="M4 6h16M4 11h16M4 16h10" /></g>,
  materials: <g {...P}><path d="M3 8v8l9 5 9-5V8l-9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></g>,
  hydraulic: <g {...P}><path d="M4 12a4 4 0 0 1 8 0 4 4 0 0 0 8 0" /><path d="M4 17h16M4 7h16" /></g>,
  equipment: <g {...P}><rect x="4" y="8" width="16" height="10" rx="1.5" /><path d="M8 8V6h8v2M9 18v2M15 18v2" /></g>,
  training: <g {...P}><path d="M12 4 2 9l10 5 10-5z" /><path d="M6 11v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" /></g>,
  box: <g {...P}><path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></g>,
  // --- Navegação ERP (sidebar do fornecedor) ---
  chevron: <path {...P} d="m9 6 6 6-6 6" />,
  settings: <g {...P}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 2.6 1.6 1.6 0 0 0 10 1.1V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 17 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.1 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></g>,
  logout: <g {...P}><path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" /><path d="M10 17l5-5-5-5M15 12H3" /></g>,
  wallet: <g {...P}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 14h2" /></g>,
  warehouse: <g {...P}><path d="M3 21V8l9-4 9 4v13" /><path d="M7 21v-7h10v7M7 17h10" /></g>,
  tag: <g {...P}><path d="M3 3h8l10 10-8 8L3 11z" /><circle cx="7.5" cy="7.5" r="1.3" /></g>,
  layers: <g {...P}><path d="M12 3 2 8l10 5 10-5z" /><path d="m2 12 10 5 10-5M2 16l10 5 10-5" /></g>,
  shield: <g {...P}><path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" /></g>,
  bell: <g {...P}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></g>,
  report: <g {...P}><path d="M6 2h9l3 3v17H6z" /><path d="M9 13l2 2 4-4M9 8h6" /></g>,
  chat: <g {...P}><path d="M4 4h16v11H8l-4 4z" /><path d="M8 9h8M8 12.5h5" /></g>,
  alert: <g {...P}><path d="M12 3 2 20h20z" /><path d="M12 9v5M12 17h.01" /></g>,
};

export function Icon({ name, size = 18, className }) {
  const body = PATHS[name] || PATHS.box;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      {body}
    </svg>
  );
}

// Estrelas de avaliação (0–5), meia estrela incluída.
export function Stars({ value = 0, size = 13 }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${value} de 5`}>
      {'★'.repeat(full)}
      {half ? '⯪' : ''}
    </span>
  );
}

// Mapeia uma categoria a um ícone + gradiente para a "capa" do cartão.
// Paleta de marca (sem verde) — tons de aço, vinho, âmbar, ameixa e grafite.
const CATEGORY_VISUAL = {
  'Válvulas': { icon: 'valve', from: '#2a2f3a', to: '#14161c' },
  'Hidráulica': { icon: 'hydraulic', from: '#33241c', to: '#170f08' },
  'Inspeção & Ensaios': { icon: 'inspection', from: '#3a1f2a', to: '#170d13' },
  'Logística & Transporte': { icon: 'truck', from: '#2b2733', to: '#14121a' },
  'Engenharia': { icon: 'engineering', from: '#24272e', to: '#121317' },
  'Equipamentos': { icon: 'equipment', from: '#332a19', to: '#1a130c' },
  'Formação & Certificação': { icon: 'certification', from: '#2c1f3a', to: '#140d1c' },
  'Materiais': { icon: 'materials', from: '#2a2622', to: '#141210' },
  'Offshore': { icon: 'offshore', from: '#3a1526', to: '#1a0a12' },
  'Consultoria': { icon: 'consulting', from: '#262a31', to: '#131519' },
};

export function categoryVisual(category) {
  return CATEGORY_VISUAL[category] || { icon: 'box', from: '#262a31', to: '#131519' };
}
