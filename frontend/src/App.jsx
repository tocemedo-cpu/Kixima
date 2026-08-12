// src/App.jsx
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { RequireAuth, RequireRole } from './auth/RequireAuth';
import { ROLE_HOME } from './domain';
import AppLayout from './components/AppLayout';
import { CartProvider } from './pages/comprador/CartContext';

// A página de login fica eager (é o primeiro ecrã) — evita um flash de "a
// carregar" no arranque. Todas as outras páginas são carregadas a pedido
// (code-splitting): cada rota é um chunk próprio, buscado só quando visitada.
import LoginPage from './pages/shared/LoginPage';

const Register = lazy(() => import('./pages/shared/Register'));
const AcceptInvite = lazy(() => import('./pages/shared/AcceptInvite'));
const PasswordReset = lazy(() => import('./pages/shared/PasswordReset'));
const Legal = lazy(() => import('./pages/shared/Legal'));
const SupplierDevelopment = lazy(() => import('./pages/shared/SupplierDevelopment'));
const Plans = lazy(() => import('./pages/shared/Plans'));
const Notifications = lazy(() => import('./pages/shared/Notifications'));
const Profile = lazy(() => import('./pages/shared/Profile'));
const Help = lazy(() => import('./pages/shared/Help'));
const OrderDetail = lazy(() => import('./pages/shared/OrderDetail'));
const ModulePlaceholder = lazy(() => import('./pages/shared/ModulePlaceholder'));
const Security = lazy(() => import('./pages/shared/Security'));
const PrintableDocument = lazy(() => import('./pages/shared/PrintableDocument'));
const FeeStatement = lazy(() => import('./pages/shared/FeeStatement'));

const CompradorHome = lazy(() => import('./pages/comprador/Home'));
const Catalog = lazy(() => import('./pages/comprador/Catalog'));
const ItemDetail = lazy(() => import('./pages/comprador/ItemDetail'));
const Cart = lazy(() => import('./pages/comprador/Cart'));
const Orders = lazy(() => import('./pages/comprador/Orders'));
const BuyerQuotes = lazy(() => import('./pages/comprador/Quotes'));
const Services = lazy(() => import('./pages/comprador/Services'));
const Explore = lazy(() => import('./pages/comprador/Explore'));
const ServiceDetail = lazy(() => import('./pages/comprador/ServiceDetail'));
const SupplierCompare = lazy(() => import('./pages/comprador/SupplierCompare'));
const Checkout = lazy(() => import('./pages/comprador/Checkout'));
const Payments = lazy(() => import('./pages/comprador/Payments'));
const Deliveries = lazy(() => import('./pages/comprador/Deliveries'));
const Receptions = lazy(() => import('./pages/comprador/Receptions'));
const Suppliers = lazy(() => import('./pages/comprador/Suppliers'));
const Activities = lazy(() => import('./pages/comprador/Activities'));

const CompanyAdminHome = lazy(() => import('./pages/companyAdmin/Home'));
const Approvals = lazy(() => import('./pages/companyAdmin/Approvals'));
const Users = lazy(() => import('./pages/companyAdmin/Users'));
const CompanyProfile = lazy(() => import('./pages/companyAdmin/CompanyProfile'));
const Contracts = lazy(() => import('./pages/companyAdmin/Contracts'));
const Organization = lazy(() => import('./pages/companyAdmin/Organization'));
const CompanyDocuments = lazy(() => import('./pages/companyAdmin/CompanyDocuments'));
const CompanyPermissions = lazy(() => import('./pages/companyAdmin/Permissions'));
const CompanyReports = lazy(() => import('./pages/companyAdmin/Reports'));
const CompanyActivities = lazy(() => import('./pages/companyAdmin/Activities'));
const CompanySettings = lazy(() => import('./pages/companyAdmin/Settings'));

