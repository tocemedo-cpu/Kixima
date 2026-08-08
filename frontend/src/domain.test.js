// src/domain.test.js
import { describe, test, expect } from 'vitest';
import {
  formatMoney, computeCartTotals, IVA_RATE, WITHHOLDING_RATE, KIXIMA_FEE_RATE,
  ROLE_HOME, PO_STATUS,
} from './domain';

describe('formatMoney', () => {
  test('mostra o Kwanza como "Kz" com 2 casas decimais', () => {
    const out = formatMoney(1250000, 'AOA');
    expect(out).toMatch(/Kz$/);
    expect(out).toMatch(/,00/); // duas casas decimais
    expect(out.replace(/\s| /g, '')).toMatch(/1.?250.?000,00Kz/);
  });
  test('null/undefined → 0,00 Kz', () => {
    expect(formatMoney(null)).toMatch(/0,00 Kz/);
    expect(formatMoney(undefined)).toMatch(/0,00 Kz/);
  });
  test('outra moeda usa o próprio código', () => {
    expect(formatMoney(100, 'USD')).toMatch(/USD$/);
  });
});

describe('taxas (modelo fiscal Angola)', () => {
  test('IVA 14%, retenção na fonte 6,5%, comissão KIXIMA 1,5%', () => {
    expect(IVA_RATE).toBe(0.14);
    expect(WITHHOLDING_RATE).toBe(0.065);
    expect(KIXIMA_FEE_RATE).toBe(0.015);
  });
  test('computeCartTotals soma IVA e comissão ao subtotal', () => {
    const r = computeCartTotals(1000000);
    expect(r.iva).toBe(140000);
    expect(r.fee).toBe(15000);
    expect(r.total).toBe(1155000);
  });
});

describe('mapas de domínio', () => {
  test('cada papel tem uma home', () => {
    for (const role of ['COMPRADOR', 'COMPANY_ADMIN', 'FORNECEDOR', 'FINANCEIRO', 'ADMIN_SISTEMA']) {
      expect(typeof ROLE_HOME[role]).toBe('string');
      expect(ROLE_HOME[role].startsWith('/')).toBe(true);
    }
  });
  test('estados da PO têm rótulo', () => {
    expect(PO_STATUS.PAGA).toBeTruthy();
  });
});
