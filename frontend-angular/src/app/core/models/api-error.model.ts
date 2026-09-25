// Envelope de erro devolvido por AMBOS os backends (Node middleware/errorHandler.js
// e Java GlobalExceptionHandler): { error: { code, message, details? } }.
export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

// Erro lançado pelo ApiService — espelha o Error decorado em frontend/src/api/client.js
// (rawMessage, code, details, status), para que os componentes migrados leiam
// exactamente os mesmos campos que já liam no React.
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly rawMessage?: string | null;

  constructor(message: string, status: number, code?: string, details?: unknown, rawMessage?: string | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.rawMessage = rawMessage ?? null;
  }
}
