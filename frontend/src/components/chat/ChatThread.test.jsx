// src/components/chat/ChatThread.test.jsx
// A peça partilhada pelo Chat de Suporte e pelo Chat Comercial: lista de
// mensagens (minha vs. da outra parte), envio, e o estado "conversa fechada"
// que troca a caixa de escrever por um aviso.
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '../../i18n';
import ChatThread from './ChatThread';

function montar(props) {
  return render(<I18nProvider><ChatThread mine={() => false} onSend={vi.fn()} {...props} /></I18nProvider>);
}

test('sem mensagens, mostra o estado vazio', () => {
  montar({ messages: [] });
  expect(screen.getByText('Ainda não há mensagens — comece a conversa.')).toBeInTheDocument();
});

test('distingue mensagens minhas das da outra parte', () => {
  const messages = [
    { id: 'm1', body: 'Olá', createdAt: '2026-01-01T10:00:00Z', authorId: 'outro' },
    { id: 'm2', body: 'Bom dia', createdAt: '2026-01-01T10:01:00Z', authorId: 'eu' },
  ];
  const { container } = montar({ messages, mine: (m) => m.authorId === 'eu' });
  const linhas = container.querySelectorAll('.chat-bubble-row');
  expect(linhas).toHaveLength(2);
  expect(linhas[0].className).not.toContain('mine');
  expect(linhas[1].className).toContain('mine');
});

test('anexo aparece como link com o nome do ficheiro', () => {
  montar({ messages: [{ id: 'm1', body: '', attachmentUrl: '/x.png', attachmentName: 'foto.png', createdAt: '2026-01-01T10:00:00Z' }] });
  const link = screen.getByRole('link', { name: /foto\.png/ });
  expect(link).toHaveAttribute('href', '/x.png');
});

test('escrever e enviar chama onSend com o texto e limpa a caixa', async () => {
  const onSend = vi.fn().mockResolvedValue();
  montar({ messages: [], onSend });

  const input = screen.getByPlaceholderText('Escreva uma mensagem…');
  fireEvent.change(input, { target: { value: 'Preciso de ajuda' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

  await waitFor(() => expect(onSend).toHaveBeenCalledWith('Preciso de ajuda', null));
  await waitFor(() => expect(input.value).toBe(''));
});

test('não envia mensagem vazia sem anexo — botão fica desabilitado', () => {
  montar({ messages: [] });
  expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
});

test('desabilitado (conversa fechada) troca a caixa de escrever por um aviso', () => {
  montar({ messages: [], disabled: true, disabledReason: 'Este pedido está fechado.' });
  expect(screen.getByText('Este pedido está fechado.')).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Escreva uma mensagem…')).not.toBeInTheDocument();
});
