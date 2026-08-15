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
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
  }

  const res = await fetch(url.pathname + url.search, {
    method,
    headers: { 'Content-Type': 'application/json' },
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

  return data;
}

// Upload de ficheiro (multipart/form-data). Não define Content-Type — o browser
// trata do boundary. Injeta o JWT e normaliza erros como o request().
async function uploadFile(path, file, field = 'image') {
  const formData = new FormData();
  formData.append(field, file);
  const res = await fetch(path, { method: 'POST', body: formData, ...COM_SESSAO });
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
  return data;
}

// POST de um FormData já montado (multipart) — ex.: cadastro com documentos.
async function postForm(path, formData) {
  const res = await fetch(path, { method: 'POST', body: formData, ...COM_SESSAO });
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
