// src/pages/companyAdmin/Assinatura.jsx
// Subscrição da empresa: ver o plano, mudar de plano, pagar por transferência.
//
// NÃO HÁ CARTÃO NEM GATEWAY, e a página não finge que há. Em Angola, no B2B,
// paga-se por transferência com comprovativo — é assim que já se pagam as
// faturas nesta plataforma. Por isso o passo do meio existe e está visível: a
// KIXIMA tem de confirmar a entrada do dinheiro antes de o plano mudar.
//
// A ordem dos blocos segue o estado real de quem abre a página: primeiro o que
// tem por pagar (se tiver), depois o plano atual, e só no fim os planos para
// onde pode ir. Quem tem uma cobrança em aberto abre isto para tratar dela, não
// para ler a tabela de preços outra vez.
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, Pill, EmptyRow } from '../../components/BuyerUI';
import { ErrorBanner, SuccessBanner } from '../../components/Common';
import { formatDate, formatUsd } from '../../domain';
import { useI18n } from '../../i18n';
import { useAuth } from '../../auth/AuthContext';

// Os valores passam por t(VARIÁVEL), que a auditoria estática não consegue ver
// — ela procura t('literal'). Por isso estão declarados aqui e as chaves foram
// acrescentadas à mão ao dicionário: sem isso apareciam em português com a
// interface em inglês, e o relatório continuava a dizer "0 em falta".
const PERIODOS = {
  MENSAL: 'por mês', TRIMESTRAL: 'por trimestre', SEMESTRAL: 'por semestre', ANUAL: 'por ano',
};

const ESTADO_PILL = {
  PENDENTE: 'pending',
  COMPROVATIVO_ENVIADO: 'info',
  CONFIRMADA: 'success',
  CANCELADA: 'neutral',
};

const ESTADO_TEXTO = {
  PENDENTE: 'Por pagar',
  COMPROVATIVO_ENVIADO: 'Aguarda confirmação da KIXIMA',
  CONFIRMADA: 'Confirmada',
  CANCELADA: 'Cancelada',
};


