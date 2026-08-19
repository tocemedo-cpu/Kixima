// src/api/client.js
// Cliente HTTP fino sobre fetch. Injeta o token JWT guardado e normaliza erros
// no formato { error: { code, message } } devolvido pelo backend.
//
// i18n: as mensagens do servidor chegam em português (que é a CHAVE de
// tradução) e são traduzidas AQUI, à chegada — assim qualquer ecrã que mostre
// err.message já a recebe no idioma ativo, sem ter de traduzir em cada sítio.
import { translate } from '../i18n';

// A SESSÃO JÁ NÃO PASSA POR AQUI.
//
// Estava no localStorage, que é legível por qualquer JavaScript da página. Uma
// única falha de XSS — num campo de texto, numa dependência, num ficheiro
// servido na mesma origem — entregava uma sessão completa de alguém que aprova
// pagamentos, válida até expirar. Agora o servidor põe um cookie httpOnly: o
// browser envia-o em cada pedido e o código desta aplicação nunca lhe toca,
// nem consegue.
//
// É por isso que não há aqui nenhum getToken/setToken. Se voltarem a aparecer,
// a proteção desaparece com eles.

// `credentials: 'include'` em TODOS os pedidos: sem isto o browser não envia o
// cookie para outra origem, e em desenvolvimento (Vite na 5173, API na 4000) o
// login funcionava e o pedido seguinte vinha sem sessão.
const COM_SESSAO = { credentials: 'include' };

// --- Base da API: relativa na Web, absoluta dentro do Capacitor -----------
//
// Um caminho relativo ('/api/auth/login') resolve-se contra a origem da
// página atual. Isso é exatamente o que se quer em dois dos três ambientes:
// em desenvolvimento o Vite tem um proxy de '/api' para o backend local, e em
// produção o SPA e a API são servidos pela mesma origem (kixima.net). Mas
// dentro do shell nativo do Capacitor a página NÃO corre a partir de
// kixima.net — corre de capacitor://localhost (ou https://localhost,
// consoante o androidScheme) — por isso o mesmo caminho relativo nunca chega
// ao backend a sério: resolve-se contra esse esquema falso, o fetch falha ou
// devolve algo que não é a resposta da API, e o código que se segue (ex.:
// `result.requires2fa` no login) rebenta contra `null`.
//
// `window.Capacitor` é injetado pelo próprio runtime nativo — não precisa de
// importar @capacitor/core aqui, e por isso esta deteção funciona mesmo que o
// pacote não esteja instalado neste momento. Em qualquer página Web normal
// (dev ou produção) `window.Capacitor` simplesmente não existe, e o resultado
// é sempre '' — comportamento em tudo igual ao de antes desta alteração.
function ehAppNativa() {
  return typeof window !== 'undefined'
    && !!window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform();
}

// Sem barra final e sem '/api' — os caminhos chamados em toda a app já
// começam por '/api/...'; juntar aqui outro '/api' duplicava-o
// (kixima.net/api/api/auth/login). Configurável por VITE_API_BASE_URL para
// apontar uma build nativa a outro anfitrião (ex.: o Render direto) sem
// mexer no código.
const API_BASE_URL = ehAppNativa() ? (import.meta.env.VITE_API_BASE_URL || 'https://kixima.net') : '';

// --- Sessão nativa: Bearer em memória, nunca em localStorage ---------------
//
// O cookie httpOnly é a autenticação da Web e continua a ser tentado em
// TODOS os pedidos (`credentials: 'include'`, sempre). Mas dentro do
// Capacitor o pedido é genuinamente cross-origin (capacitor://localhost /
// https://localhost -> kixima.net) e o cookie `SameSite=Lax` da sessão (ver
// backend/src/utils/sessionCookie.js — Lax é a defesa contra CSRF na Web, e
// não se justifica enfraquecê-la para todos só por causa da app nativa) pode
// simplesmente não chegar a ser guardado ou reenviado pelo WebView.
//
// A resposta do login/2FA já devolve `token` no corpo — não é um sistema de
// autenticação novo, é o Bearer que o middleware do backend já aceita como
// alternativa ao cookie (ver backend/src/middleware/auth.js), pensado
// precisamente para "clientes programáticos". Guarda-se aqui SÓ em memória:
// perde-se ao matar a app, tal como qualquer variável de módulo — é a troca
// deliberada por nunca o expor a um XSS via localStorage/sessionStorage. Na
// Web isto fica sempre null (o setter recusa-se fora do Capacitor) e o
// comportamento é exatamente o de sempre: só cookie.
let bearerNativo = null;

