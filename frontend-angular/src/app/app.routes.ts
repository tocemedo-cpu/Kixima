// Espelha a árvore de rotas de frontend/src/App.jsx. Cada persona tem o seu
// prefixo (ver ROLE_HOME em shared/domain.ts, portado de domain.js). Os
// ecrãs já migrados (auth completo + cotações) apontam para os componentes
// reais; todos os outros apontam para PendingPageComponent — nada foi
// removido, só ainda não migrado (ver docs/migracao-angular/PLANO.md).
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { ShellComponent } from './features/shell/shell.component';
import { PendingPageComponent } from './features/shell/pending-page.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page.component').then((m) => m.LoginPageComponent),
  },

  // Páginas públicas do site corporativo — ainda em React nesta fase.
  {
    path: '',
    pathMatch: 'full',
    component: PendingPageComponent,
    data: { titulo: 'Site corporativo KIXIMA' },
  },
  ...['termos', 'privacidade', 'supplier-development', 'parcerias', 'planos'].map((path) => ({ path, component: PendingPageComponent })),

  // Fluxos sem sessão (cadastro, recuperação de senha, convites) — sem
  // guarda nenhuma, tal como em frontend/src/App.jsx:148-153 (só /login usa
  // o equivalente de guestGuard, dentro do próprio LoginPage.jsx).
  {
    path: 'cadastro',
    loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'convite/:token',
    loadComponent: () => import('./features/auth/accept-invite.component').then((m) => m.AcceptInviteComponent),
  },
  {
    path: 'convite-admin/:token',
    loadComponent: () =>
      import('./features/auth/accept-admin-invite.component').then((m) => m.AcceptAdminInviteComponent),
  },
  {
    path: 'recuperar',
    loadComponent: () => import('./features/auth/password-reset.component').then((m) => m.PasswordResetComponent),
  },
  {
    path: 'recuperar/:token',
    loadComponent: () => import('./features/auth/password-reset.component').then((m) => m.PasswordResetComponent),
  },

  // Documentos imprimíveis (folha A4, sem a moldura da app) — fora do Shell,
  // exactamente como em frontend/src/App.jsx:164-168 (dentro de RequireAuth,
  // mas fora do layout <Shell>). Ainda não migrados — ver PLANO.md.
  {
    path: 'documento',
    canActivate: [authGuard],
    children: [
      { path: 'po/:id', component: PendingPageComponent, data: { titulo: 'Documento — Ordem de Compra' } },
      { path: 'fatura/:id', component: PendingPageComponent, data: { titulo: 'Documento — Fatura' } },
      { path: 'taxas/:companyId', component: PendingPageComponent, data: { titulo: 'Extrato de Taxas KIXIMA' } },
    ],
  },

  {
    path: '',
    canActivate: [authGuard],
    component: ShellComponent,
    children: [
      // --- Comprador ---------------------------------------------------
      {
        path: 'comprador',
        canActivate: [roleGuard('COMPRADOR')],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/dashboard/comprador-home.component').then((m) => m.CompradorHomeComponent),
            data: { titulo: 'Início — Comprador' },
          },
          {
            // Corrigido nesta sessão: o caminho real de Quotes.jsx é
            // /comprador/cotacoes (ver frontend/src/App.jsx:191), não
            // /comprador/pedidos — a versão anterior deste ficheiro tinha
            // o caminho errado e a rota nunca era alcançável a partir da
            // navegação real da aplicação.
            path: 'cotacoes',
            loadComponent: () => import('./features/quotes/quotes.component').then((m) => m.QuotesComponent),
          },
          {
            path: 'explorar',
            loadComponent: () => import('./features/catalog/explore.component').then((m) => m.ExploreComponent),
          },
          {
            path: 'servicos',
            loadComponent: () => import('./features/catalog/services.component').then((m) => m.ServicesComponent),
          },
          {
            path: 'servicos/:slug',
            loadComponent: () => import('./features/catalog/service-detail.component').then((m) => m.ServiceDetailComponent),
          },
          {
            path: 'comparar',
            loadComponent: () => import('./features/catalog/supplier-compare.component').then((m) => m.SupplierCompareComponent),
          },
          {
            path: 'fornecedores',
            loadComponent: () => import('./features/orders/suppliers.component').then((m) => m.SuppliersComponent),
          },
          {
            path: 'catalogo',
            loadComponent: () =>
              import('./features/catalog/catalog-browse.component').then((m) => m.CatalogBrowseComponent),
          },
          {
            path: 'catalogo/:id',
            loadComponent: () => import('./features/catalog/item-detail.component').then((m) => m.ItemDetailComponent),
          },
          {
            path: 'cesta',
            loadComponent: () => import('./features/cart/cart.component').then((m) => m.CartComponent),
          },
          {
            path: 'checkout',
            loadComponent: () => import('./features/orders/checkout.component').then((m) => m.CheckoutComponent),
          },
          {
            path: 'ordens',
            loadComponent: () => import('./features/orders/orders.component').then((m) => m.OrdersComponent),
          },
          {
            path: 'ordens/:id',
            loadComponent: () => import('./features/orders/order-detail.component').then((m) => m.OrderDetailComponent),
          },
          {
            path: 'pagamentos',
            loadComponent: () => import('./features/orders/buyer-payments.component').then((m) => m.BuyerPaymentsComponent),
          },
          {
            path: 'entregas',
            loadComponent: () => import('./features/orders/deliveries.component').then((m) => m.DeliveriesComponent),
          },
          {
            path: 'recepcao',
            loadComponent: () => import('./features/orders/receptions.component').then((m) => m.ReceptionsComponent),
          },
          { path: '**', component: PendingPageComponent, data: { titulo: 'Comprador' } },
        ],
      },

      // --- Fornecedor ----------------------------------------------------
      {
        path: 'fornecedor',
        canActivate: [roleGuard('FORNECEDOR')],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/dashboard/fornecedor-home.component').then((m) => m.FornecedorHomeComponent),
            data: { titulo: 'Início — Fornecedor' },
          },
          {
            path: 'catalogo',
            loadComponent: () => import('./features/catalog/catalog-manage.component').then((m) => m.CatalogManageComponent),
          },
          {
            path: 'catalogo/servicos',
            loadComponent: () => import('./features/catalog/catalog-manage.component').then((m) => m.CatalogManageComponent),
          },
          {
            path: 'inventario/stock',
            loadComponent: () => import('./features/catalog/inventory.component').then((m) => m.InventoryComponent),
          },
          {
            path: 'inventario/entradas',
            loadComponent: () => import('./features/catalog/stock-movements.component').then((m) => m.StockMovementsComponent),
            data: { isEntrada: true },
          },
          {
            path: 'inventario/saidas',
            loadComponent: () => import('./features/catalog/stock-movements.component').then((m) => m.StockMovementsComponent),
            data: { isEntrada: false },
          },
          {
            path: 'inventario/armazens',
            loadComponent: () => import('./features/catalog/catalog-insights.component').then((m) => m.CatalogInsightsComponent),
            data: { seg: 'armazens' },
          },
          {
            path: 'catalogo/categorias',
            loadComponent: () => import('./features/catalog/catalog-insights.component').then((m) => m.CatalogInsightsComponent),
            data: { seg: 'categorias' },
          },
          {
            path: 'catalogo/marcas',
            loadComponent: () => import('./features/catalog/catalog-insights.component').then((m) => m.CatalogInsightsComponent),
            data: { seg: 'marcas' },
          },
          {
            path: 'catalogo/promocoes',
            loadComponent: () => import('./features/catalog/catalog-insights.component').then((m) => m.CatalogInsightsComponent),
            data: { seg: 'promocoes' },
          },
          {
            path: 'catalogo/importar',
            loadComponent: () => import('./features/catalog/catalog-import.component').then((m) => m.CatalogImportComponent),
          },
          {
            path: 'pedidos/historico',
            loadComponent: () => import('./features/orders/order-history.component').then((m) => m.OrderHistoryComponent),
          },
          {
            path: 'financeiro/carteira',
            loadComponent: () => import('./features/orders/wallet.component').then((m) => m.WalletComponent),
          },
          {
            path: 'pedidos/solicitacoes',
            loadComponent: () =>
              import('./features/quotes/supplier-quotes.component').then((m) => m.SupplierQuotesComponent),
            data: { inbox: true },
          },
          {
            path: 'pedidos/cotacoes',
            loadComponent: () =>
              import('./features/quotes/supplier-quotes.component').then((m) => m.SupplierQuotesComponent),
            data: { inbox: false },
          },
          {
            path: 'ordens',
            loadComponent: () =>
              import('./features/orders/orders-received.component').then((m) => m.OrdersReceivedComponent),
          },
          {
            path: 'ordens/:id',
            loadComponent: () => import('./features/orders/order-detail.component').then((m) => m.OrderDetailComponent),
          },
          {
            path: 'faturas',
            loadComponent: () =>
              import('./features/orders/supplier-invoices.component').then((m) => m.SupplierInvoicesComponent),
          },
          {
            path: 'pagamentos',
            loadComponent: () =>
              import('./features/orders/supplier-payments.component').then((m) => m.SupplierPaymentsComponent),
          },
          { path: '**', component: PendingPageComponent, data: { titulo: 'Fornecedor' } },
        ],
      },

      // --- Company Admin ---------------------------------------------------
      {
        path: 'empresa',
        canActivate: [roleGuard('COMPANY_ADMIN')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/dashboard/company-admin-home.component').then((m) => m.CompanyAdminHomeComponent),
            data: { titulo: 'Início — Administração da Empresa' },
          },
          {
            path: 'aprovacoes',
            loadComponent: () => import('./features/orders/approvals.component').then((m) => m.ApprovalsComponent),
          },
          // OrderDetail é partilhado por 4 personas (ver frontend/src/App.jsx:216).
          {
            path: 'aprovacoes/:id',
            loadComponent: () => import('./features/orders/order-detail.component').then((m) => m.OrderDetailComponent),
          },
          {
            path: 'contratos',
            loadComponent: () => import('./features/contracts/contracts.component').then((m) => m.ContractsComponent),
          },
          {
            path: 'utilizadores',
            loadComponent: () => import('./features/company-admin/users.component').then((m) => m.UsersComponent),
          },
          {
            path: 'organizacao',
            loadComponent: () =>
              import('./features/company-admin/organization.component').then((m) => m.OrganizationComponent),
          },
          {
            path: 'perfil',
            loadComponent: () =>
              import('./features/company-admin/company-profile.component').then((m) => m.CompanyProfileComponent),
          },
          { path: '**', component: PendingPageComponent, data: { titulo: 'Administração da Empresa' } },
        ],
      },

      // --- Financeiro ---------------------------------------------------
      {
        path: 'financeiro',
        canActivate: [roleGuard('FINANCEIRO')],
        children: [
          {
            path: '',
            loadComponent: () => import('./features/dashboard/financeiro-home.component').then((m) => m.FinanceiroHomeComponent),
            data: { titulo: 'Início — Financeiro' },
          },
          {
            path: 'faturas',
            loadComponent: () =>
              import('./features/financeiro/pending-invoices.component').then((m) => m.PendingInvoicesComponent),
          },
          {
            path: 'historico',
            loadComponent: () =>
              import('./features/financeiro/payment-history.component').then((m) => m.PaymentHistoryComponent),
          },
          {
            path: 'ordens/:id',
            loadComponent: () => import('./features/orders/order-detail.component').then((m) => m.OrderDetailComponent),
          },
          // Mesma página do lado Fornecedor (frontend/src/App.jsx:268) — a
          // empresa também vende, então o Financeiro vê os pagamentos
          // recebidos das suas próprias vendas aqui.
          {
            path: 'recebidos',
            loadComponent: () =>
              import('./features/orders/supplier-payments.component').then((m) => m.SupplierPaymentsComponent),
          },
          { path: '**', component: PendingPageComponent, data: { titulo: 'Financeiro' } },
        ],
      },

      // --- Admin do Sistema ---------------------------------------------------
      {
        path: 'sistema',
        canActivate: [roleGuard('ADMIN_SISTEMA')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/dashboard/admin-sistema-home.component').then((m) => m.AdminSistemaHomeComponent),
            data: { titulo: 'Início — Admin do Sistema' },
          },
          {
            path: 'due-diligence',
            loadComponent: () => import('./features/admin/due-diligence.component').then((m) => m.DueDiligenceComponent),
          },
          {
            path: 'taxas',
            loadComponent: () => import('./features/admin/platform-fees.component').then((m) => m.PlatformFeesComponent),
          },
          { path: '**', component: PendingPageComponent, data: { titulo: 'Admin do Sistema' } },
        ],
      },

      // --- Partilhado (qualquer papel autenticado) ---------------------
      { path: 'perfil', component: PendingPageComponent, data: { titulo: 'Perfil' } },
      { path: 'notificacoes', component: PendingPageComponent, data: { titulo: 'Notificações' } },
      { path: 'suporte', component: PendingPageComponent, data: { titulo: 'Suporte' } },
      { path: 'ajuda', component: PendingPageComponent, data: { titulo: 'Ajuda' } },
    ],
  },

  { path: '**', redirectTo: '/' },
];
