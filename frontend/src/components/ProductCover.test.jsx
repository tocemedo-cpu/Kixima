// src/components/ProductCover.test.jsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductCover from './ProductCover';

describe('ProductCover', () => {
  test('com imageUrl mostra a fotografia real', () => {
    render(<ProductCover imageUrl="/catalog/40141607.jpg" name="Válvula" category="Válvulas" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/catalog/40141607.jpg');
    expect(img).toHaveAttribute('alt', 'Válvula');
  });

  test('sem imageUrl mostra o placeholder "Sem fotografia"', () => {
    render(<ProductCover imageUrl={null} name="X" category="Válvulas" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Sem fotografia')).toBeInTheDocument();
  });

  test('caption=false não mostra o texto do placeholder', () => {
    render(<ProductCover imageUrl="" category="Bombas" caption={false} />);
    expect(screen.queryByText('Sem fotografia')).toBeNull();
  });
});