export function definirBearerNativo(token) {
  if (ehAppNativa()) bearerNativo = token || null;
}

function headersComSessao(extra) {
  const headers = { ...extra };
  if (bearerNativo) headers.Authorization = `Bearer ${bearerNativo}`;
  return headers;
}

// Ainda é preciso saber se HÁ sessão, para decisões de interface (o destino de
// um botão numa página pública). O cookie é httpOnly e não se lê — o servidor
// devolve esta marca, que não é credencial nenhuma e não serve para autenticar.
const MARCA_DE_SESSAO = 'kixima_tem_sessao';

export function temSessao() {
  return localStorage.getItem(MARCA_DE_SESSAO) === '1';
}

export function marcarSessao(ativa) {
  if (ativa) localStorage.setItem(MARCA_DE_SESSAO, '1');
  else localStorage.removeItem(MARCA_DE_SESSAO);
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(path, API_BASE_URL || window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
  }

  // A URL completa (não só pathname+search): contra a própria origem isto
  // resolve-se em tudo igual a um caminho relativo, e é o que torna a base
  // absoluta acima (API_BASE_URL) capaz de sair da origem falsa do Capacitor.
  const res = await fetch(url.toString(), {
    method,
    headers: headersComSessao({ 'Content-Type': 'application/json' }),
    body: body ? JSON.stringify(body) : undefined,
    ...COM_SESSAO,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = data?.error?.message
      ? translate(data.error.message)
      : translate('Erro {status} ao contactar a API.', { status: res.status });
    const err = new Error(message);
    err.rawMessage = data?.error?.message ?? null;
    err.code = data?.error?.code;
    err.status = res.status;
    throw err;
  }

  // Sucesso HTTP mas sem corpo JSON válido: nunca devolver `null` em silêncio.
  // Todas as rotas usadas por este cliente respondem sempre com JSON — um
  // corpo vazio ou não-JSON aqui é sempre um sinal de que o pedido não
  // chegou à API a sério (ex.: base da URL errada), não um caminho normal.
  // Sem isto, quem lê `result.requires2fa` ou qualquer outro campo rebentava
  // com "Cannot read properties of null", sem pista nenhuma da causa real.
  if (data === null) {
    const err = new Error(translate('A API respondeu sem dados válidos — verifique a ligação.'));
    err.status = res.status;
    throw err;
  }

  return data;
}

// Upload de ficheiro (multipart/form-data). Não define Content-Type — o browser
// trata do boundary. Injeta o JWT e normaliza erros como o request().
async function uploadFile(path, file, field = 'image') {
  const formData = new FormData();
  formData.append(field, file);
  const url = new URL(path, API_BASE_URL || window.location.origin);
  const res = await fetch(url.toString(), { method: 'POST', body: formData, headers: headersComSessao(), ...COM_SESSAO });
  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json().catch(() => null)
    : null;
  if (!res.ok) {
    const err = new Error(data?.error?.message
      ? translate(data.error.message)
      : translate('Erro {status} ao enviar o ficheiro.', { status: res.status }));
    err.rawMessage = data?.error?.message ?? null;
    err.code = data?.error?.code;
    err.status = res.status;
    throw err;
  }
  if (data === null) {
    const err = new Error(translate('A API respondeu sem dados válidos — verifique a ligação.'));
    err.status = res.status;
    throw err;
  }
  return data;
}

// POST de um FormData já montado (multipart) — ex.: cadastro com documentos.
async function postForm(path, formData) {
  const url = new URL(path, API_BASE_URL || window.location.origin);
  const res = await fetch(url.toString(), { method: 'POST', body: formData, headers: headersComSessao(), ...COM_SESSAO });
  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json().catch(() => null)
    : null;
  if (!res.ok) {
    const err = new Error(data?.error?.message
      ? translate(data.error.message)
      : translate('Erro {status} ao enviar o formulário.', { status: res.status }));
    err.rawMessage = data?.error?.message ?? null;
    err.code = data?.error?.code;
    err.status = res.status;
    throw err;
  }
  if (data === null) {
    const err = new Error(translate('A API respondeu sem dados válidos — verifique a ligação.'));
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (path, params) => request(path, { method: 'GET', params }),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: (path, file, field) => uploadFile(path, file, field),
  postForm: (path, formData) => postForm(path, formData),
};
