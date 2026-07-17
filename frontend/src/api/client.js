// src/api/client.js
// Cliente HTTP fino sobre fetch. Injeta o token JWT guardado e normaliza erros
// no formato { error: { code, message } } devolvido pelo backend.

const TOKEN_KEY = 'kixima_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
  }

  const token = getToken();
  const res = await fetch(url.pathname + url.search, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = data?.error?.message || `Erro ${res.status} ao contactar a API.`;
    const err = new Error(message);
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
  const token = getToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json().catch(() => null)
    : null;
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Erro ${res.status} ao enviar o ficheiro.`);
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
};
