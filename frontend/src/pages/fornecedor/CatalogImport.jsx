// src/pages/fornecedor/CatalogImport.jsx
// Importação de catálogo em massa (Excel .xlsx) — o Fornecedor carrega muitos
// produtos de uma só vez, no formato KIXIMA (folha "Catálogo" + folha opcional
// "Catálogo Visual" com fotos embebidas). Liga a POST /api/catalog/import.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, ErrorBanner, SuccessBanner , Field } from '../../components/Common';
import { useI18n } from '../../i18n';

export default function CatalogImport() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [planos, setPlanos] = useState(null);

  useEffect(() => { api.get('/api/planos').then((r) => setPlanos(r.planos)).catch(() => {}); }, []);
  const meuPlano = planos?.find((p) => p.plano === (user.companyPlan || 'BASE')) || null;
  // A importação em massa é uma funcionalidade Pro (ver planService.FEATURES)
  // — hoje só se descobria com o erro 403 do backend, depois de já se ter
  // escolhido o ficheiro. Avisa antes.
  const semAcesso = meuPlano && !meuPlano.features.carregamentoEmMassa;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setResult(null);
    if (!file) { setError(t('Escolha um ficheiro Excel (.xlsx).')); return; }
    setBusy(true);
    try {
      const res = await api.upload('/api/catalog/import', file, 'file');
      setResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Importar catálogo (Excel)" subtitle="Carregue muitos produtos e serviços de uma só vez, a partir de uma folha de cálculo." />

      <ErrorBanner message={error} />
      {semAcesso ? (
        <ErrorBanner message={t('A importação em massa faz parte do plano PRO — o seu plano atual ({plano}) não a inclui. Publique os itens um a um em Catálogo, ou mude de plano.', { plano: meuPlano.plano })} />
      ) : null}

      <div className="grid-cols grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          <strong style={{ fontSize: 13.5 }}>{t('Ficheiro do catálogo')}</strong>
          <p className="helptext" style={{ marginTop: 8 }}>
            {t('Não sabe por onde começar?')}{' '}
            <a href="/templates/catalogo-modelo.xlsx" download>{t('Descarregue o ficheiro-modelo')}</a>{' '}
            {t('com as colunas certas e dois exemplos preenchidos.')}
          </p>
          <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
            <Field label={t('Ficheiro Excel (.xlsx)')}>
              {(id) => (<>
                <input id={id} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={semAcesso}
                  onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }} />
              </>)}
            </Field>
            {file ? <p className="helptext" style={{ marginTop: 2 }}>{t('Selecionado:')} <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)</p> : null}
            <button className="btn btn-accent" disabled={busy || semAcesso} type="submit" style={{ marginTop: 8 }}>
              {busy ? t('A importar…') : t('Importar catálogo')}
            </button>
          </form>

          {result ? (
            <div style={{ marginTop: 18 }}>
              <SuccessBanner message={t('Importação concluída: {created} criados, {updated} atualizados, {withImages} com imagem (de {total} linhas).', { created: result.created, updated: result.updated, withImages: result.withImages, total: result.total })} />
              {(result.precosEstimados || result.stockPorOmissao || result.localizacaoPorOmissao) ? (
                <div className="card card-pad" style={{ marginTop: 10, background: 'var(--surface-2, #fff)' }}>
                  <strong style={{ fontSize: 13 }}>{t('Valores preenchidos automaticamente')}</strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-400)' }}>
                    {result.precosEstimados ? <li>{t('{n} preço(s) estimado(s) por categoria — sem coluna Preço no ficheiro. Reveja-os no catálogo.', { n: result.precosEstimados })}</li> : null}
                    {result.stockPorOmissao ? <li>{t('{n} item(ns) com stock por omissão (50 unidades) — sem coluna Stock no ficheiro.', { n: result.stockPorOmissao })}</li> : null}
                    {result.localizacaoPorOmissao ? <li>{t('{n} item(ns) com localização por omissão (Luanda) — sem coluna Cidade no ficheiro.', { n: result.localizacaoPorOmissao })}</li> : null}
                  </ul>
                </div>
              ) : null}
              {result.warnings?.length ? (
                <div className="card card-pad" style={{ marginTop: 10, background: 'var(--surface-2, #fff)' }}>
                  <strong style={{ fontSize: 13 }}>{t('Avisos')}</strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-400)' }}>
                    {result.warnings.map((w, i) => (<li key={i}>{w}</li>))}
                  </ul>
                </div>
              ) : null}
              {result.errors?.length ? (
                <div className="card card-pad" style={{ marginTop: 10, background: 'var(--surface-2, #fff)' }}>
                  <strong style={{ fontSize: 13 }}>{t('Linhas com problemas')} ({result.errors.length})</strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-400)' }}>
                    {result.errors.slice(0, 10).map((er, i) => (<li key={i}>{t('Linha {n}', { n: er.row })}: {er.error}</li>))}
                    {result.errors.length > 10 ? <li>{t('… e mais {n}.', { n: result.errors.length - 10 })}</li> : null}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="card card-pad">
          <strong style={{ fontSize: 13.5 }}>{t('Formato esperado')}</strong>
          <p className="helptext" style={{ marginTop: 8 }}>
            {t('A folha "Catálogo" deve ter uma linha de cabeçalho com, no mínimo, as colunas Categoria e Produto/Serviço. As restantes são opcionais e reconhecidas automaticamente:')}
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
            <li><strong>{t('Categoria')}</strong> — {t('família comercial do item')}</li>
            <li><strong>{t('Produto/Serviço')}</strong> — {t('nome do item')}</li>
            <li><strong>{t('Descrição')}</strong>, <strong>{t('Tipo')}</strong> ({t('Produto/Serviço')}), <strong>UOM</strong></li>
            <li><strong>{t('Código UNSPSC')}</strong>, <strong>{t('Título Oficial UNSPSC')}</strong>, <strong>{t('Segmento')}</strong>, <strong>{t('Família')}</strong></li>
            <li><strong>{t('País de Origem')}</strong> — {t('opcional (proveniência do fabrico)')}</li>
            <li><strong>{t('Preço')}</strong> — {t('opcional (em AOA; se ausente, é estimado por categoria)')}</li>
            <li><strong>{t('Stock')}</strong> — {t('opcional (se ausente, entra com 50 unidades por omissão)')}</li>
            <li><strong>{t('Cidade')}</strong> — {t('opcional (se ausente, entra como Luanda por omissão)')}</li>
          </ul>
          <p className="helptext" style={{ marginTop: 10 }}>
            {t('As fotos podem vir embebidas numa folha "Catálogo Visual" (uma imagem por linha, na mesma ordem dos itens) — são extraídas e associadas automaticamente. A moeda é sempre o Kwanza (AOA) e os produtos ficam publicados no marketplace em nome da sua empresa.')}
          </p>
        </div>
      </div>
    </div>
  );
}