const FornecedorHome = lazy(() => import('./pages/fornecedor/Home'));
const CatalogManage = lazy(() => import('./pages/fornecedor/CatalogManage'));
const OrdersReceived = lazy(() => import('./pages/fornecedor/OrdersReceived'));
const SupplierInvoices = lazy(() => import('./pages/fornecedor/Invoices'));
const SupplierPayments = lazy(() => import('./pages/fornecedor/Payments'));
const Inventory = lazy(() => import('./pages/fornecedor/Inventory'));
const Reports = lazy(() => import('./pages/fornecedor/Reports'));
const ProductRanking = lazy(() => import('./pages/fornecedor/ProductRanking'));
const SupplierDocuments = lazy(() => import('./pages/fornecedor/Documents'));
const CatalogInsights = lazy(() => import('./pages/fornecedor/CatalogInsights'));
const OrderHistory = lazy(() => import('./pages/fornecedor/OrderHistory'));
const Wallet = lazy(() => import('./pages/fornecedor/Wallet'));
const StockMovements = lazy(() => import('./pages/fornecedor/StockMovements'));
const Kits = lazy(() => import('./pages/fornecedor/Kits'));
const SupplierQuotes = lazy(() => import('./pages/fornecedor/SupplierQuotes'));
const CatalogImport = lazy(() => import('./pages/fornecedor/CatalogImport'));

const FinanceiroHome = lazy(() => import('./pages/financeiro/Home'));
const PendingInvoices = lazy(() => import('./pages/financeiro/PendingInvoices'));
const PaymentHistory = lazy(() => import('./pages/financeiro/PaymentHistory'));

const AdminHome = lazy(() => import('./pages/adminSistema/Home'));
const AdminPermissions = lazy(() => import('./pages/adminSistema/Permissions'));
const SystemActivities = lazy(() => import('./pages/adminSistema/SystemActivities'));
const DueDiligence = lazy(() => import('./pages/adminSistema/DueDiligence'));
const PolicyManagement = lazy(() => import('./pages/adminSistema/PolicyManagement'));
const AdminContracts = lazy(() => import('./pages/adminSistema/Contracts'));
const Companies = lazy(() => import('./pages/adminSistema/Companies'));
const ErpIntegrations = lazy(() => import('./pages/adminSistema/ErpIntegrations'));
const PlatformFees = lazy(() => import('./pages/adminSistema/PlatformFees'));
const AuditTrail = lazy(() => import('./pages/adminSistema/AuditTrail'));
const AdminPlans = lazy(() => import('./pages/adminSistema/Plans'));
const AdminSupplierDev = lazy(() => import('./pages/adminSistema/SupplierDev'));

