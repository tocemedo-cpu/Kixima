// Formatação usada SÓ pelos documentos imprimíveis (FeeStatement.jsx/
// PrintableDocument.jsx) — modelo oficial A4, formato próprio e fixo
// (separador de milhar por ponto, decimal por vírgula, moeda como sufixo
// cru, ex.: "5.100.000,00 AOA"), distinto de formatMoney() em domain.ts
// (que usa Intl com o símbolo "Kz"). Portado 1:1 das funções locais
// `money()`/`d()`/`dt()` duplicadas nos dois ficheiros React de origem.
export function formatMoneyDoc(v: string | number | null | undefined, cur = 'AOA'): string {
  const n = Number(v ?? 0).toFixed(2);
  const [int, dec] = n.split('.');
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec} ${cur}`;
}

export function formatDateDoc(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

export function formatDateTimeDoc(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}
