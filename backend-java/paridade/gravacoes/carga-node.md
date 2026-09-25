# Carga indicativa — http://localhost:4000 · 20 clientes · 15.0s

| pedido | n | p50 ms | p95 ms | p99 ms | máx ms | 4xx | 5xx |
|---|---:|---:|---:|---:|---:|---:|---:|
| catálogo | 841 | 36 | 52 | 67 | 103 | 0 | 0 |
| pesquisa | 841 | 49 | 70 | 85 | 149 | 0 | 0 |
| facets | 841 | 36 | 53 | 67 | 90 | 0 | 0 |
| dashboard | 837 | 32 | 48 | 70 | 86 | 0 | 0 |
| auth/me | 834 | 21 | 35 | 47 | 116 | 0 | 0 |
| POs | 836 | 40 | 57 | 71 | 95 | 0 | 0 |
| relatório | 838 | 47 | 68 | 83 | 105 | 0 | 0 |
| admin/activities | 839 | 77 | 100 | 126 | 159 | 0 | 0 |
| planos (público) | 839 | 10 | 22 | 31 | 51 | 0 | 0 |
| **total** | 7546 | 38 | 80 | 96 | 159 | 0 | 0 |

Débito: 502.6 pedidos/s · 5xx: 0
