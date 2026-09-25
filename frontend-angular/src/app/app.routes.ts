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

  // Páginas públicas do site corporativo e fluxos sem sessão (registo,
  // recuperação de senha, convites) — todas ainda em React nesta fase.
  {
    path: '',
    pathMatch: 'full',
    component: PendingPageComponent,
    data: { titulo: 'Site corporativo KIXIMA' },
  },
  ...[
    'cadastro', 'recuperar', 'termos', 'privacidade', 'supplier-development',
    'parcerias', 'planos', 'convite', 'convite-admin',
  ].map((path) => ({ path, component: PendingPageComponent })),

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
          { path: '', component: PendingPageComponent, data: { titulo: 'Início — Comprador' } },
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
          { path: '**', component: PendingPageComponent, data: { titulo: 'Comprador' } },
        ],
      },

      // --- Fornecedor ----------------------------------------------------
      {
        path: 'fornecedor',
        canActivate: [roleGuard('FORNECEDOR')],
        children: [
          { path: '', component: PendingPageComponent, data: { titulo: 'Início — Fornecedor' } },
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
          { path: '', component: PendingPageComponent, data: { titulo: 'Início — Administração da Empresa' } },
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
          { path: '**', component: PendingPageComponent, data: { titulo: 'Administração da Empresa' } },
        ],
      },

      // --- Financeiro ---------------------------------------------------
      {
        path: 'financeiro',
        canActivate: [roleGuard('FINANCEIRO')],
        children: [
          { path: '', component: PendingPageComponent, data: { titulo: 'Início — Financeiro' } },
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
          { path: '', component: PendingPageComponent, data: { titulo: 'Início — Admin do Sistema' } },
          { path: '**', component: PendingPageComponent, data: { titulo: 'Admin do Sistema' } },
        ],
      },

      // --- Partilhado (qualquer papel autenticado) ---------------------
      { path: 'perfil', component: PendingPageComponent, data: { titulo: 'Perfil' } },
      { path: 'notificacoes', component: PendingPageComponent, data: { titulo: 'Notificações' } },
      { path: 'suporte', component: PendingPageComponent, data: { titulo: 'Suporte' } },
    ],
  },

  { path: '**', redirectTo: '/' },
];
