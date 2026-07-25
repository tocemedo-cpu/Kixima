// src/pages/adminSistema/Permissions.jsx
// Permissões (Admin do Sistema) — bloquear/desbloquear qualquer perfil do sistema.
import PermissionsPanel from '../../components/PermissionsPanel';

export default function AdminPermissions() {
  return (
    <PermissionsPanel
      trail={['Configurações e Suporte', 'Permissões']}
      title="Permissões"
      subtitle="Bloqueie ou desbloqueie o acesso de qualquer perfil dentro da plataforma."
      listUrl="/api/admin/users"
      statusUrl={(id) => `/api/admin/users/${id}/status`}
      showCompany
    />
  );
}
