// src/pages/adminSistema/SecurityAlerts.jsx
// Alertas de Segurança — o painel de Trust & Safety do Chat Comercial. Só
// mostra conversas que o motor de risco já sinalizou (ver
// riskAnalysisService/conversationService no backend); abrir uma conversa
// daqui é a ÚNICA forma de o Suporte lá entrar, e fica sempre auditado
// (riskAlertService.acederConversaSinalizada).
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Icon } from '../../components/icons';
import { Crumbs, PageHead, Pill, Tabs, EmptyRow } from '../../components/BuyerUI';
import { useI18n } from '../../i18n';
import { formatDateTime } from '../../domain';

const LEVEL_TONE = { LOW: 'neutral', MEDIUM: 'pending', HIGH: 'danger', CRITICAL: 'danger' };
const LEVEL_LABEL = { LOW: 'Baixo', MEDIUM: 'Médio', HIGH: 'Alto', CRITICAL: 'Crítico' };
const STATUS_TABS = [
  { key: 'ABERTO', label: 'Em aberto' },
  { key: 'EM_ANALISE', label: 'Em análise' },
  { key: 'FALSO_POSITIVO', label: 'Falso positivo' },
  { key: 'RESOLVIDO', label: 'Resolvido' },
];

export default function SecurityAlerts() {
  const { t } = useI18n();
  const [tab, setTab] = useState('ABERTO');
  const [alertas, setAlertas] = useState([]);
  const [selected, setSelected] = useState(null);
  const [semAcesso, setSemAcesso] = useState(false);

  const load = useCallback(() => {
    api.get('/api/conversations/admin/alerts', { status: tab }).then(setAlertas).catch((err) => { if (err.status === 403) setSemAcesso(true); });
  }, [tab]);
  useEffect(load, [load]);

  if (semAcesso) {
    return (
      <div>
        <Crumbs trail={['Administração', 'Alertas de Segurança']} />
        <PageHead title="Alertas de Segurança" />
        <div className="bz-panel"><p className="bz-sub">{t('Sem acesso a Suporte — fale com quem lhe deu acesso ao sistema.')}</p></div>
      </div>
    );
  }

  return (
    <div>
      <Crumbs trail={['Administração', 'Alertas de Segurança']} />
      <PageHead title="Alertas de Segurança" subtitle="Conversas do Chat Comercial com indícios de negociação ou pagamento fora da plataforma." />
      <Tabs tabs={STATUS_TABS} value={tab} onChange={setTab} />
      <div className="chat-layout">
        <aside className="chat-list-panel bz-panel">
          {alertas.length === 0 ? <EmptyRow>{t('Nenhum alerta neste estado.')}</EmptyRow> : (
            <ul className="chat-list">
              {alertas.map((a) => (
                <li key={a.id}>
                  <button className={`chat-list-item${selected === a.id ? ' on' : ''}`} onClick={() => setSelected(a.id)}>
                    <strong>{a.conversation ? `${a.conversation.buyerCompany} ↔ ${a.conversation.supplierCompany}` : t('Conversa')}</strong>
                    <span className="bz-sub2">{formatDateTime(a.createdAt)}</span>
                    <Pill tone={LEVEL_TONE[a.level]}>{t(LEVEL_LABEL[a.level])}</Pill>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="chat-thread-panel bz-panel">
          {selected ? (
            <AlertDetail alertId={selected} alertas={alertas} onChanged={load} onClose={() => setSelected(null)} />
          ) : (
            <div className="chat-placeholder"><Icon name="alert" size={32} /><p>{t('Escolha um alerta para analisar a conversa sinalizada.')}</p></div>
          )}
        </section>
      </div>
    </div>
  );
}

function AlertDetail({ alertId, alertas, onChanged, onClose }) {
  const { t } = useI18n();
  const alerta = alertas.find((a) => a.id === alertId);
  const [dados, setDados] = useState(null);
  const [busy, setBusy] = useState(true);
  const [decisao, setDecisao] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!alerta) return;
    setBusy(true);
    api.get(`/api/conversations/admin/conversations/${alerta.conversationId}`).then(setDados).catch(() => {}).finally(() => setBusy(false));
  }, [alerta]);

  async function reclassificar(status) {
    setActing(true);
    try {
      await api.patch(`/api/conversations/admin/alerts/${alertId}`, { status, decision: decisao });
      onChanged();
      onClose();
    } finally {
      setActing(false);
    }
  }

  if (!alerta) return null;
  if (busy || !dados) return <p className="bz-sub">{t('A carregar…')}</p>;

  const nomeEmpresa = (companyId) => {
    if (companyId === alerta.conversation?.buyerCompanyId) return alerta.conversation.buyerCompany;
    if (companyId === alerta.conversation?.supplierCompanyId) return alerta.conversation.supplierCompany;
    return t('Empresa');
  };

  return (
    <div className="chat-alert-detail">
      <div className="chat-thread-head">
        <div>
          <strong>{alerta.conversation ? `${alerta.conversation.buyerCompany} ↔ ${alerta.conversation.supplierCompany}` : t('Conversa')}</strong>
        </div>
        <Pill tone={LEVEL_TONE[alerta.level]}>{t(LEVEL_LABEL[alerta.level])}</Pill>
      </div>

      <div className="bz-panel chat-alert-reason">
        <strong>{t('Motivo')}</strong>
        <p className="bz-sub">{alerta.reason}</p>
        {alerta.signals?.length ? <p className="bz-sub2">{t('Sinais')}: {alerta.signals.join(', ')}</p> : null}
      </div>

      <div className="chat-messages chat-alert-messages">
        {(dados.messages || []).map((m) => (
          <div key={m.id} className="chat-bubble-row">
            <div className="chat-bubble">
              <span className="chat-bubble-author">{nomeEmpresa(m.senderCompanyId)}</span>
              {m.body ? <p>{m.body}</p> : null}
              <span className="chat-bubble-time">{formatDateTime(m.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {alerta.status !== 'RESOLVIDO' && alerta.status !== 'FALSO_POSITIVO' ? (
        <div className="chat-alert-actions">
          <textarea
            className="chat-alert-decision" rows={2} value={decisao} onChange={(e) => setDecisao(e.target.value)}
            placeholder={t('Nota da análise (opcional)…')}
          />
          <div className="chat-alert-actions-row">
            {alerta.status === 'ABERTO' ? (
              <button className="btn btn-ghost btn-sm" disabled={acting} onClick={() => reclassificar('EM_ANALISE')}>{t('Marcar em análise')}</button>
            ) : null}
            <button className="btn btn-ghost btn-sm" disabled={acting} onClick={() => reclassificar('FALSO_POSITIVO')}>{t('Falso positivo')}</button>
            <button className="btn btn-accent btn-sm" disabled={acting} onClick={() => reclassificar('RESOLVIDO')}>{t('Marcar como resolvido')}</button>
          </div>
        </div>
      ) : (
        <p className="bz-sub2">{t('Alerta já reclassificado')}: {t(alerta.status === 'FALSO_POSITIVO' ? 'Falso positivo' : 'Resolvido')}.</p>
      )}
    </div>
  );
}
