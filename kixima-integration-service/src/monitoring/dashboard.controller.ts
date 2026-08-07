import { Controller, Get, Header } from '@nestjs/common';

/**
 * Painel de monitorização visual — página HTML autossuficiente servida pelo
 * próprio microserviço. Consome /monitoring/overview e /monitoring/dead-letters
 * e permite reprocessar (replay) itens da Dead Letter.
 */
@Controller()
export class DashboardController {
  @Get('dashboard')
  @Header('Content-Type', 'text/html; charset=utf-8')
  dashboard(): string {
    return PAGE;
  }
}

const PAGE = `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>KIXIMA Integration — Monitorização</title>
<style>
  :root { --bg:#0b0f16; --panel:#141a24; --line:#232c3a; --ink:#e6edf5; --sub:#8aa0b6; --red:#e11d2a; --green:#22c55e; --amber:#f5a623; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 system-ui,Segoe UI,Roboto,sans-serif; }
  header { display:flex; align-items:center; gap:12px; padding:16px 24px; border-bottom:1px solid var(--line); }
  header .dot { width:12px; height:12px; border-radius:50%; background:var(--red); box-shadow:0 0 12px var(--red); }
  header h1 { font-size:16px; margin:0; letter-spacing:.5px; }
  header .status { margin-left:auto; font-size:12px; color:var(--sub); }
  main { padding:24px; max-width:1100px; margin:0 auto; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; margin-bottom:22px; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .card .label { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--sub); }
  .card .value { font-size:26px; font-weight:700; margin-top:6px; }
  .value.green{color:var(--green)} .value.red{color:var(--red)} .value.amber{color:var(--amber)}
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:var(--sub); margin:22px 0 10px; }
  table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  th,td { text-align:left; padding:10px 14px; border-bottom:1px solid var(--line); font-size:13px; }
  th { color:var(--sub); font-weight:600; }
  tr:last-child td { border-bottom:none; }
  .btn { background:var(--red); color:#fff; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; font-size:12px; }
  .btn:hover { filter:brightness(1.1); }
  .empty { color:var(--sub); padding:16px; }
  code { color:var(--amber); }
</style>
</head>
<body>
  <header>
    <span class="dot"></span>
    <h1>KIXIMA · Integration Service</h1>
    <span class="status" id="status">a ligar…</span>
  </header>
  <main>
    <h2>Eventos</h2>
    <div class="grid" id="events"></div>
    <h2>Fila (BullMQ)</h2>
    <div class="grid" id="queue"></div>
    <h2>Dead Letter <span id="dlqcount"></span></h2>
    <table>
      <thead><tr><th>Evento</th><th>Tipo</th><th>Routing key</th><th>Erro</th><th></th></tr></thead>
      <tbody id="dlq"><tr><td class="empty" colspan="5">a carregar…</td></tr></tbody>
    </table>
  </main>
<script>
  // Os endpoints de monitorização exigem o token de administração
  // (INTEGRATION_ADMIN_TOKEN). Aceita ?token=... no URL ou pede uma vez.
  const params = new URLSearchParams(location.search);
  let TOKEN = params.get('token') || sessionStorage.getItem('kx_admin_token') || '';
  if (!TOKEN) { TOKEN = prompt('Token de administração (INTEGRATION_ADMIN_TOKEN):') || ''; }
  if (TOKEN) sessionStorage.setItem('kx_admin_token', TOKEN);
  const authFetch = (url, opts = {}) =>
    fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + TOKEN } });
  const cardsInto = (el, items) => {
    el.innerHTML = items.map(i =>
      '<div class="card"><div class="label">'+i.label+'</div><div class="value '+(i.tone||'')+'">'+i.value+'</div></div>'
    ).join('');
  };
  async function refresh() {
    try {
      const ov = await (await authFetch('/monitoring/overview')).json();
      cardsInto(document.getElementById('events'), [
        { label:'Recebidos', value: ov.events.received },
        { label:'Em processamento', value: ov.events.processing, tone:'amber' },
        { label:'Concluídos', value: ov.events.completed, tone:'green' },
        { label:'Falhados', value: ov.events.failed, tone:'red' },
        { label:'Dead Letter', value: ov.events.deadLetter, tone:'red' },
        { label:'Duplicados', value: ov.events.duplicate },
      ]);
      cardsInto(document.getElementById('queue'), [
        { label:'À espera', value: ov.queue.waiting },
        { label:'Ativos', value: ov.queue.active, tone:'amber' },
        { label:'Falhados', value: ov.queue.failed, tone:'red' },
        { label:'Webhooks pendentes', value: ov.pendingWebhooks },
      ]);
      const dl = await (await authFetch('/monitoring/dead-letters')).json();
      document.getElementById('dlqcount').textContent = dl.length ? '('+dl.length+')' : '';
      const body = document.getElementById('dlq');
      body.innerHTML = dl.length ? dl.map(d =>
        '<tr><td><code>'+d.eventId.slice(0,8)+'</code></td><td>'+d.eventType+'</td><td>'+d.routingKey+'</td>'+
        '<td>'+(d.lastError||'').slice(0,80)+'</td>'+
        '<td><button class="btn" onclick="replay(\\''+d.id+'\\')">Reprocessar</button></td></tr>'
      ).join('') : '<tr><td class="empty" colspan="5">Sem itens em Dead Letter 🎉</td></tr>';
      document.getElementById('status').textContent = 'atualizado ' + new Date().toLocaleTimeString();
    } catch (e) {
      document.getElementById('status').textContent = 'sem ligação ao serviço';
    }
  }
  async function replay(id) {
    await authFetch('/monitoring/dead-letters/'+id+'/replay', { method:'POST' });
    refresh();
  }
  refresh();
  setInterval(refresh, 5000);
</script>
</body>
</html>`;
