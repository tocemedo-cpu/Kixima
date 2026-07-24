// src/pages/shared/ModulePlaceholder.jsx
// Ecrã genérico para módulos do menu ainda em preparação. Deriva o título do
// último segmento da rota — assim o novo menu ERP navega sem 404 e mostra o
// contexto do módulo escolhido.
import { useLocation } from 'react-router-dom';
import { PageHeader } from '../../components/Common';
import { Icon } from '../../components/icons';

const TITLES = {
  servicos: 'Serviços', categorias: 'Categorias', marcas: 'Marcas', kits: 'Kits', promocoes: 'Promoções',
  stock: 'Stock', entradas: 'Entradas', saidas: 'Saídas', armazens: 'Armazéns',
  solicitacoes: 'Solicitações', cotacoes: 'Cotações', historico: 'Histórico',
  carteira: 'Carteira', certificacoes: 'Certificações', licencas: 'Licenças',
  catalogos: 'Catálogos PDF', fichas: 'Fichas Técnicas',
  'mais-vistos': 'Produtos mais vistos', 'mais-vendidos': 'Produtos mais vendidos',
  estatisticas: 'Estatísticas', seguranca: 'Segurança',
};

export default function ModulePlaceholder() {
  const { pathname } = useLocation();
  const seg = pathname.split('/').filter(Boolean).pop() || '';
  const title = TITLES[seg] || seg.replace(/-/g, ' ');

  return (
    <div>
      <PageHeader title={title} subtitle="Módulo em preparação — a estrutura de navegação já está pronta." />
      <div className="empty-state">
        <div style={{ color: 'var(--brand-600)', marginBottom: 10 }}><Icon name="box" size={30} /></div>
        <h3 style={{ textTransform: 'capitalize' }}>{title}</h3>
        <p>Este módulo faz parte do plano do portal do fornecedor e será disponibilizado em breve.</p>
      </div>
    </div>
  );
}
