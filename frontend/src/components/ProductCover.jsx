// src/components/ProductCover.jsx
// Capa de um produto: mostra a fotografia real carregada pelo fornecedor
// (imageUrl) ou, na sua ausência, um placeholder claro "Sem fotografia" — nunca
// uma imagem gerada que se faça passar por foto. As fotos são da
// responsabilidade do fornecedor (Catálogo → Carregar foto).
import { categoryVisual, Icon } from './icons';
import { useI18n } from '../i18n';

export default function ProductCover({ imageUrl, category, name = '', caption = true }) {
  const { t } = useI18n();
  if (imageUrl) {
    return <img className="mk-photo" src={imageUrl} alt={name} loading="lazy" />;
  }
  const vis = categoryVisual(category);
  // Com legenda, "Sem fotografia" já está escrito no ecrã e um leitor de ecrã
  // lê-o. Um aria-label por cima diria a mesma coisa duas vezes — e o
  // role="img" que ele exige transforma a caixa numa folha, escondendo o texto
  // visível da árvore de acessibilidade. Sem legenda a caixa é só um gráfico, e
  // aí sim precisa de um nome, senão é anunciada como nada.
  return caption ? (
    <div className="mk-ph">
      <Icon name={vis.icon} size={28} />
      <span>{t('Sem fotografia')}</span>
    </div>
  ) : (
    <div className="mk-ph" role="img" aria-label={t('Sem fotografia')}>
      <Icon name={vis.icon} size={28} />
    </div>
  );
}
