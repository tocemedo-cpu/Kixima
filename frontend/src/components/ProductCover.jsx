// src/components/ProductCover.jsx
// Capa de um produto: mostra a fotografia real carregada pelo fornecedor
// (imageUrl) ou, na sua ausência, um placeholder claro "Sem fotografia" — nunca
// uma imagem gerada que se faça passar por foto. As fotos são da
// responsabilidade do fornecedor (Catálogo → Carregar foto).
import { categoryVisual, Icon } from './icons';

export default function ProductCover({ imageUrl, category, name = '', caption = true }) {
  if (imageUrl) {
    return <img className="mk-photo" src={imageUrl} alt={name} loading="lazy" />;
  }
  const vis = categoryVisual(category);
  return (
    <div className="mk-ph" aria-label="Sem fotografia">
      <Icon name={vis.icon} size={28} />
      {caption ? <span>Sem fotografia</span> : null}
    </div>
  );
}
