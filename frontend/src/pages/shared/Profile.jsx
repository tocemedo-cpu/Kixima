// src/pages/shared/Profile.jsx
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/Common';
import { ROLE_LABELS } from '../../domain';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div>
      <PageHeader title="Perfil pessoal" subtitle="Dados da sua conta KIXIMA." />

      <div className="card card-pad" style={{ maxWidth: 460 }}>
        <div style={{ display: 'grid', gap: 14, fontSize: 13.5 }}>
          <Row label="Nome">{user.name}</Row>
          <Row label="Email">{user.email}</Row>
          <Row label="Perfil">{ROLE_LABELS[user.role]}</Row>
          {user.companyName ? <Row label="Empresa">{user.companyName}</Row> : null}
        </div>
        <p className="helptext" style={{ marginTop: 18 }}>
          Para alterar a sua palavra-passe ou dados de conta, contacte o Company Admin da sua
          empresa (ou o suporte KIXIMA, se for Admin do Sistema).
        </p>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--ink-400)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{children}</span>
    </div>
  );
}
