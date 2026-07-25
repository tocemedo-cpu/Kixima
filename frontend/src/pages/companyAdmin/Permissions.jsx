// src/pages/companyAdmin/Permissions.jsx
// Permissões (Company Admin) — bloquear/desbloquear os perfis da própria empresa.
import PermissionsPanel from '../../components/PermissionsPanel';

export default function CompanyPermissions() {
  return (
    <PermissionsPanel
      trail={['Empresa', 'Permissões']}
      title="Permissões"
      subtitle="Bloqueie ou desbloqueie o acesso dos perfis da sua empresa."
      listUrl="/api/companies/users"
      statusUrl={(id) => `/api/companies/users/${id}/status`}
    />
  );
}
