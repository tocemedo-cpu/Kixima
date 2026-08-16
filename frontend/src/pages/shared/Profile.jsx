// src/pages/shared/Profile.jsx
// Perfil pessoal — mesmo formato para todas as personas (o modelo do
// comprador). Foto por upload/câmera, resumo da conta adequado ao papel,
// atividade recente e informações da empresa. Ligado a /api/users/profile.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Crumbs, PageHead, KpiRow, Pill } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import AvatarUploader from '../../components/AvatarUploader';
import { useI18n } from '../../i18n';
import { PO_STATUS, ROLE_LABELS, formatMoney, formatDateTime, ROLE_HOME } from '../../domain';

export default function Profile() {
  // `utilizador` e não `user`: mais abaixo há um `user` vindo dos dados da
  // página, e duas variáveis com o mesmo nome no mesmo âmbito não compilam.
  const { user: utilizador, updateUser } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/api/users/profile').then(setData).catch((e) => setError(e.message)); }, []);

  // Atualiza a página e o header (Navbar) com a nova foto.
  const setAvatar = (avatarUrl) => { setData((d) => ({ ...d, user: { ...d.user, avatarUrl } })); updateUser({ avatarUrl }); };

  if (error) return <div className="empty-state"><h3>{t('Não foi possível carregar')}</h3><p>{error}</p></div>;
  if (!data) return <div className="bz-empty">{t('A carregar…')}</div>;

  const { user, company, cards, recent } = data;
  const kpiCards = (cards || []).map((c) => ({ ...c, value: c.money ? formatMoney(c.value) : c.value }));

  return (
    <div>
      {/* Esta página é partilhada pelos cinco perfis, e "Home" não é o mesmo
          sítio para todos. O destino sai do ROLE_HOME que já existe em
          domain.js — fixar /comprador aqui levaria um fornecedor para uma
          área a que nem tem acesso. */}
      <Crumbs trail={[{ label: 'Home', to: ROLE_HOME[utilizador?.role] || '/' }, 'Perfil']} />
      <PageHead title="Meu Perfil" subtitle="Gerencie as suas informações pessoais, preferências e configurações da sua conta." />

      <div className="pf-top">
        <div className="bz-panel pf-id">
          <AvatarUploader name={user.name} avatarUrl={user.avatarUrl} onChange={setAvatar} size={68} />
          <div>
            <div className="pf-name">{user.name} <Pill tone="success">Ativo</Pill></div>
            <div className="pf-role">{t(ROLE_LABELS[user.role] || user.role)}</div>
            <div className="pf-company">{company?.name || t('Administração KIXIMA')}</div>
          </div>
        </div>

        <div className="bz-panel">
          <h3>{t('Contacto')}</h3>
          <div className="pf-info"><Icon name="policy" size={15} /> <span>{user.email}</span></div>
          <div className="pf-info"><Icon name="building" size={15} /> <span>{company?.contactPhone || '—'}</span></div>
          <div className="pf-info"><Icon name="offshore" size={15} /> <span>{[company?.city, company?.country].filter(Boolean).join(', ') || 'Angola'}</span></div>
          <div className="pf-info"><Icon name="wallet" size={15} /> <span>{t('Kwanza (Kz)')}</span></div>
        </div>

        <div className="bz-panel">
          <h3>{t('Segurança da Conta')}</h3>
          <div className="bz-panel-row"><span>{t('Palavra-passe')}</span><a className="pf-link" href="/seguranca">{t('Alterar')}</a></div>
          <div className="bz-panel-row"><span>{t('Autenticação em duas etapas')}</span><span className="bz-muted">{t('Configurar')}</span></div>
          <div className="bz-panel-row"><span>{t('Conta criada')}</span><strong>{formatDateTime(user.createdAt)}</strong></div>
        </div>
      </div>

      <h2 className="pf-h2">{t('Resumo da Conta')}</h2>
      <KpiRow cards={kpiCards} />

      <div className="bz-layout">
        <div className="bz-panel">
          <h3>{t('Atividade Recente')}</h3>
          {(!recent || recent.length === 0) ? <p className="bz-sub">{t('Sem atividade recente.')}</p> : (
            <div className="bz-scroll-x">
            <table className="bz-table" style={{ marginTop: 4 }}>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.reference}>
                    <td><span className="bz-mono">{r.reference}</span><span className="bz-sub2">{r.party}</span></td>
                    <td><Pill tone={PO_STATUS[r.status]?.tone}>{PO_STATUS[r.status]?.label || r.status}</Pill></td>
                    <td className="r bz-muted">{formatDateTime(r.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
        <div className="bz-side">
          <div className="bz-panel">
            <h3>{company ? t('Informações da Empresa') : t('Plataforma')}</h3>
            {company ? (
              <>
                <div className="bz-panel-row"><span>{t('Empresa')}</span><strong>{company.name}</strong></div>
                <div className="bz-panel-row"><span>{t('NIF')}</span><strong>{company.taxId}</strong></div>
                <div className="bz-panel-row"><span>{t('Tipo')}</span><strong>{company.type === 'FORNECEDOR' ? t('Prestadora') : t('Cliente')}</strong></div>
                <div className="bz-panel-row"><span>{t('Endereço')}</span><strong>{company.address || '—'}</strong></div>
                <div className="bz-panel-row"><span>{t('Estado')}</span><Pill tone={company.status === 'APROVADA' ? 'success' : 'pending'}>{company.status === 'APROVADA' ? 'Aprovada' : company.status}</Pill></div>
              </>
            ) : (
              <p className="bz-sub">{t('Conta de Administração do Sistema KIXIMA — sem empresa associada.')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