// Ecrã de recurso enquanto o chunk de uma rota é carregado.
function PageLoading() {
  return <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center', color: 'var(--ink-400,#888)' }}>A carregar…</div>;
}

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
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<Register />} />
      <Route path="/convite/:token" element={<AcceptInvite />} />
      <Route path="/recuperar" element={<PasswordReset />} />
      <Route path="/recuperar/:token" element={<PasswordReset />} />
      <Route path="/supplier-development" element={<SupplierDevelopment initialTrack="BUROCRACIA" />} />
      <Route path="/parcerias" element={<SupplierDevelopment initialTrack="PARCERIA" />} />
      <Route path="/planos" element={<Plans />} />
      <Route path="/termos" element={<Legal kind="termos" />} />
      <Route path="/privacidade" element={<Legal kind="privacidade" />} />

      <Route element={<RequireAuth />}>
        {/* Documentos imprimíveis (folha A4, sem a moldura da app) */}
        <Route path="/documento/po/:id" element={<PrintableDocument kind="po" />} />
        <Route path="/documento/fatura/:id" element={<PrintableDocument kind="invoice" />} />
        <Route path="/documento/taxas/:companyId" element={<FeeStatement />} />

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
            <Route path="/comprador/comparar" element={<SupplierCompare />} />
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
            <Route path="/comprador/perfil" element={<Profile />} />
          </Route>

          {/* Company Admin */}
          <Route element={<RequireRole role="COMPANY_ADMIN" />}>
            <Route path="/empresa" element={<CompanyAdminHome />} />
            <Route path="/empresa/aprovacoes" element={<Approvals />} />
            <Route path="/empresa/aprovacoes/:id" element={<OrderDetail />} />
            <Route path="/empresa/utilizadores" element={<Users />} />
            <Route path="/empresa/organizacao" element={<Organization />} />
            <Route path="/empresa/documentos" element={<CompanyDocuments />} />
            <Route path="/empresa/permissoes" element={<CompanyPermissions />} />
            <Route path="/empresa/perfil" element={<CompanyProfile />} />
            <Route path="/empresa/contratos" element={<Contracts />} />
            <Route path="/empresa/relatorios" element={<CompanyReports />} />
            <Route path="/empresa/atividades" element={<CompanyActivities />} />
            <Route path="/empresa/configuracoes" element={<CompanySettings />} />
          </Route>

          {/* Fornecedor */}
          <Route element={<RequireRole role="FORNECEDOR" />}>
            <Route path="/fornecedor" element={<FornecedorHome />} />
            <Route path="/fornecedor/catalogo" element={<CatalogManage />} />
            <Route path="/fornecedor/ordens" element={<OrdersReceived />} />
            <Route path="/fornecedor/ordens/:id" element={<OrderDetail />} />
            <Route path="/fornecedor/faturas" element={<SupplierInvoices />} />
            <Route path="/fornecedor/pagamentos" element={<SupplierPayments />} />
            <Route path="/fornecedor/inventario/stock" element={<Inventory />} />
            <Route path="/fornecedor/relatorios/estatisticas" element={<Reports />} />
            <Route path="/fornecedor/relatorios/mais-vendidos" element={<ProductRanking />} />
            <Route path="/fornecedor/relatorios/mais-vistos" element={<ProductRanking />} />
            <Route path="/fornecedor/documentacao/certificacoes" element={<SupplierDocuments />} />
            <Route path="/fornecedor/documentacao/catalogos" element={<SupplierDocuments />} />
            <Route path="/fornecedor/documentacao/fichas" element={<SupplierDocuments />} />
            <Route path="/fornecedor/catalogo/categorias" element={<CatalogInsights />} />
            <Route path="/fornecedor/catalogo/marcas" element={<CatalogInsights />} />
            <Route path="/fornecedor/catalogo/servicos" element={<CatalogManage />} />
            <Route path="/fornecedor/catalogo/promocoes" element={<CatalogInsights />} />
            <Route path="/fornecedor/catalogo/kits" element={<Kits />} />
            <Route path="/fornecedor/catalogo/importar" element={<CatalogImport />} />
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
            {/* Financeiro numa empresa FORNECEDORA: lado de quem recebe. */}
            <Route path="/financeiro/recebidos" element={<SupplierPayments />} />
            <Route path="/financeiro/ordens/:id" element={<OrderDetail />} />
          </Route>

          {/* Admin do Sistema KIXIMA */}
          <Route element={<RequireRole role="ADMIN_SISTEMA" />}>
            <Route path="/sistema" element={<AdminHome />} />
            <Route path="/sistema/due-diligence" element={<DueDiligence />} />
            <Route path="/sistema/apolices" element={<PolicyManagement />} />
            <Route path="/sistema/integracoes-erp" element={<ErpIntegrations />} />
            <Route path="/sistema/contratos" element={<AdminContracts />} />
            <Route path="/sistema/empresas" element={<Companies />} />
            <Route path="/sistema/permissoes" element={<AdminPermissions />} />
            <Route path="/sistema/atividades" element={<SystemActivities />} />
            <Route path="/sistema/taxas" element={<PlatformFees />} />
            <Route path="/sistema/auditoria" element={<AuditTrail />} />
            <Route path="/sistema/planos" element={<AdminPlans />} />
            <Route path="/sistema/supplier-development" element={<AdminSupplierDev />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Landing />} />
      <Route path="*" element={<Landing />} />
    </Routes>
    </Suspense>
  );
}
