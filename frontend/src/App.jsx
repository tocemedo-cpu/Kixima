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
import Security from './pages/shared/Security';
import PrintableDocument from './pages/shared/PrintableDocument';

import CompradorHome from './pages/comprador/Home';
import Catalog from './pages/comprador/Catalog';
import ItemDetail from './pages/comprador/ItemDetail';
import Cart from './pages/comprador/Cart';
import Orders from './pages/comprador/Orders';
import BuyerQuotes from './pages/comprador/Quotes';
import Services from './pages/comprador/Services';
import Explore from './pages/comprador/Explore';
import ServiceDetail from './pages/comprador/ServiceDetail';
import Checkout from './pages/comprador/Checkout';
import Payments from './pages/comprador/Payments';
import Deliveries from './pages/comprador/Deliveries';
import Receptions from './pages/comprador/Receptions';
import Suppliers from './pages/comprador/Suppliers';
import Activities from './pages/comprador/Activities';
import BuyerProfile from './pages/comprador/Profile';

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
import Inventory from './pages/fornecedor/Inventory';
import Reports from './pages/fornecedor/Reports';
import ProductRanking from './pages/fornecedor/ProductRanking';
import SupplierDocuments from './pages/fornecedor/Documents';
import CatalogInsights from './pages/fornecedor/CatalogInsights';
import OrderHistory from './pages/fornecedor/OrderHistory';
import Wallet from './pages/fornecedor/Wallet';
import StockMovements from './pages/fornecedor/StockMovements';
import Kits from './pages/fornecedor/Kits';
import SupplierQuotes from './pages/fornecedor/SupplierQuotes';

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
        {/* Documentos imprimíveis (folha A4, sem a moldura da app) */}
        <Route path="/documento/po/:id" element={<PrintableDocument kind="po" />} />
        <Route path="/documento/fatura/:id" element={<PrintableDocument kind="invoice" />} />

        <Route element={<Shell />}>
          {/* Telas partilhadas / transversais */}
          <Route path="/notificacoes" element={<Notifications />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/ajuda" element={<Help />} />
          <Route path="/seguranca" element={<Security />} />

          {/* Comprador */}
          <Route element={<RequireRole role="COMPRADOR" />}>
            <Route path="/comprador" element={<CompradorHome />} />
            <Route path="/comprador/explorar" element={<Explore />} />
            <Route path="/comprador/catalogo" element={<Catalog />} />
            <Route path="/comprador/catalogo/:id" element={<ItemDetail />} />
            <Route path="/comprador/servicos" element={<Services />} />
            <Route path="/comprador/servicos/:slug" element={<ServiceDetail />} />
            <Route path="/comprador/cesta" element={<Cart />} />
            <Route path="/comprador/checkout" element={<Checkout />} />
            <Route path="/comprador/cotacoes" element={<BuyerQuotes />} />
            <Route path="/comprador/ordens" element={<Orders />} />
            <Route path="/comprador/ordens/:id" element={<OrderDetail />} />
            <Route path="/comprador/pagamentos" element={<Payments />} />
            <Route path="/comprador/entregas" element={<Deliveries />} />
            <Route path="/comprador/recepcao" element={<Receptions />} />
            <Route path="/comprador/fornecedores" element={<Suppliers />} />
            <Route path="/comprador/atividades" element={<Activities />} />
            <Route path="/comprador/perfil" element={<BuyerProfile />} />
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
            <Route path="/fornecedor/inventario/stock" element={<Inventory />} />
            <Route path="/fornecedor/relatorios/estatisticas" element={<Reports />} />
            <Route path="/fornecedor/relatorios/mais-vendidos" element={<ProductRanking />} />
            <Route path="/fornecedor/relatorios/mais-vistos" element={<ProductRanking />} />
            <Route path="/fornecedor/documentacao/certificacoes" element={<SupplierDocuments />} />
            <Route path="/fornecedor/documentacao/licencas" element={<SupplierDocuments />} />
            <Route path="/fornecedor/documentacao/catalogos" element={<SupplierDocuments />} />
            <Route path="/fornecedor/documentacao/fichas" element={<SupplierDocuments />} />
            <Route path="/fornecedor/catalogo/categorias" element={<CatalogInsights />} />
            <Route path="/fornecedor/catalogo/marcas" element={<CatalogInsights />} />
            <Route path="/fornecedor/catalogo/servicos" element={<CatalogInsights />} />
            <Route path="/fornecedor/catalogo/promocoes" element={<CatalogInsights />} />
            <Route path="/fornecedor/catalogo/kits" element={<Kits />} />
            <Route path="/fornecedor/inventario/armazens" element={<CatalogInsights />} />
            <Route path="/fornecedor/inventario/entradas" element={<StockMovements />} />
            <Route path="/fornecedor/inventario/saidas" element={<StockMovements />} />
            <Route path="/fornecedor/pedidos/historico" element={<OrderHistory />} />
            <Route path="/fornecedor/pedidos/solicitacoes" element={<SupplierQuotes />} />
            <Route path="/fornecedor/pedidos/cotacoes" element={<SupplierQuotes />} />
            <Route path="/fornecedor/financeiro/carteira" element={<Wallet />} />
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
