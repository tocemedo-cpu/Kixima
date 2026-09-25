# Carga indicativa — http://localhost:4001 · 20 clientes · 15.0s

| pedido | n | p50 ms | p95 ms | p99 ms | máx ms | 4xx | 5xx |
|---|---:|---:|---:|---:|---:|---:|---:|
| catálogo | 780 | 39 | 86 | 112 | 185 | 0 | 0 |
| pesquisa | 782 | 45 | 98 | 124 | 194 | 0 | 0 |
| facets | 778 | 38 | 90 | 118 | 152 | 0 | 0 |
| dashboard | 777 | 42 | 94 | 113 | 177 | 0 | 0 |
| auth/me | 778 | 26 | 64 | 86 | 166 | 0 | 0 |
| POs | 778 | 57 | 110 | 135 | 170 | 0 | 0 |
| relatório | 775 | 47 | 96 | 126 | 193 | 0 | 0 |
| admin/activities | 776 | 51 | 103 | 145 | 184 | 0 | 0 |
| planos (público) | 777 | 7 | 21 | 36 | 47 | 0 | 0 |
| **total** | 7001 | 40 | 94 | 122 | 194 | 0 | 0 |

Débito: 465.6 pedidos/s · 5xx: 0
