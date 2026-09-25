// Porta de categoryVisual()/CATEGORY_VISUAL em frontend/src/components/icons.jsx:81-100.
// Só a parte do ícone é usada nos ecrãs já migrados (ProductCoverComponent,
// Home do Comprador) — os gradientes `from`/`to` do React ainda não têm
// consumidor em Angular. Os nomes de ícone (valve, hydraulic, inspection,
// engineering, equipment, materials, consulting) ainda não foram portados
// para IconComponent — caem no 'box' por omissão, tal como o React fazia
// para qualquer categoria desconhecida (ver docs/migracao-angular/PLANO.md).
const CATEGORY_ICON: Record<string, string> = {
  Válvulas: 'valve',
  Hidráulica: 'hydraulic',
  'Inspeção & Ensaios': 'inspection',
  'Logística & Transporte': 'truck',
  Engenharia: 'engineering',
  Equipamentos: 'equipment',
  'Formação & Certificação': 'certification',
  Materiais: 'materials',
  Offshore: 'offshore',
  Consultoria: 'consulting',
};

export function categoryIcon(category?: string | null): string {
  return (category && CATEGORY_ICON[category]) || 'box';
}
