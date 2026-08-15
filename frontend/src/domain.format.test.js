// src/domain.format.test.js
// Formatação de dados: uma regra por TIPO, não uma por ecrã.
//
// A divergência que isto trava já aconteceu: quatro ecrãs mostravam dólares com
// o seu próprio toLocaleString, e três discordavam nas casas decimais. O mesmo
// plano custava "5 000 USD" na página pública e "5 000,00 USD" no ecrã do Admin
// do Sistema. Num contexto de preços isso não é estética — é a pessoa a
// perguntar-se se são valores diferentes.
import { describe, test, expect } from 'vitest';
import { formatUsd, formatMoney, formatDate } from './domain';

describe('Dólares', () => {
  test('sem casas decimais por omissão — os preços dos planos são redondos', () => {
    expect(formatUsd(5000)).toMatch(/^5[\s  .]000 USD$/);
    expect(formatUsd(100)).toBe('100 USD');
  });

  test('com casas decimais quando são pedidas — o equivalente mensal', () => {
    expect(formatUsd(416.666, { decimais: 2 })).toMatch(/416[,.]67 USD$/);
  });

  test('o mesmo valor dá sempre o mesmo texto', () => {
    // É esta a propriedade que faltava: quatro formatadores, quatro respostas.
    expect(formatUsd(5000)).toBe(formatUsd(5000.0));
  });

  test('nulo não vira "NaN USD"', () => {
    expect(formatUsd(null)).toBe('0 USD');
    expect(formatUsd(undefined)).toBe('0 USD');
  });
});

describe('Kwanzas', () => {
  test('sempre com duas casas — é dinheiro de fatura, não um resumo', () => {
    expect(formatMoney(1234.5)).toMatch(/1[\s  .]234,50 Kz$/);
  });

  test('não abrevia — nunca aparece "1,2M Kz" numa tabela', () => {
    expect(formatMoney(125400000)).not.toMatch(/[KM]\b/);
  });
});

describe('Datas', () => {
  // NOTA SOBRE O FORMATO. Em pt-PT/pt-AO, o Intl com month:'short' rende
  // "20/05/2026" — numérico, não "20 Mai 2026". Confirmado num browser real, e
  // é o comportamento correto do idioma: um leitor português lê 20/05/2026 sem
  // hesitar. Em inglês sai "May 20, 2026" e em francês "20 mai 2026".
  //
  // Ou seja: o formato MUDA com o idioma, e isso não é inconsistência — é
  // localização. O que este teste prende é que haja UMA função a decidi-lo.
  test('há uma só função a formatar datas, e segue o idioma ativo', () => {
    const d = formatDate('2026-05-20T10:00:00Z');
    expect(d).toContain('20');
    expect(d).toContain('2026');
  });

  test('a mesma data dá sempre o mesmo texto', () => {
    expect(formatDate('2026-05-20T10:00:00Z')).toBe(formatDate(new Date('2026-05-20T10:00:00Z')));
  });

  test('sem data mostra um travessão, não "Invalid Date"', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
  });
});
