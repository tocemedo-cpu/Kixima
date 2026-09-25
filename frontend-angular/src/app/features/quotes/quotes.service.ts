// Porta directa das chamadas a /api/quotes usadas por Quotes.jsx e
// SupplierQuotes.jsx. Mesmos 4 endpoints, mesma forma de corpo/resposta —
// ver core/models/quote.model.ts e backend/src/services/quoteService.js.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { CreateQuoteRequestBody, QuoteRequestDto, RespondQuoteBody } from '../../core/models/quote.model';

@Injectable({ providedIn: 'root' })
export class QuotesService {
  constructor(private readonly api: ApiService) {}

  list(status?: string): Observable<QuoteRequestDto[]> {
    return this.api.get<QuoteRequestDto[]>('/api/quotes', status ? { status } : undefined);
  }

  create(body: CreateQuoteRequestBody): Observable<QuoteRequestDto> {
    return this.api.post<QuoteRequestDto>('/api/quotes', body);
  }

  respond(id: string, body: RespondQuoteBody): Observable<QuoteRequestDto> {
    return this.api.patch<QuoteRequestDto>(`/api/quotes/${id}/respond`, body);
  }

  close(id: string): Observable<QuoteRequestDto> {
    return this.api.patch<QuoteRequestDto>(`/api/quotes/${id}/close`, undefined);
  }
}
