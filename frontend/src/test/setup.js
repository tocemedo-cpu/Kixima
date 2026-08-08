// src/test/setup.js
// Setup global dos testes (Vitest + jsdom). Adiciona os matchers do jest-dom
// (toBeInTheDocument, etc.) e limpa o DOM entre testes.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
