// src/pages/comprador/CategoryManagement.jsx
// Category Management + Economia de Escala (PRO). Mostra onde a empresa está
// (volume comprado por categoria), o que falta para o próximo desconto por
// volume, o potencial de poupança, oportunidades de consolidar compras
// fragmentadas, e uma recomendação em texto (quando a IA está configurada —
// ver aiRecommendationService.js no backend, que nunca inventa texto).
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatUsd } from '../../domain';
import { Crumbs, PageHead, KpiRow, EmptyRow } from '../../components/BuyerUI';
import { Loading, ErrorBanner } from '../../components/Common';
import { useI18n } from '../../i18n';

export default function CategoryManagement() {
  const { t } = useI18n();
  const [dados, setDados] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null); setDados(null);
    api.get('/api/category-management/analise').then(setDados).catch(setError);
  }, []);

  if (error) {
    return (
      <div>
        <Crumbs trail={[{ label: 'Home Marketplace', to: '/comprador' }, 'Economia de Escala']} />
        <ErrorBanner error={error} />
      </div>
    );
  }
  if (!dados) return <Loading />;

  const {
    volumeAtualUsd, categorias, descontoAtual, proximoThreshold, faltamUsd,
    poupancaPotencialUsd, oportunidadesConsolidacao: oportunidades, recomendacao,
  } = dados;

  return (
    <div>
      <Crumbs trail={[{ label: 'Home Marketplace', to: '/comprador' }, 'Economia de Escala']} />
      <PageHead
        title="Economia de Escala por Categoria"
        subtitle="Quanto mais compra numa categoria, maior o desconto — veja onde está e o que falta para o próximo patamar."
      />

      <KpiRow cards={[
        { icon: 'wallet', tone: 'info', label: 'Volume comprado (12 meses)', value: formatUsd(volumeAtualUsd), sub: 'Ordens pagas em diante' },
        { icon: 'tag', tone: 'success', label: 'Desconto atual', value: `${descontoAtual}%`, sub: 'Patamar já atingido' },
        proximoThreshold
          ? { icon: 'chart', tone: 'pending', label: 'Falta para o próximo patamar', value: formatUsd(faltamUsd), sub: `${proximoThreshold.discountPercent}%` }
          : { icon: 'chart', tone: 'success', label: 'Patamar', value: t('No maior patamar'), sub: 'Já não há próximo desconto' },
        { icon: 'invoice', tone: 'success', label: 'Poupança potencial adicional', value: formatUsd(poupancaPotencialUsd || 0), sub: 'Ao atingir o próximo patamar' },
      ]} />

      <div className="bz-card" style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>{t('Recomendação')}</h3>
        {recomendacao?.texto
          ? <p style={{ whiteSpace: 'pre-wrap' }}>{recomendacao.texto}</p>
          : <p className="bz-muted">{t('A recomendação automática ainda não está disponível para a sua empresa.')}</p>}
      </div>

      <h3>{t('Volume por categoria')}</h3>
      <div className="bz-card bz-tablewrap" style={{ marginBottom: 16 }}>
        <table className="bz-table">
          <thead>
            <tr>
              <th>{t('Categoria')}</th>
              <th>{t('Valor comprado')}</th>
              <th>{t('% do total')}</th>
            </tr>
          </thead>
          <tbody>
            {categorias.length === 0
              ? <tr><td colSpan={3}><EmptyRow>Sem compras no período</EmptyRow></td></tr>
              : categorias.map((c) => (
                <tr key={c.categoria}>
                  <td><strong>{c.categoria}</strong></td>
                  <td>{formatUsd(c.valor)}</td>
                  <td>{c.percentual}%</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <h3>{t('Oportunidades de consolidação')}</h3>
      <div className="bz-card bz-tablewrap">
        <table className="bz-table">
          <thead>
            <tr>
              <th>{t('Categoria')}</th>
              <th>{t('Ordens separadas')}</th>
              <th>{t('Falta para o desconto')}</th>
              <th>{t('Desconto ao consolidar')}</th>
            </tr>
          </thead>
          <tbody>
            {oportunidades.length === 0
              ? <tr><td colSpan={4}><EmptyRow>Nenhuma oportunidade identificada no período</EmptyRow></td></tr>
              : oportunidades.map((o) => (
                <tr key={o.categoria}>
                  <td><strong>{o.categoria}</strong></td>
                  <td>{o.numeroPos}</td>
                  <td>{formatUsd(o.faltamUsd)}</td>
                  <td>{o.descontoPotencial}%</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
