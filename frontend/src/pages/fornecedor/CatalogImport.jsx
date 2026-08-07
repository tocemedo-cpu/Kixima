// src/pages/fornecedor/CatalogImport.jsx
// Importação de catálogo em massa (Excel .xlsx) — o Fornecedor carrega muitos
// produtos de uma só vez, no formato KIXIMA (folha "Catálogo" + folha opcional
// "Catálogo Visual" com fotos embebidas). Liga a POST /api/catalog/import.
import { useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, ErrorBanner, SuccessBanner } from '../../components/Common';

export default function CatalogImport() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setResult(null);
    if (!file) { setError('Escolha um ficheiro Excel (.xlsx).'); return; }
    setBusy(true);
    try {
      const res = await api.upload('/api/catalog/import', file, 'file');
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Importar catálogo (Excel)" subtitle="Carregue muitos produtos e serviços de uma só vez, a partir de uma folha de cálculo." />

      <ErrorBanner message={error} />

      <div className="grid-cols grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          <strong style={{ fontSize: 13.5 }}>Ficheiro do catálogo</strong>
          <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
            <div className="field">
              <label>Ficheiro Excel (.xlsx)</label>
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }} />
            </div>
            {file ? <p className="helptext" style={{ marginTop: 2 }}>Selecionado: <strong>{file.name}</strong> ({Math.round(file.size / 1024)} KB)</p> : null}
            <button className="btn btn-accent" disabled={busy} type="submit" style={{ marginTop: 8 }}>
              {busy ? 'A importar…' : 'Importar catálogo'}
            </button>
          </form>

          {result ? (
            <div style={{ marginTop: 18 }}>
              <SuccessBanner message={`Importação concluída: ${result.created} criados, ${result.updated} atualizados, ${result.withImages} com imagem (de ${result.total} linhas).`} />
              {result.errors?.length ? (
                <div className="card card-pad" style={{ marginTop: 10, background: 'var(--surface-2, #fff)' }}>
                  <strong style={{ fontSize: 13 }}>Linhas com problemas ({result.errors.length})</strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-400)' }}>
                    {result.errors.slice(0, 10).map((er, i) => (<li key={i}>Linha {er.row}: {er.error}</li>))}
                    {result.errors.length > 10 ? <li>… e mais {result.errors.length - 10}.</li> : null}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="card card-pad">
          <strong style={{ fontSize: 13.5 }}>Formato esperado</strong>
          <p className="helptext" style={{ marginTop: 8 }}>
            A folha <strong>"Catálogo"</strong> deve ter uma linha de cabeçalho com, no mínimo, as colunas
            <strong> Categoria</strong> e <strong>Produto/Serviço</strong>. As restantes são opcionais e
            reconhecidas automaticamente:
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
            <li><strong>Categoria</strong> — família comercial do item</li>
            <li><strong>Produto/Serviço</strong> — nome do item</li>
            <li><strong>Descrição</strong>, <strong>Tipo</strong> (Produto/Serviço), <strong>UOM</strong></li>
            <li><strong>Código UNSPSC</strong>, <strong>Título Oficial UNSPSC</strong>, <strong>Segmento</strong>, <strong>Família</strong></li>
            <li><strong>País de Origem</strong> — opcional (proveniência do fabrico)</li>
            <li><strong>Preço</strong> — opcional (em AOA; se ausente, é estimado por categoria)</li>
          </ul>
          <p className="helptext" style={{ marginTop: 10 }}>
            As <strong>fotos</strong> podem vir embebidas numa folha <strong>"Catálogo Visual"</strong> (uma imagem
            por linha, na mesma ordem dos itens) — são extraídas e associadas automaticamente. A moeda é sempre
            o <strong>Kwanza (AOA)</strong> e os produtos ficam publicados no marketplace em nome da sua empresa.
          </p>
        </div>
      </div>
    </div>
  );
}
