// Porta directa de frontend/src/api/client.js para Angular. Mesma base
// relativa ('/api/...', mesma origem, com proxy em dev — ver proxy.conf.mjs),
// mesmo envelope de erro { error: { code, message, details } }, e o mesmo
// tratamento "sucesso HTTP sem JSON válido nunca é null em silêncio".
//
// A normalização do ERRO em si (interceptor→ApiError) vive em
// core/interceptors/error.interceptor.ts, para poder ser testada à parte e
// para que qualquer chamada feita directamente por HttpClient (não só por
// este serviço) beneficie da mesma normalização.
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

type QueryParams = Record<string, string | number | boolean | undefined | null>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private readonly http: HttpClient) {}

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http.get<T>(path, { params: this.toHttpParams(params) });
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>(path, body ?? {});
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http.patch<T>(path, body ?? {});
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http.put<T>(path, body ?? {});
  }

  del<T>(path: string): Observable<T> {
    return this.http.delete<T>(path);
  }

  // Upload de um único ficheiro (multipart/form-data) — espelha api.upload em client.js.
  upload<T>(path: string, file: File, field = 'image'): Observable<T> {
    const formData = new FormData();
    formData.append(field, file);
    return this.http.post<T>(path, formData);
  }

  // POST de um FormData já montado (ex.: cadastro com documentos) — espelha api.postForm.
  postForm<T>(path: string, formData: FormData): Observable<T> {
    return this.http.post<T>(path, formData);
  }

  private toHttpParams(params?: QueryParams): HttpParams | undefined {
    if (!params) return undefined;
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }
}
