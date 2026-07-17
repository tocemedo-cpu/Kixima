// src/components/DataTable.jsx
export default function DataTable({ columns, rows, rowKey, onRowClick, emptyTitle, emptyBody }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="empty-state">
        <h3>{emptyTitle || 'Nada por aqui ainda'}</h3>
        <p>{emptyBody || 'Quando houver registos, vão aparecer nesta lista.'}</p>
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.header}</th>
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
