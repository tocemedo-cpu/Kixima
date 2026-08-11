// src/components/DataTable.jsx
// Tabela genérica. Traduz automaticamente os cabeçalhos das colunas e os
// textos do estado vazio via i18n.
import { useI18n } from '../i18n';

export default function DataTable({ columns, rows, rowKey, onRowClick, emptyTitle, emptyBody }) {
  const { t } = useI18n();
  if (!rows || rows.length === 0) {
    return (
      <div className="empty-state">
        <h3>{t(emptyTitle || 'Nada por aqui ainda')}</h3>
        <p>{t(emptyBody || 'Quando houver registos, vão aparecer nesta lista.')}</p>
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{typeof col.header === 'string' ? t(col.header) : col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row[rowKey]}
            className={onRowClick ? 'row-link' : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((col) => (
              <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