export default function Assinatura() {
  const { t } = useI18n();
  // O Financeiro vê a página e carrega o comprovativo, mas não escolhe o plano
  // — é a mesma divisão do pagamento de faturas, e é a que o servidor aplica.
  // Sem isto teria botões que lhe devolviam 403 sem explicação nenhuma.
  const { user } = useAuth();
  const podeEscolherPlano = user?.role === 'COMPANY_ADMIN';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [busy, setBusy] = useState(false);
  const ficheiro = useRef(null);

  function carregar() {
    setError('');
    api.get('/api/assinatura').then(setData).catch((e) => setError(e.message));
  }
  useEffect(() => { carregar(); }, []);

  async function pedir(plano, aceitaPerdas = false) {
    setBusy(true); setError(''); setAviso('');
    try {
      const c = await api.post('/api/assinatura/pedir', { plano, aceitaPerdas });
      setAviso(t('Cobrança {ref} emitida. Faça a transferência e carregue o comprovativo aqui.', { ref: c.referencia }));
      carregar();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // A descida só avança depois de a pessoa ver, por escrito e com números, o
  // que vai perder. O servidor recusa na mesma sem `aceitaPerdas` — isto aqui é
  // para ela saber, não para a plataforma se proteger.
  function pedirComAviso(opcao) {
    if (!opcao.perdas?.length) return pedir(opcao.plano);
    const lista = opcao.perdas.map((p) => `• ${p.quantidade} ${t(p.label)} — ${t(p.consequencia)}`).join('\n');
    const ok = window.confirm(
      `${t('Descer para o plano {plano} faz perder:', { plano: opcao.plano })}\n\n${lista}\n\n${t('Quer continuar?')}`
    );
    return ok ? pedir(opcao.plano, true) : undefined;
  }

  async function enviarComprovativo(cobrancaId, file) {
    setBusy(true); setError(''); setAviso('');
    try {
      const fd = new FormData();
      fd.append('comprovativo', file);
      await api.postForm(`/api/assinatura/${cobrancaId}/comprovativo`, fd);
      setAviso(t('Comprovativo recebido. A KIXIMA confirma a entrada do valor e o plano fica ativo.'));
      carregar();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (ficheiro.current) ficheiro.current.value = '';
    }
  }

  async function cancelar(cobrancaId) {
    const motivo = window.prompt(t('Porque está a cancelar esta cobrança?'));
    if (!motivo) return;
    setBusy(true); setError('');
    try {
      await api.post(`/api/assinatura/${cobrancaId}/cancelar`, { motivo });
      carregar();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div>
        <Crumbs trail={['Configurações', 'Subscrição']} />
        {error ? <ErrorBanner message={error} /> : <p className="loading-text">{t('A carregar…')}</p>}
      </div>
    );
  }

  const aberta = data.emAberto;

  return (
    <div>
      <Crumbs trail={['Configurações', 'Subscrição']} />
      <PageHead
        title="Subscrição"
        subtitle="O plano da sua empresa, o que cada plano inclui e como se paga. O pagamento é por transferência bancária com comprovativo — o plano muda quando a KIXIMA confirma a entrada do valor."
      />

      {error ? <ErrorBanner message={error} /> : null}
      {aviso ? <SuccessBanner message={aviso} /> : null}

      {/* --- Cobrança em aberto — primeiro, porque é o que há para fazer --- */}
      {aberta ? (
        <div className="bz-card card-pad" style={{ marginBottom: 18, borderLeft: '4px solid var(--brand-600)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ margin: 0 }}>
                {t('Cobrança {ref}', { ref: aberta.referencia })}{' '}
                <Pill tone={ESTADO_PILL[aberta.status]}>{ESTADO_TEXTO[aberta.status]}</Pill>
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: 14 }}>
                {t('Plano {plano} — {valor} {periodo}', {
                  plano: aberta.planoNovo,
                  valor: formatUsd(aberta.valorUsd),
                  periodo: t(PERIODOS[aberta.periodo] || aberta.periodo),
                })}
              </p>
              {/* O valor está congelado. Dizê-lo evita a pergunta seguinte. */}
              <p className="helptext" style={{ marginTop: 6 }}>
                {t('Este valor está fixado nesta cobrança e não muda, mesmo que a tabela de preços mude.')}
              </p>
            </div>
            {podeEscolherPlano ? (
              <button className="btn btn-ghost" onClick={() => cancelar(aberta.id)} disabled={busy}>
                {t('Cancelar cobrança')}
              </button>
            ) : null}
          </div>

          {aberta.status === 'PENDENTE' ? (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <p style={{ margin: '0 0 10px', fontSize: 14 }}>
                <strong>{t('Como pagar:')}</strong>{' '}
                {t('transfira o valor indicando a referência {ref} e carregue aqui o comprovativo (PDF ou imagem).', { ref: aberta.referencia })}
              </p>

              {/* Os dados para onde transferir. Sem eles a instrução acima não
                  serve de nada — e o problema aparece por escrito em vez de a
                  pessoa ficar a olhar para um espaço vazio. */}
              {data.banco?.configurado ? (
                <div className="bz-card card-pad" style={{ background: 'var(--bg-soft, #f8fafc)', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14 }}>
                    {data.banco.titular ? <Dado label="Titular" valor={data.banco.titular} /> : null}
                    {data.banco.banco ? <Dado label="Banco" valor={data.banco.banco} /> : null}
                    <Dado label="IBAN" valor={data.banco.iban} />
                    {data.banco.swift ? <Dado label="SWIFT" valor={data.banco.swift} /> : null}
                    <Dado label="Moeda" valor={data.banco.moeda} />
                  </div>
                  <p className="helptext" style={{ margin: '10px 0 0' }}>
                    {t('Indique a referência {ref} na descrição da transferência — é assim que a KIXIMA a associa à sua empresa.', { ref: aberta.referencia })}
                  </p>
                </div>
              ) : (
                <p className="error-text" style={{ marginTop: 0 }}>
                  {t('Os dados bancários da KIXIMA ainda não estão publicados na plataforma. Contacte o suporte para os obter antes de transferir.')}
                </p>
              )}
              <input
                ref={ficheiro}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                disabled={busy}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarComprovativo(aberta.id, f); }}
              />
            </div>
          ) : (
            <p style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', fontSize: 14 }}>
              {t('Comprovativo enviado em {data}. O plano fica ativo assim que a KIXIMA confirmar a entrada do valor.', {
                data: formatDate(aberta.submetidoEm),
              })}
            </p>
          )}
        </div>
      ) : null}

      {/* --- Plano atual --- */}
      <div className="bz-card card-pad" style={{ marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>{t('Plano atual')}</h3>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <Dado label="Plano" valor={data.planoAtual} destaque />
          <Dado
            label="Válido até"
            valor={data.validoAte ? formatDate(data.validoAte) : t('Sem cobrança registada')}
          />
          {/* Duas frases inteiras em vez de uma com um buraco: encaixar
              "sem limite" onde vai um número dava "3 de sem limite". */}
          <Dado
            label="Lugares"
            valor={data.lugaresIncluidos === null
              ? t('{usados} ocupados, sem limite', { usados: data.lugaresOcupados })
              : t('{usados} de {total}', { usados: data.lugaresOcupados, total: data.lugaresIncluidos })}
          />
        </div>

        {data.expirada ? (
          <p className="error-text" style={{ marginTop: 12, marginBottom: 0 }}>
            {t('A subscrição venceu em {data}. O acesso mantém-se — a KIXIMA vai contactá-lo para regularizar.', { data: formatDate(data.validoAte) })}
          </p>
        ) : data.diasAteExpirar !== null && data.diasAteExpirar <= 30 ? (
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14, color: 'var(--warn-700, #92400e)' }}>
            {t('Faltam {n} dias para a subscrição terminar. Renove para não interromper o serviço.', { n: data.diasAteExpirar })}
          </p>
        ) : null}
      </div>

      {/* --- Escada de planos --- */}
      <h3 style={{ margin: '0 0 12px' }}>{t('Mudar de plano')}</h3>
      <div className="plan-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {data.opcoes.map((o) => (
          <Opcao
            key={o.plano}
            opcao={o}
            busy={busy || Boolean(aberta) || !podeEscolherPlano}
            temCobrancaAberta={Boolean(aberta)}
            podeEscolherPlano={podeEscolherPlano}
            onPedir={() => pedirComAviso(o)}
          />
        ))}
      </div>

      {/* --- Histórico --- */}
      <h3 style={{ margin: '22px 0 12px' }}>{t('Histórico de cobranças')}</h3>
      <div className="bz-card">
        <div className="bz-scroll-x">
        <table className="bz-table">
          <thead>
            <tr>
              <th>{t('Referência')}</th>
              <th>{t('Plano')}</th>
              <th>{t('Valor')}</th>
              <th>{t('Estado')}</th>
              <th>{t('Confirmada em')}</th>
              <th>{t('Válido até')}</th>
            </tr>
          </thead>
          <tbody>
            {data.historico.length === 0 ? (
              <tr><td colSpan={6}><EmptyRow>{t('Ainda não há cobranças.')}</EmptyRow></td></tr>
            ) : data.historico.map((c) => (
              <tr key={c.id}>
                <td>{c.referencia}</td>
                <td>{c.planoNovo}</td>
                <td>{formatUsd(c.valorUsd)}</td>
                <td><Pill tone={ESTADO_PILL[c.status]}>{ESTADO_TEXTO[c.status]}</Pill></td>
                <td>{c.confirmadaEm ? formatDate(c.confirmadaEm) : '—'}</td>
                <td>{c.validoAte ? formatDate(c.validoAte) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function Dado({ label, valor, destaque }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="helptext" style={{ marginBottom: 2 }}>{t(label)}</div>
      <div style={{ fontSize: destaque ? 22 : 16, fontWeight: destaque ? 700 : 600 }}>{valor}</div>
    </div>
  );
}

// O servidor manda o impedimento em código e números; a frase monta-se aqui,
// a partir de uma chave que o dicionário conhece.
function textoDoImpedimento(imp, t) {
  if (!imp) return null;
  if (imp.codigo === 'DIMENSAO_EXIGE_PLANO') {
    return t('Empresas de dimensão {dimensao} têm de subscrever o plano {minimo}.', imp);
  }
  return t(
    'O plano {plano} inclui {lugares} lugares e a empresa tem {ocupados} (utilizadores ativos mais convites por aceitar). Desative os utilizadores em excesso antes de descer de plano.',
    imp,
  );
}

function Opcao({ opcao, busy, temCobrancaAberta, podeEscolherPlano, onPedir }) {
  const { t } = useI18n();
  const { preco } = opcao;
  const rotulo = { SUBIR: 'Subir para este plano', DESCER: 'Descer para este plano', RENOVAR: 'Renovar este plano' };

  return (
    // Coluna flexível com o botão empurrado para o fundo: as listas de
    // funcionalidades têm alturas diferentes, e sem isto o botão de cada plano
    // ficava a uma altura diferente — a comparação faz-se pior quando os
    // pontos de decisão não estão alinhados.
    <div
      className="bz-card card-pad"
      style={{
        borderColor: opcao.atual ? 'var(--brand-600)' : undefined,
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>{opcao.plano}</h4>
        {opcao.atual ? <Pill tone="success">Atual</Pill> : null}
      </div>

      <div style={{ margin: '10px 0 4px', fontSize: 26, fontWeight: 700 }}>{formatUsd(preco.valorUsd)}</div>
      <div className="helptext">{t(PERIODOS[preco.periodo] || preco.periodo)}</div>
      {/* O equivalente mensal vem do servidor. Base e Core custam ambos "100
          USD" — sem esta linha os dois preços leem-se como iguais. */}
      {preco.meses > 1 ? (
        <div className="helptext" style={{ marginTop: 2 }}>
          {t('equivale a {v} USD por mês', { v: formatUsd(preco.porMesUsd, { decimais: 2 }).replace(' USD', '') })}
        </div>
      ) : null}

      <ul style={{ margin: '12px 0 auto', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
        <li>{opcao.features.lugaresIncluidos === null ? t('Utilizadores sem limite') : t('{n} utilizadores', { n: opcao.features.lugaresIncluidos })}</li>
        <li>{opcao.features.cotacoesPorMes === null ? t('Cotações sem limite') : t('{n} cotações por mês', { n: opcao.features.cotacoesPorMes })}</li>
        {/* O plano Base inclui UM documento — "1 documentos" é um erro que se
            lê logo. O t() não conjuga plurais, por isso são duas chaves. */}
        <li>{opcao.features.documentosPorItem === 1
          ? t('{n} imagens e 1 documento por item', { n: opcao.features.imagensPorItem })
          : t('{n} imagens e {d} documentos por item', { n: opcao.features.imagensPorItem, d: opcao.features.documentosPorItem })}</li>
        <li>{opcao.features.historicoRelatoriosMeses === null ? t('Histórico de relatórios sem limite') : t('Histórico de relatórios de {n} meses', { n: opcao.features.historicoRelatoriosMeses })}</li>
        {opcao.features.kits ? <li>{t('Kits e pacotes de produtos')}</li> : null}
        {opcao.features.carregamentoEmMassa ? <li>{t('Carregamento de catálogo em massa')}</li> : null}
        {opcao.features.erpIntegration ? <li>{t('Integração com ERPs')}</li> : null}
        {opcao.features.frameworkContracts ? <li>{t('Contratos-quadro')}</li> : null}
        {opcao.features.relatorioConteudoLocal ? <li>{t('Relatório de conteúdo local')}</li> : null}
        {opcao.features.apiCatalogo ? <li>{t('API de catálogo')}</li> : null}
      </ul>

      {/* Um botão desativado sem explicação manda a pessoa adivinhar. O motivo
          vem do servidor, com números reais. */}
      {opcao.impedimento ? (
        <p className="helptext" style={{ color: 'var(--danger-600, #b91c1c)' }}>{textoDoImpedimento(opcao.impedimento, t)}</p>
      ) : null}
      {!opcao.impedimento && opcao.perdas?.length ? (
        <p className="helptext">
          {t('Ao descer perde: {lista}.', { lista: opcao.perdas.map((p) => `${p.quantidade} ${t(p.label)}`).join('; ') })}
        </p>
      ) : null}
      {temCobrancaAberta && !opcao.impedimento ? (
        <p className="helptext">{t('Conclua ou cancele a cobrança em aberto para pedir outro plano.')}</p>
      ) : null}
      {!podeEscolherPlano && !opcao.impedimento && !temCobrancaAberta ? (
        <p className="helptext">{t('Só o administrador da empresa escolhe o plano. Pode carregar o comprovativo de uma cobrança já emitida.')}</p>
      ) : null}

      <button
        className={opcao.direcao === 'SUBIR' ? 'btn btn-accent' : 'btn btn-ghost'}
        style={{ width: '100%', marginTop: 12 }}
        disabled={busy || Boolean(opcao.impedimento)}
        onClick={onPedir}
      >
        {t(rotulo[opcao.direcao])}
      </button>
    </div>
  );
}
