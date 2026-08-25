// src/i18n/index.jsx
// Internacionalização leve (PT / EN / FR). A chave de tradução é o próprio texto
// em português; `t('Ordens de Compra')` devolve a tradução no idioma ativo, ou
// o texto original se ainda não estiver traduzido (fallback seguro para PT).
// O idioma escolhido persiste em localStorage e aplica-se também à formatação
// de datas e números (Intl) via `locale`.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EN2, FR2 } from './content';
import { EN3, FR3 } from './content2';
import { EN4, FR4 } from './content3';
import { EN5, FR5 } from './content4';
import { EN6, FR6 } from './content5';
import { EN7, FR7 } from './content6';
import { EN8, FR8 } from './content7';
// Texto de interface criado no SERVIDOR (cartões, tarefas, relatórios).
import { EN9, FR9 } from './content8';
import { EN10, FR10 } from './content9';
import { EN11, FR11 } from './content10';
import { EN12, FR12 } from './content11';
import { EN13, FR13 } from './content12';

export const LANGS = [
  { code: 'pt', label: 'Português', flag: '🇦🇴' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

// Locale Intl por idioma (datas, números, moeda).
export const LOCALES = { pt: 'pt-AO', en: 'en-GB', fr: 'fr-FR' };

const EN = {
  // Navegação
  'Dashboard': 'Dashboard', 'Catálogo': 'Catalog', 'Produtos': 'Products', 'Serviços': 'Services',
  'Categorias': 'Categories', 'Marcas': 'Brands', 'Kits': 'Kits', 'Promoções': 'Promotions',
  'Inventário': 'Inventory', 'Stock': 'Stock', 'Entradas': 'Inbound', 'Saídas': 'Outbound', 'Armazéns': 'Warehouses',
  'Pedidos': 'Orders', 'Solicitações': 'Requests', 'Cotações': 'Quotes', 'Ordens': 'Orders', 'Histórico': 'History',
  'Financeiro': 'Finance', 'Pagamentos': 'Payments', 'Faturas': 'Invoices', 'Carteira': 'Wallet',
  'Documentação': 'Documentation', 'Certificados de Produto': 'Product Certificates', 'Catálogos PDF': 'PDF Catalogs', 'Fichas Técnicas': 'Datasheets',
  'Relatórios': 'Reports', 'Produtos mais vistos': 'Most viewed products', 'Produtos mais vendidos': 'Best-selling products', 'Estatísticas': 'Statistics',
  'Configurações': 'Settings', 'Perfil': 'Profile', 'Segurança': 'Security', 'Notificações': 'Notifications', 'Ajuda': 'Help', 'Sair': 'Log out',
  'Home Marketplace': 'Home Marketplace', 'Explorar / Pesquisa': 'Explore / Search', 'Produtos / Serviços': 'Products / Services',
  'Minha Cesta': 'My Cart', 'Checkout': 'Checkout', 'Ordens de Compra': 'Purchase Orders', 'Todas as Ordens': 'All Orders',
  'Acompanhar Entrega': 'Track Delivery', 'Recepção': 'Receiving', 'Pagamento': 'Payment', 'Fornecedores': 'Suppliers', 'Atividades': 'Activities',
  'Usuários & Perfis': 'Users & Profiles', 'Permissões': 'Permissions', 'Perfil da Empresa': 'Company Profile', 'Documentos da Empresa': 'Company Documents',
  'Aprovações de PO': 'PO Approvals', 'Contratos': 'Contracts', 'Centro Financeiro': 'Finance Center',
  'Credenciamento': 'Onboarding', 'Cadastro de Empresas': 'Company Registration', 'Empresas': 'Companies',
  'Gestão de Apólices': 'Policy Management', 'Contratos-Quadro': 'Framework Contracts', 'Configurações e Suporte': 'Settings & Support', 'Gestão de Atividades': 'Activity Management',
  // Header / login
  'Pesquisar produtos, serviços ou fornecedores…': 'Search products, services or suppliers…',
  'Idioma': 'Language',
  'Entrar': 'Sign in', 'Palavra-passe': 'Password', 'Email': 'Email', 'A entrar…': 'Signing in…',
  'Plataforma B2B de Procurement Garantido': 'Guaranteed Procurement B2B Platform',
  'Aceda com a sua conta KIXIMA.': 'Sign in with your KIXIMA account.',
  'A sua empresa ainda não está na KIXIMA?': 'Is your company not on KIXIMA yet?',
  'Registe-a aqui': 'Register it here',
};

const FR = {
  'Dashboard': 'Tableau de bord', 'Catálogo': 'Catalogue', 'Produtos': 'Produits', 'Serviços': 'Services',
  'Categorias': 'Catégories', 'Marcas': 'Marques', 'Kits': 'Kits', 'Promoções': 'Promotions',
  'Inventário': 'Inventaire', 'Stock': 'Stock', 'Entradas': 'Entrées', 'Saídas': 'Sorties', 'Armazéns': 'Entrepôts',
  'Pedidos': 'Commandes', 'Solicitações': 'Demandes', 'Cotações': 'Devis', 'Ordens': 'Commandes', 'Histórico': 'Historique',
  'Financeiro': 'Finances', 'Pagamentos': 'Paiements', 'Faturas': 'Factures', 'Carteira': 'Portefeuille',
  'Documentação': 'Documentation', 'Certificados de Produto': 'Certificats de produit', 'Catálogos PDF': 'Catalogues PDF', 'Fichas Técnicas': 'Fiches techniques',
  'Relatórios': 'Rapports', 'Produtos mais vistos': 'Produits les plus vus', 'Produtos mais vendidos': 'Produits les plus vendus', 'Estatísticas': 'Statistiques',
  'Configurações': 'Paramètres', 'Perfil': 'Profil', 'Segurança': 'Sécurité', 'Notificações': 'Notifications', 'Ajuda': 'Aide', 'Sair': 'Se déconnecter',
  'Home Marketplace': 'Accueil Marketplace', 'Explorar / Pesquisa': 'Explorer / Recherche', 'Produtos / Serviços': 'Produits / Services',
  'Minha Cesta': 'Mon panier', 'Checkout': 'Commander', 'Ordens de Compra': 'Bons de commande', 'Todas as Ordens': 'Tous les bons',
  'Acompanhar Entrega': 'Suivi de livraison', 'Recepção': 'Réception', 'Pagamento': 'Paiement', 'Fornecedores': 'Fournisseurs', 'Atividades': 'Activités',
  'Usuários & Perfis': 'Utilisateurs & Profils', 'Permissões': 'Permissions', 'Perfil da Empresa': "Profil de l'entreprise", 'Documentos da Empresa': "Documents de l'entreprise",
  'Aprovações de PO': 'Approbations de BC', 'Contratos': 'Contrats', 'Centro Financeiro': 'Centre financier',
  'Credenciamento': 'Accréditation', 'Cadastro de Empresas': "Enregistrement d'entreprises", 'Empresas': 'Entreprises',
  'Gestão de Apólices': 'Gestion des polices', 'Contratos-Quadro': 'Contrats-cadres', 'Configurações e Suporte': 'Paramètres et support', 'Gestão de Atividades': 'Gestion des activités',
  'Pesquisar produtos, serviços ou fornecedores…': 'Rechercher produits, services ou fournisseurs…',
  'Idioma': 'Langue',
  'Entrar': 'Se connecter', 'Palavra-passe': 'Mot de passe', 'Email': 'E-mail', 'A entrar…': 'Connexion…',
  'Plataforma B2B de Procurement Garantido': 'Plateforme B2B d’approvisionnement garanti',
  'Aceda com a sua conta KIXIMA.': 'Connectez-vous avec votre compte KIXIMA.',
  'A sua empresa ainda não está na KIXIMA?': "Votre entreprise n'est pas encore sur KIXIMA ?",
  'Registe-a aqui': 'Inscrivez-la ici',
};

const DICT = { en: { ...EN2, ...EN3, ...EN4, ...EN5, ...EN6, ...EN7, ...EN8, ...EN9, ...EN10, ...EN11, ...EN12, ...EN13, ...EN }, fr: { ...FR2, ...FR3, ...FR4, ...FR5, ...FR6, ...FR7, ...FR8, ...FR9, ...FR10, ...FR11, ...FR12, ...FR13, ...FR } };
const STORAGE_KEY = 'kixima_lang';

const I18nContext = createContext(null);

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return LANGS.some((l) => l.code === v) ? v : 'pt';
  } catch {
    return 'pt';
  }
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(readStored);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((code) => {
    if (!LANGS.some((l) => l.code === code)) return;
    setLangState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* modo privado */ }
    // Guarda também no SERVIDOR: os emails são escritos lá, e o localStorage do
    // browser não lhe chega. Sem sessão iniciada o pedido falha e ignora-se —
    // a escolha local vale na mesma.
    fetch('/api/users/me/locale', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('kixima_token') ? { Authorization: `Bearer ${localStorage.getItem('kixima_token')}` } : {}),
      },
      body: JSON.stringify({ locale: code }),
    }).catch(() => { /* sem sessão ou offline: a escolha local basta */ });
  }, []);

  const t = useCallback((key, vars) => {
    let s = (lang !== 'pt' && DICT[lang]?.[key]) || key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  }, [lang]);

  const locale = LOCALES[lang] || LOCALES.pt;
  const value = useMemo(() => ({ lang, locale, setLang, t }), [lang, locale, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) return { lang: 'pt', locale: LOCALES.pt, setLang: () => {}, t: (k) => k };
  return ctx;
}

// Tradução FORA de componentes React (ex.: cliente da API, que traduz as
// mensagens do servidor à chegada). Usa o mesmo dicionário e o idioma guardado.
export function translate(key, vars) {
  const lang = readStored();
  let s = (lang !== 'pt' && DICT[lang]?.[key]) || key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

// Locale ativo para código FORA de componentes React (formatMoney/formatDate em
// domain.js). Lê o mesmo storage; o provider mantém o <html lang> em dia.
export function activeLocale() {
  return LOCALES[readStored()] || LOCALES.pt;
}
export function activeLang() {
  return readStored();
}
