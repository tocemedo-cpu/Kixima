// src/App.jsx
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { RequireAuth, RequireRole } from './auth/RequireAuth';
import { ROLE_HOME } from './domain';
import AppLayout from './components/AppLayout';
import { CartProvider } from './pages/comprador/CartContext';

import LoginPage from './pages/shared/LoginPage';
import Register from './pages/shared/Register';
import AcceptInvite from './pages/shared/AcceptInvite';
import Notifications from './pages/shared/Notifications';
import Profile from './pages/shared/Profile';
import Help from './pages/shared/Help';
import OrderDetail from './pages/shared/OrderDetail';
import ModulePlaceholder from './pages/shared/ModulePlaceholder';

import CompradorHome from './pages/comprador/Home';
import Catalog from './pages/comprador/Catalog';
import ItemDetail from './pages/comprador/ItemDetail';
import Cart from './pages/comprador/Cart';
import Orders from './pages/comprador/Orders';

import CompanyAdminHome from './pages/companyAdmin/Home';
import Approvals from './pages/companyAdmin/Approvals';
import Users from './pages/companyAdmin/Users';
import CompanyProfile from './pages/companyAdmin/CompanyProfile';
import Contracts from './pages/companyAdmin/Contracts';

import FornecedorHome from './pages/fornecedor/Home';
import CatalogManage from './pages/fornecedor/CatalogManage';
import OrdersReceived from './pages/fornecedor/OrdersReceived';
import SupplierInvoices from './pages/fornecedor/Invoices';
import SupplierPayments from './pages/fornecedor/Payments';
import SupplierCompanyProfile from './pages/fornecedor/CompanyProfile';

import FinanceiroHome from './pages/financeiro/Home';
import PendingInvoices from './pages/financeiro/PendingInvoices';
import PaymentHistory from './pages/financeiro/PaymentHistory';

import AdminHome from './pages/adminSistema/Home';
import DueDiligence from './pages/adminSistema/DueDiligence';
import PolicyManagement from './pages/adminSistema/PolicyManagement';
import AdminContracts from './pages/adminSistema/Contracts';
import Companies from './pages/adminSistema/Companies';

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />;
}

// A cesta vive acima do AppLayout para que a sidebar possa mostrar o contador
// de itens. Para as outras personas o provider fica inativo (sem custo).
function Shell() {
  return (
    <CartProvider>
      <AppLayout />
    </CartProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<Register />} />
      <Route path="/convite/:token" element={<AcceptInvite />} />

      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          {/* Telas partilhadas / transversais */}
          <Route path="/notificacoes" element={<Notifications />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/ajuda" element={<Help />} />

          {/* Comprador */}
          <Route element={<RequireRole role="COMPRADOR" />}>
            <Route path="/comprador" element={<CompradorHome />} />
            <Route path="/comprador/catalogo" element={<Catalog />} />
            <Route path="/comprador/catalogo/:id" element={<ItemDetail />} />
            <Route path="/comprador/cesta" element={<Cart />} />
            <Route path="/comprador/ordens" element={<Orders />} />
            <Route path="/comprador/ordens/:id" element={<OrderDetail />} />
          </Route>

          {/* Company Admin */}
          <Route element={<RequireRole role="COMPANY_ADMIN" />}>
            <Route path="/empresa" element={<CompanyAdminHome />} />
            <Route path="/empresa/aprovacoes" element={<Approvals />} />
            <Route path="/empresa/aprovacoes/:id" element={<OrderDetail />} />
            <Route path="/empresa/utilizadores" element={<Users />} />
            <Route path="/empresa/perfil" element={<CompanyProfile />} />
            <Route path="/empresa/contratos" element={<Contracts />} />
          </Route>

          {/* Fornecedor */}
          <Route element={<RequireRole role="FORNECEDOR" />}>
            <Route path="/fornecedor" element={<FornecedorHome />} />
            <Route path="/fornecedor/catalogo" element={<CatalogManage />} />
            <Route path="/fornecedor/ordens" element={<OrdersReceived />} />
            <Route path="/fornecedor/ordens/:id" element={<OrderDetail />} />
            <Route path="/fornecedor/faturas" element={<SupplierInvoices />} />
            <Route path="/fornecedor/pagamentos" element={<SupplierPayments />} />
            <Route path="/fornecedor/perfil" element={<SupplierCompanyProfile />} />
            {/* Módulos do menu ERP ainda em preparação — evita 404 e mantém a navegação. */}
            <Route path="/fornecedor/*" element={<ModulePlaceholder />} />
          </Route>

          {/* Financeiro */}
          <Route element={<RequireRole role="FINANCEIRO" />}>
            <Route path="/financeiro" element={<FinanceiroHome />} />
            <Route path="/financeiro/faturas" element={<PendingInvoices />} />
            <Route path="/financeiro/historico" element={<PaymentHistory />} />
            <Route path="/financeiro/perfil" element={<CompanyProfile />} />
          </Route>

          {/* Admin do Sistema KIXIMA */}
          <Route element={<RequireRole role="ADMIN_SISTEMA" />}>
            <Route path="/sistema" element={<AdminHome />} />
            <Route path="/sistema/due-diligence" element={<DueDiligence />} />
            <Route path="/sistema/apolices" element={<PolicyManagement />} />
            <Route path="/sistema/contratos" element={<AdminContracts />} />
            <Route path="/sistema/empresas" element={<Companies />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Landing />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
