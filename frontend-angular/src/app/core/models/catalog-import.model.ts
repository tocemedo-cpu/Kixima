// POST /api/catalog/import (CatalogController.java) — resposta 201, sempre
// um Map solto (não um DTO tipado no Java), mas com estas chaves exactas
// (CatalogImportService.java:441-451). `errors`/`warnings` nunca ficam
// ausentes (arrays vazios, não omitidos).
export interface CatalogImportError {
  row: number;
  error: string;
}

export interface CatalogImportResult {
  total: number;
  created: number;
  updated: number;
  withImages: number;
  precosEstimados?: number;
  stockPorOmissao?: number;
  localizacaoPorOmissao?: number;
  warnings: string[];
  errors: CatalogImportError[];
}
