// src/i18n/content8.js
// Texto de INTERFACE criado no SERVIDOR e mostrado tal e qual no ecrã.
//
// Porque é que precisa de ficheiro próprio: a auditoria estática (i18n-audit.mjs)
// lê os ficheiros do frontend à procura de t('…'). Estes textos não estão em
// ficheiro nenhum do frontend — nascem em backend/src/services (cartões do
// perfil, tarefas da lista de atividades, catálogo de relatórios) e chegam pela
// API já escritos. Passavam pelo t() sem tradução e apareciam em português com
// o idioma em inglês ou francês, sem que nenhum auditor desse por isso.
//
// A varredura em execução (scripts/i18n-runtime-scan.mjs) é o que apanha esta
// classe: abre as páginas no idioma escolhido e assinala o que continua em
// português.
//
// Ao acrescentar texto visível nos serviços do backend, acrescenta-o também aqui.

export const EN9 = {
  // --- Cartões do perfil (profileService) ------------------------------------
  'Este ano': 'This year',
  'Ordens de Compra': 'Purchase Orders',
  'Ordens Recebidas': 'Orders Received',
  'Valor Total Comprado': 'Total Purchased',
  'Valor Total Vendido': 'Total Sold',
  'Itens Recebidos': 'Items Received',
  'Itens Entregues': 'Items Delivered',
  'Fornecedores': 'Suppliers',
  'Clientes': 'Clients',
  'Com transações': 'With transactions',
  'Empresas': 'Companies',
  'Registadas': 'Registered',
  'Ordens (plataforma)': 'Orders (platform)',
  'Apólices': 'Policies',
  'Utilizadores': 'Users',

  // --- Tarefas e atividades do comprador (buyerService) ----------------------
  'Aprovar Ordem de Compra': 'Approve Purchase Order',
  'Rever e aprovar a PO antes do envio ao fornecedor.': 'Review and approve the PO before sending it to the supplier.',
  'Autorizar Pagamento': 'Authorise Payment',
  'Rever e autorizar o pagamento da fatura.': 'Review and authorise payment of the invoice.',
  'Acompanhar Entrega': 'Track Delivery',
  'Verificar o estado da entrega em andamento.': 'Check the status of the delivery in progress.',
  'Confirmar Recepção': 'Confirm Receipt',
  'Confirmar a recepção dos itens entregues.': 'Confirm receipt of the delivered items.',
  'Resolver Divergência': 'Resolve Discrepancy',
  'Analisar divergência na recepção de itens.': 'Review the discrepancy found when receiving items.',
  'Ordem concluída': 'Order completed',
  'Recepção confirmada com sucesso.': 'Receipt confirmed successfully.',

  // --- Catálogo de relatórios e atividades (companyAdminService) -------------
  'Relatório de Ordens de Compra': 'Purchase Orders Report',
  'POs por estado e valor': 'POs by status and value',
  'Relatório Financeiro': 'Financial Report',
  'Resumo de faturas e pagamentos': 'Summary of invoices and payments',
  'Relatório de Contratos': 'Contracts Report',
  'Estado e validade dos contratos': 'Contract status and validity',
  'Atividade da Empresa': 'Company Activity',
  'Ações e acessos recentes': 'Recent actions and access',
  'Acompanhamento': 'Follow-up',
  'Aprovação': 'Approval',
  'Atualização': 'Update',
  'Conclusão': 'Completion',
  'Divergência': 'Discrepancy',
  'Rejeição': 'Rejection',

  // --- Configurações da empresa (Settings) -----------------------------------
  'Modo de Aprovação Obrigatória': 'Mandatory Approval Mode',
  'Exigir aprovação para POs antes do envio.': 'Require approval for POs before sending.',
  'Assinatura Digital Obrigatória': 'Mandatory Digital Signature',
  'Exigir assinatura digital em contratos e documentos.': 'Require a digital signature on contracts and documents.',
  'Histórico de Alterações': 'Change History',
  'Registar todas as alterações realizadas nos dados.': 'Record every change made to the data.',
  'Backup Automático': 'Automatic Backup',
  'Realizar backup automático dos dados diariamente.': 'Back up the data automatically every day.',
  'Lembretes de Prazos': 'Deadline Reminders',
  'Receber lembretes automáticos sobre vencimentos e prazos.': 'Receive automatic reminders about due dates and deadlines.',
  'Exibir Valores sem Impostos': 'Show Amounts Excluding Tax',
  'Mostrar valores sem impostos nas listagens e relatórios.': 'Show amounts excluding tax in listings and reports.',

  // --- Planos ----------------------------------------------------------------
  '/ utilizador / mês': '/ user / month',

  // --- Direitos do titular dos dados (Lei 22/11) ------------------------------
  'Os meus dados pessoais': 'My personal data',
  'Tem o direito de aceder aos dados que a KIXIMA guarda sobre si e de pedir a sua eliminação.':
    'You have the right to access the data KIXIMA holds about you and to request its deletion.',
  'Descarregar os meus dados': 'Download my data',
  'A preparar…': 'Preparing…',
  'Eliminar os meus dados': 'Delete my data',
  'Isto não tem volta.': 'This cannot be undone.',
  'O seu nome, email e foto são apagados e a conta é fechada. As ordens, faturas e pagamentos em que participou continuam a existir, mas deixam de o identificar — a lei fiscal obriga a conservá-los.':
    'Your name, email and photo are erased and the account is closed. The orders, invoices and payments you took part in still exist but no longer identify you — tax law requires them to be kept.',
  'Confirme a sua senha atual': 'Confirm your current password',
  'Eliminar definitivamente': 'Delete permanently',
  'Dados eliminados': 'Data deleted',
  'Os seus dados pessoais foram removidos e a conta foi fechada. O histórico de ordens e pagamentos foi preservado sem o identificar, por obrigação legal de conservação contabilística.':
    'Your personal data has been removed and the account closed. The history of orders and payments was preserved without identifying you, as accounting records must be kept by law.',

  // --- 2FA obrigatória --------------------------------------------------------
  'Ative a verificação em dois passos': 'Turn on two-step verification',
  'o seu perfil aprova operações com dinheiro, por isso a senha deixou de bastar.':
    'your role approves money operations, so a password is no longer enough.',
  'Ativar agora': 'Turn it on now',

  // --- Política de senhas -----------------------------------------------------
  'A nova senha deve ter pelo menos 10 caracteres.': 'The new password must be at least 10 characters long.',
  'Escolha a nova senha da sua conta KIXIMA (mínimo 10 caracteres; 12 se aprovar pagamentos).':
    'Choose the new password for your KIXIMA account (at least 10 characters; 12 if you approve payments).',
  // --- Prontidão para produção -----------------------------------------------
  // Inclui os títulos dos grupos e das verificações, que são escritos pelo
  // SERVIDOR — o auditor estático não os vê, por isso ficam aqui de propósito.
  'Prontidão para produção': 'Production readiness',
  'O que está mesmo configurado no servidor onde a plataforma está a correr. As definições vivem em variáveis de ambiente e uma que falte não dá erro — a aplicação arranca à mesma e parece estar tudo bem.':
    'What is actually configured on the server running the platform. Settings live in environment variables, and a missing one raises no error — the application still starts and looks fine.',
  'Verificações': 'Checks',
  'Prontas': 'Ready',
  'Nada a fazer': 'Nothing to do',
  'A merecer atenção': 'Needs attention',
  'Funciona, mas não é o ideal': 'Works, but not ideal',
  'Por fazer': 'Outstanding',
  'Antes de abrir a operadoras': 'Before opening to operators',
  'A verificar…': 'Checking…',
  'Fazer cópia agora': 'Back up now',
  'A copiar… (pode demorar)': 'Backing up… (may take a while)',
  'Cópia concluída': 'Backup complete',
  'Confirma de uma vez que o pg_dump existe, que a ligação direta serve, que as credenciais são aceites e que o bucket privado recebe o ficheiro — antes de confiar no agendamento.':
    'Confirms in one go that pg_dump exists, that the direct connection works, that the credentials are accepted and that the private bucket receives the file — before trusting the schedule.',
  'Base de dados': 'Database',
  'Armazenamento': 'Storage',
  'Cópias de segurança': 'Backups',
  'Autenticação de dois fatores': 'Two-factor authentication',
  'Segredos': 'Secrets',
  'Ligação da aplicação (DATABASE_URL)': 'Application connection (DATABASE_URL)',
  'Ligação direta (DIRECT_URL)': 'Direct connection (DIRECT_URL)',
  'Armazenamento de ficheiros': 'File storage',
  'Cópia de segurança automática': 'Automatic backup',
  'Bucket das cópias (STORAGE_BACKUP_BUCKET)': 'Backup bucket (STORAGE_BACKUP_BUCKET)',
  'Ferramenta de cópia (pg_dump)': 'Backup tool (pg_dump)',
  'Última cópia com sucesso': 'Last successful backup',
  'Envio de email': 'Email delivery',
  'Remetente (EMAIL_FROM)': 'Sender (EMAIL_FROM)',
  'Endereço público (APP_URL)': 'Public address (APP_URL)',
  '2FA obrigatória (MFA_ENFORCE_FROM)': 'Mandatory 2FA (MFA_ENFORCE_FROM)',
  'Contas com poder sem 2FA': 'Privileged accounts without 2FA',
  // --- 2FA: instruções de ativação -------------------------------------------
  // --- Verificação em dois passos (email + app) -------------------------------
  // --- Contas com poder sem 2FA ----------------------------------------------
  // --- Planos: Entrada · Core · Pro -------------------------------------------
  'Base': 'Base',
  'Tudo o que o plano Base inclui': 'Everything in the Base plan',
  'USD por mês': 'USD per month',
  '/ mês': '/ month',
  '/ trimestre': '/ quarter',
  '/ semestre': '/ half-year',
  '/ ano': '/ year',
  // --- Relatório de conteúdo local --------------------------------------------
  // --- API de catálogo ---------------------------------------------------------
  'API de catálogo': 'Catalogue API',
  'API de catálogo: sincronize preços e stock a partir do seu sistema':
    'Catalogue API: sync prices and stock from your own system',
  'Mantenha preços e stock sincronizados a partir do seu próprio sistema. Preço desatualizado num marketplace é o comprador a encomendar por um valor que já não existe.':
    'Keep prices and stock in sync from your own system. A stale price in a marketplace is a buyer ordering at a value that no longer exists.',
  'Nome da chave': 'Key name',
  'ex.: ERP da produção': 'e.g. Production ERP',
  'Criar chave': 'Create key',
  'A criar…': 'Creating…',
  'Dê um nome que diga onde a chave é usada — é por ele que vai saber qual revogar.':
    'Give it a name that says where the key is used — that is how you will know which one to revoke.',
  'Chave criada — copie-a agora': 'Key created — copy it now',
  'Copiar': 'Copy',
  'Chave copiada.': 'Key copied.',
  'Chave revogada.': 'Key revoked.',
  'Chave': 'Key',
  'Criada': 'Created',
  'Último uso': 'Last used',
  'nunca usada': 'never used',
  'Revogada': 'Revoked',
  'Revogar': 'Revoke',
  'Ainda não criou nenhuma chave.': 'You have not created any keys yet.',
  'Como usar': 'How to use it',
  'A chave só alcança o catálogo da sua empresa. Não dá acesso a ordens, pagamentos, faturas nem utilizadores.':
    'The key only reaches your company’s catalogue. It gives no access to orders, payments, invoices or users.',
  'Limite de 120 pedidos por minuto por chave. Cada alteração fica no trilho de auditoria com a chave identificada.':
    'Limit of 120 requests per minute per key. Every change is recorded in the audit trail with the key identified.',
  'Atingiu o máximo de 5 chaves ativas. Revogue uma antes de criar outra.':
    'You have reached the maximum of 5 active keys. Revoke one before creating another.',
  'Revogar a chave "{nome}"? Qualquer sistema que a use deixa de aceder ao catálogo de imediato.':
    'Revoke the key "{nome}"? Any system using it loses access to the catalogue immediately.',
  'Conteúdo local': 'Local content',
  'Relatório de conteúdo local': 'Local content report',
  'Quanto do que a sua empresa comprou foi para empresas angolanas, quanto corresponde a bens de origem angolana, e quanto foi para micro, pequenas e médias empresas nacionais.':
    'How much of what your company bought went to Angolan companies, how much corresponds to goods of Angolan origin, and how much went to Angolan micro, small and medium enterprises.',
  'De': 'From',
  'Até': 'To',
  'Gerar relatório': 'Generate report',
  'A calcular…': 'Calculating…',
  'Descarregar com o anexo': 'Download with the annex',
  'Este relatório ainda não se pode entregar.': 'This report cannot be submitted yet.',
  'Contratação nacional': 'National sourcing',
  'Bens de origem angolana': 'Goods of Angolan origin',
  'MPME angolanas': 'Angolan MSMEs',
  'Valor comprado': 'Total purchased',
  'Valores sem IVA, de ordens com compromisso financeiro assumido. Linhas sem país de origem declarado não contam como angolanas.':
    'Excluding VAT, from orders with a financial commitment in place. Lines with no declared country of origin do not count as Angolan.',
  'A fornecedores nacionais': 'To national suppliers',
  'Sem compras no período.': 'No purchases in this period.',
  'País': 'Country',
  'Dimensão': 'Size',
  'O ficheiro descarregado inclui o anexo com as': 'The downloaded file includes the annex with the',
  'ordens que compõem estes números, com referência, data, NIF e origem — é o que permite justificar cada percentagem linha a linha.':
    'orders behind these figures, with reference, date, tax ID and origin — that is what lets you justify each percentage line by line.',
  'Período:': 'Period:',
  'Escolha o período e gere o relatório.': 'Choose the period and generate the report.',
  'Relatório de conteúdo local: contratação nacional, origem dos bens e compras a MPME angolanas':
    'Local content report: national sourcing, origin of goods and purchases from Angolan MSMEs',
  'Destaque': 'Featured',
  'Core': 'Core',
  'para começar a vender': 'to start selling',
  'para quem já vende com regularidade': 'for those already selling regularly',
  'Micro e pequenas empresas a entrar na cadeia de fornecimento':
    'Micro and small companies entering the supply chain',
  'Pequenas e médias empresas com catálogo ativo': 'Small and medium companies with an active catalogue',
  'Catálogo sem limite de itens': 'Unlimited catalogue items',
  'Kits e pacotes de produtos': 'Kits and product bundles',
  'Carregamento de catálogo em massa por Excel': 'Bulk catalogue upload by Excel',
  'Utilizadores sem limite': 'Unlimited users',
  'Histórico de relatórios de 3 meses': '3 months of report history',
  'Histórico de relatórios de 12 meses': '12 months of report history',
  'Pedidos de cotação e histórico de relatórios sem limite':
    'Unlimited quote requests and report history',
  'Tudo o que o plano Core inclui': 'Everything in the Core plan',
  'Verificar a última cópia': 'Check the latest backup',
  'A ler a cópia…': 'Reading the backup…',
  'Lida e completa': 'Read back and complete',
  'blocos de dados': 'data blocks',
  'Vai buscá-la ao bucket, descomprime-a e confirma que traz a base toda. Um objeto truncado ou um gzip corrompido são indistinguíveis de uma cópia boa até alguém tentar lê-los.':
    'Fetches it from the bucket, decompresses it and confirms it holds the whole database. A truncated object or a corrupt gzip look exactly like a good backup until someone tries to read them.',
  'Pessoa': 'Person',
  'Último acesso': 'Last sign-in',
  'Último lembrete': 'Last reminder',
  'nunca entrou': 'never signed in',
  'há 1 dia': '1 day ago',
  'há {n} dias': '{n} days ago',
  'falta 1 dia': '1 day left',
  'faltam {n} dias': '{n} days left',
  'Pedir a todos que ativem': 'Ask everyone to turn it on',
  'Envia um email a cada pessoa com o prazo e o que acontece quando ele passar. Ninguém é lembrado duas vezes no mesmo dia.':
    'Emails each person the deadline and what happens once it passes. Nobody is reminded twice on the same day.',
  'enviado(s)': 'sent',
  'já avisado(s) hoje': 'already reminded today',
  'Depois disso, a sua conta só dá acesso a este ecrã de ativação.':
    'After that, your account will only reach this activation screen.',
  'o prazo terminou: a sua conta só dá acesso ao ecrã de ativação até isto ficar feito.':
    'the deadline has passed: your account only reaches the activation screen until this is done.',
  'Verificação em dois passos': 'Two-step verification',
  'Além da senha, entrar passa a pedir um código de 6 dígitos. Assim, quem descobrir a sua senha não entra na mesma. Recomendado sobretudo para perfis que aprovam e pagam.':
    'On top of your password, signing in will ask for a 6-digit code. That way, someone who finds out your password still cannot get in. Recommended above all for roles that approve and pay.',
  'O código será enviado para': 'The code will be sent to',
  'Ativar com código por email': 'Turn on with a code by email',
  'Prefiro usar uma app de autenticação': 'I would rather use an authenticator app',
  '— mais seguro, mas obriga a instalar uma aplicação no telemóvel.':
    '— more secure, but it means installing an app on your phone.',
  'Enviámos um código de 6 dígitos para': 'We sent a 6-digit code to',
  'É válido durante': 'It is valid for',
  'minutos. Confirme também a pasta de spam.': 'minutes. Check your spam folder too.',
  'Código recebido por email': 'Code received by email',
  'Enviar outro': 'Send another',
  'Confirme também a pasta de spam.': 'Check your spam folder too.',
  'Enviámos outro código.': 'We sent another code.',
  'Enviámos um código para': 'We sent a code to',
  'Enviar-me um código': 'Send me a code',
  'Para desativar, confirme um código atual': 'To turn it off, confirm a current code',
  'Desativar': 'Turn off',
  'por email': 'by email',
  'por app de autenticação': 'by authenticator app',
  'Verificação em dois passos ATIVADA. A partir de agora, ao entrar, enviamos-lhe um código por email.':
    'Two-step verification is ON. From now on, when you sign in, we will email you a code.',
  'Verificação em dois passos ATIVADA. A partir de agora o login pede também o código da app.':
    'Two-step verification is ON. From now on signing in will also ask for the code from the app.',
  'Verificação em dois passos desativada.': 'Two-step verification turned off.',
  'A KIXIMA não envia o código.': 'KIXIMA does not send the code.',
  'Não há SMS nem email: é uma app no seu telemóvel que o gera, sem ligação à internet, e muda a cada 30 segundos.':
    'There is no SMS or email: an app on your phone generates it, with no internet connection, and it changes every 30 seconds.',
  '1. Instale uma app de autenticação': '1. Install an authenticator app',
  '— Google Authenticator, Microsoft Authenticator ou Authy, gratuitas na Play Store e na App Store. Se já tiver uma, avance.':
    '— Google Authenticator, Microsoft Authenticator or Authy, free on the Play Store and App Store. If you already have one, skip ahead.',
  '2. Abra a app e digitalize o código QR': '2. Open the app and scan the QR code',
  '(ou use a chave manual). A app cria uma entrada KIXIMA e começa logo a mostrar um código de 6 dígitos.':
    '(or use the manual key). The app creates a KIXIMA entry and immediately starts showing a 6-digit code.',
  '3. Introduza o código de 6 dígitos que a app está a mostrar': '3. Enter the 6-digit code the app is showing',
  'Enviar email de teste para mim': 'Send a test email to me',
  'Enviado para': 'Sent to',
  'Confirme na caixa de entrada (e no spam).': 'Check your inbox (and spam folder).',
  'Um convite nunca deixa de ser criado por o email falhar — por isso uma chave errada ou um remetente por verificar não dão sinal nenhum. Aqui o erro aparece por inteiro.':
    'An invitation is never left uncreated just because email failed — which is why a wrong key or an unverified sender gives no sign at all. Here the error is shown in full.',
  'Chave de assinatura das sessões (JWT_SECRET)': 'Session signing key (JWT_SECRET)',
  // --- Prontidão: cobranças de subscrição -------------------------------------
  'Cobranças de subscrição': 'Subscription charges',
  'Dados bancários para as subscrições': 'Bank details for subscriptions',
  'KIXIMA_BANCO_IBAN não está definido.': 'KIXIMA_BANCO_IBAN is not set.',
};

export const FR9 = {
  // --- Cartes du profil ------------------------------------------------------
  'Este ano': 'Cette année',
  'Ordens de Compra': 'Bons de commande',
  'Ordens Recebidas': 'Commandes reçues',
  'Valor Total Comprado': 'Total acheté',
  'Valor Total Vendido': 'Total vendu',
  'Itens Recebidos': 'Articles reçus',
  'Itens Entregues': 'Articles livrés',
  'Fornecedores': 'Fournisseurs',
  'Clientes': 'Clients',
  'Com transações': 'Avec transactions',
  'Empresas': 'Entreprises',
  'Registadas': 'Enregistrées',
  'Ordens (plataforma)': 'Commandes (plateforme)',
  'Apólices': "Polices d'assurance",
  'Utilizadores': 'Utilisateurs',

  // --- Tâches et activités de l'acheteur -------------------------------------
  'Aprovar Ordem de Compra': 'Approuver le bon de commande',
  'Rever e aprovar a PO antes do envio ao fornecedor.': "Vérifier et approuver le BC avant l'envoi au fournisseur.",
  'Autorizar Pagamento': 'Autoriser le paiement',
  'Rever e autorizar o pagamento da fatura.': 'Vérifier et autoriser le paiement de la facture.',
  'Acompanhar Entrega': 'Suivi de livraison',
  'Verificar o estado da entrega em andamento.': "Vérifier l'état de la livraison en cours.",
  'Confirmar Recepção': 'Confirmer la réception',
  'Confirmar a recepção dos itens entregues.': 'Confirmer la réception des articles livrés.',
  'Resolver Divergência': "Résoudre l'écart",
  'Analisar divergência na recepção de itens.': "Analyser l'écart constaté à la réception des articles.",
  'Ordem concluída': 'Commande terminée',
  'Recepção confirmada com sucesso.': 'Réception confirmée avec succès.',

  // --- Catalogue de rapports et activités ------------------------------------
  'Relatório de Ordens de Compra': 'Rapport des bons de commande',
  'POs por estado e valor': 'BC par statut et par montant',
  'Relatório Financeiro': 'Rapport financier',
  'Resumo de faturas e pagamentos': 'Synthèse des factures et des paiements',
  'Relatório de Contratos': 'Rapport des contrats',
  'Estado e validade dos contratos': 'Statut et validité des contrats',
  'Atividade da Empresa': "Activité de l'entreprise",
  'Ações e acessos recentes': 'Actions et accès récents',
  'Acompanhamento': 'Suivi',
  'Aprovação': 'Approbation',
  'Atualização': 'Mise à jour',
  'Conclusão': 'Clôture',
  'Divergência': 'Écart',
  'Rejeição': 'Rejet',

  // --- Paramètres de l'entreprise --------------------------------------------
  'Modo de Aprovação Obrigatória': "Mode d'approbation obligatoire",
  'Exigir aprovação para POs antes do envio.': "Exiger l'approbation des BC avant l'envoi.",
  'Assinatura Digital Obrigatória': 'Signature numérique obligatoire',
  'Exigir assinatura digital em contratos e documentos.': 'Exiger une signature numérique sur les contrats et les documents.',
  'Histórico de Alterações': 'Historique des modifications',
  'Registar todas as alterações realizadas nos dados.': 'Enregistrer toutes les modifications apportées aux données.',
  'Backup Automático': 'Sauvegarde automatique',
  'Realizar backup automático dos dados diariamente.': 'Sauvegarder les données automatiquement chaque jour.',
  'Lembretes de Prazos': "Rappels d'échéances",
  'Receber lembretes automáticos sobre vencimentos e prazos.': 'Recevoir des rappels automatiques sur les échéances et les délais.',
  'Exibir Valores sem Impostos': 'Afficher les montants hors taxes',
  'Mostrar valores sem impostos nas listagens e relatórios.': 'Afficher les montants hors taxes dans les listes et les rapports.',

  // --- Formules --------------------------------------------------------------
  '/ utilizador / mês': '/ utilisateur / mois',

  // --- Droits de la personne concernée (Loi 22/11) ----------------------------
  'Os meus dados pessoais': 'Mes données personnelles',
  'Tem o direito de aceder aos dados que a KIXIMA guarda sobre si e de pedir a sua eliminação.':
    'Vous avez le droit d’accéder aux données que KIXIMA détient sur vous et d’en demander la suppression.',
  'Descarregar os meus dados': 'Télécharger mes données',
  'A preparar…': 'Préparation…',
  'Eliminar os meus dados': 'Supprimer mes données',
  'Isto não tem volta.': 'Cette action est irréversible.',
  'O seu nome, email e foto são apagados e a conta é fechada. As ordens, faturas e pagamentos em que participou continuam a existir, mas deixam de o identificar — a lei fiscal obriga a conservá-los.':
    'Votre nom, votre e-mail et votre photo sont effacés et le compte est fermé. Les bons de commande, factures et paiements auxquels vous avez participé subsistent mais ne vous identifient plus — la loi fiscale impose de les conserver.',
  'Confirme a sua senha atual': 'Confirmez votre mot de passe actuel',
  'Eliminar definitivamente': 'Supprimer définitivement',
  'Dados eliminados': 'Données supprimées',
  'Os seus dados pessoais foram removidos e a conta foi fechada. O histórico de ordens e pagamentos foi preservado sem o identificar, por obrigação legal de conservação contabilística.':
    'Vos données personnelles ont été supprimées et le compte fermé. L’historique des commandes et des paiements a été conservé sans vous identifier, en raison de l’obligation légale de conservation comptable.',

  // --- 2FA obligatoire --------------------------------------------------------
  'Ative a verificação em dois passos': 'Activez la vérification en deux étapes',
  'o seu perfil aprova operações com dinheiro, por isso a senha deixou de bastar.':
    "votre profil approuve des opérations financières : le mot de passe ne suffit plus.",
  'Ativar agora': 'Activer maintenant',

  // --- Politique de mots de passe ---------------------------------------------
  'A nova senha deve ter pelo menos 10 caracteres.': 'Le nouveau mot de passe doit comporter au moins 10 caractères.',
  'Escolha a nova senha da sua conta KIXIMA (mínimo 10 caracteres; 12 se aprovar pagamentos).':
    'Choisissez le nouveau mot de passe de votre compte KIXIMA (au moins 10 caractères ; 12 si vous approuvez des paiements).',
  // --- Préparation à la production -------------------------------------------
  'Prontidão para produção': 'Préparation à la production',
  'O que está mesmo configurado no servidor onde a plataforma está a correr. As definições vivem em variáveis de ambiente e uma que falte não dá erro — a aplicação arranca à mesma e parece estar tudo bem.':
    'Ce qui est réellement configuré sur le serveur qui exécute la plateforme. Les réglages vivent dans des variables d’environnement, et s’il en manque une, aucune erreur n’apparaît — l’application démarre quand même et semble aller bien.',
  'Verificações': 'Vérifications',
  'Prontas': 'Prêtes',
  'Nada a fazer': 'Rien à faire',
  'A merecer atenção': 'À surveiller',
  'Funciona, mas não é o ideal': 'Fonctionne, mais pas idéal',
  'Por fazer': 'À faire',
  'Antes de abrir a operadoras': 'Avant l’ouverture aux opérateurs',
  'A verificar…': 'Vérification…',
  'Fazer cópia agora': 'Sauvegarder maintenant',
  'A copiar… (pode demorar)': 'Sauvegarde en cours… (peut être long)',
  'Cópia concluída': 'Sauvegarde terminée',
  'Confirma de uma vez que o pg_dump existe, que a ligação direta serve, que as credenciais são aceites e que o bucket privado recebe o ficheiro — antes de confiar no agendamento.':
    'Confirme d’un coup que pg_dump existe, que la connexion directe fonctionne, que les identifiants sont acceptés et que le bucket privé reçoit le fichier — avant de faire confiance à la planification.',
  'Base de dados': 'Base de données',
  'Armazenamento': 'Stockage',
  'Cópias de segurança': 'Sauvegardes',
  'Autenticação de dois fatores': 'Authentification à deux facteurs',
  'Segredos': 'Secrets',
  'Ligação da aplicação (DATABASE_URL)': 'Connexion de l’application (DATABASE_URL)',
  'Ligação direta (DIRECT_URL)': 'Connexion directe (DIRECT_URL)',
  'Armazenamento de ficheiros': 'Stockage des fichiers',
  'Cópia de segurança automática': 'Sauvegarde automatique',
  'Bucket das cópias (STORAGE_BACKUP_BUCKET)': 'Bucket des sauvegardes (STORAGE_BACKUP_BUCKET)',
  'Ferramenta de cópia (pg_dump)': 'Outil de sauvegarde (pg_dump)',
  'Última cópia com sucesso': 'Dernière sauvegarde réussie',
  'Envio de email': 'Envoi d’e-mails',
  'Remetente (EMAIL_FROM)': 'Expéditeur (EMAIL_FROM)',
  'Endereço público (APP_URL)': 'Adresse publique (APP_URL)',
  '2FA obrigatória (MFA_ENFORCE_FROM)': '2FA obligatoire (MFA_ENFORCE_FROM)',
  'Contas com poder sem 2FA': 'Comptes à pouvoir sans 2FA',
  // --- 2FA : instructions d’activation ----------------------------------------
  // --- Vérification en deux étapes (e-mail + application) ---------------------
  // --- Comptes à pouvoir sans 2FA ---------------------------------------------
  // --- Forfaits : Entrada · Core · Pro ----------------------------------------
  'Base': 'Base',
  'Tudo o que o plano Base inclui': 'Tout ce que comprend le forfait Base',
  'USD por mês': 'USD par mois',
  '/ mês': '/ mois',
  '/ trimestre': '/ trimestre',
  '/ semestre': '/ semestre',
  '/ ano': '/ an',
  // --- Rapport de contenu local ------------------------------------------------
  // --- API de catalogue ---------------------------------------------------------
  'API de catálogo': 'API de catalogue',
  'API de catálogo: sincronize preços e stock a partir do seu sistema':
    'API de catalogue : synchronisez prix et stock depuis votre système',
  'Mantenha preços e stock sincronizados a partir do seu próprio sistema. Preço desatualizado num marketplace é o comprador a encomendar por um valor que já não existe.':
    'Gardez prix et stock synchronisés depuis votre propre système. Un prix obsolète sur une place de marché, c’est un acheteur qui commande à un montant qui n’existe plus.',
  'Nome da chave': 'Nom de la clé',
  'ex.: ERP da produção': 'ex. : ERP de production',
  'Criar chave': 'Créer une clé',
  'A criar…': 'Création…',
  'Dê um nome que diga onde a chave é usada — é por ele que vai saber qual revogar.':
    'Donnez-lui un nom qui indique où la clé est utilisée — c’est ainsi que vous saurez laquelle révoquer.',
  'Chave criada — copie-a agora': 'Clé créée — copiez-la maintenant',
  'Copiar': 'Copier',
  'Chave copiada.': 'Clé copiée.',
  'Chave revogada.': 'Clé révoquée.',
  'Chave': 'Clé',
  'Criada': 'Créée',
  'Último uso': 'Dernière utilisation',
  'nunca usada': 'jamais utilisée',
  'Revogada': 'Révoquée',
  'Revogar': 'Révoquer',
  'Ainda não criou nenhuma chave.': 'Vous n’avez encore créé aucune clé.',
  'Como usar': 'Comment l’utiliser',
  'A chave só alcança o catálogo da sua empresa. Não dá acesso a ordens, pagamentos, faturas nem utilizadores.':
    'La clé n’atteint que le catalogue de votre entreprise. Elle ne donne accès ni aux commandes, ni aux paiements, ni aux factures, ni aux utilisateurs.',
  'Limite de 120 pedidos por minuto por chave. Cada alteração fica no trilho de auditoria com a chave identificada.':
    'Limite de 120 requêtes par minute et par clé. Chaque modification est consignée dans la piste d’audit avec la clé identifiée.',
  'Atingiu o máximo de 5 chaves ativas. Revogue uma antes de criar outra.':
    'Vous avez atteint le maximum de 5 clés actives. Révoquez-en une avant d’en créer une autre.',
  'Revogar a chave "{nome}"? Qualquer sistema que a use deixa de aceder ao catálogo de imediato.':
    'Révoquer la clé « {nome} » ? Tout système qui l’utilise perd immédiatement l’accès au catalogue.',
  'Conteúdo local': 'Contenu local',
  'Relatório de conteúdo local': 'Rapport de contenu local',
  'Quanto do que a sua empresa comprou foi para empresas angolanas, quanto corresponde a bens de origem angolana, e quanto foi para micro, pequenas e médias empresas nacionais.':
    'Quelle part de vos achats est allée à des entreprises angolaises, quelle part correspond à des biens d’origine angolaise, et quelle part est allée aux micro, petites et moyennes entreprises angolaises.',
  'De': 'Du',
  'Até': 'Au',
  'Gerar relatório': 'Générer le rapport',
  'A calcular…': 'Calcul en cours…',
  'Descarregar com o anexo': 'Télécharger avec l’annexe',
  'Este relatório ainda não se pode entregar.': 'Ce rapport ne peut pas encore être remis.',
  'Contratação nacional': 'Achats nationaux',
  'Bens de origem angolana': 'Biens d’origine angolaise',
  'MPME angolanas': 'PME angolaises',
  'Valor comprado': 'Montant acheté',
  'Valores sem IVA, de ordens com compromisso financeiro assumido. Linhas sem país de origem declarado não contam como angolanas.':
    'Hors TVA, pour les commandes ayant un engagement financier. Les lignes sans pays d’origine déclaré ne comptent pas comme angolaises.',
  'A fornecedores nacionais': 'À des fournisseurs nationaux',
  'Sem compras no período.': 'Aucun achat sur la période.',
  'País': 'Pays',
  'Dimensão': 'Taille',
  'O ficheiro descarregado inclui o anexo com as': 'Le fichier téléchargé inclut l’annexe avec les',
  'ordens que compõem estes números, com referência, data, NIF e origem — é o que permite justificar cada percentagem linha a linha.':
    'commandes à l’origine de ces chiffres, avec référence, date, NIF et origine — c’est ce qui permet de justifier chaque pourcentage ligne par ligne.',
  'Período:': 'Période :',
  'Escolha o período e gere o relatório.': 'Choisissez la période et générez le rapport.',
  'Relatório de conteúdo local: contratação nacional, origem dos bens e compras a MPME angolanas':
    'Rapport de contenu local : achats nationaux, origine des biens et achats auprès de PME angolaises',
  'Destaque': 'En vedette',
  'Core': 'Core',
  'para começar a vender': 'pour commencer à vendre',
  'para quem já vende com regularidade': 'pour ceux qui vendent déjà régulièrement',
  'Micro e pequenas empresas a entrar na cadeia de fornecimento':
    'Micro et petites entreprises entrant dans la chaîne d’approvisionnement',
  'Pequenas e médias empresas com catálogo ativo': 'Petites et moyennes entreprises avec un catalogue actif',
  'Catálogo sem limite de itens': 'Catalogue sans limite d’articles',
  'Kits e pacotes de produtos': 'Kits et lots de produits',
  'Carregamento de catálogo em massa por Excel': 'Import de catalogue en masse par Excel',
  'Utilizadores sem limite': 'Utilisateurs illimités',
  'Histórico de relatórios de 3 meses': '3 mois d’historique de rapports',
  'Histórico de relatórios de 12 meses': '12 mois d’historique de rapports',
  'Pedidos de cotação e histórico de relatórios sem limite':
    'Demandes de devis et historique de rapports illimités',
  'Tudo o que o plano Core inclui': 'Tout ce que comprend le forfait Core',
  'Verificar a última cópia': 'Vérifier la dernière sauvegarde',
  'A ler a cópia…': 'Lecture de la sauvegarde…',
  'Lida e completa': 'Relue et complète',
  'blocos de dados': 'blocs de données',
  'Vai buscá-la ao bucket, descomprime-a e confirma que traz a base toda. Um objeto truncado ou um gzip corrompido são indistinguíveis de uma cópia boa até alguém tentar lê-los.':
    'La récupère depuis le bucket, la décompresse et confirme qu’elle contient toute la base. Un objet tronqué ou un gzip corrompu ressemblent en tout point à une bonne sauvegarde jusqu’à ce qu’on essaie de les lire.',
  'Pessoa': 'Personne',
  'Último acesso': 'Dernière connexion',
  'Último lembrete': 'Dernier rappel',
  'nunca entrou': 'jamais connecté',
  'há 1 dia': 'il y a 1 jour',
  'há {n} dias': 'il y a {n} jours',
  'falta 1 dia': 'il reste 1 jour',
  'faltam {n} dias': 'il reste {n} jours',
  'Pedir a todos que ativem': 'Demander à tous de l’activer',
  'Envia um email a cada pessoa com o prazo e o que acontece quando ele passar. Ninguém é lembrado duas vezes no mesmo dia.':
    'Envoie à chacun un e-mail avec l’échéance et ce qui se passera une fois passée. Personne n’est relancé deux fois le même jour.',
  'enviado(s)': 'envoyé(s)',
  'já avisado(s) hoje': 'déjà relancé(s) aujourd’hui',
  'Depois disso, a sua conta só dá acesso a este ecrã de ativação.':
    'Ensuite, votre compte n’accédera qu’à cet écran d’activation.',
  'o prazo terminou: a sua conta só dá acesso ao ecrã de ativação até isto ficar feito.':
    'le délai est écoulé : votre compte n’accède qu’à l’écran d’activation tant que ce n’est pas fait.',
  'Verificação em dois passos': 'Vérification en deux étapes',
  'Além da senha, entrar passa a pedir um código de 6 dígitos. Assim, quem descobrir a sua senha não entra na mesma. Recomendado sobretudo para perfis que aprovam e pagam.':
    'En plus du mot de passe, la connexion demandera un code à 6 chiffres. Ainsi, qui découvre votre mot de passe n’entre pas pour autant. Recommandé surtout pour les profils qui approuvent et paient.',
  'O código será enviado para': 'Le code sera envoyé à',
  'Ativar com código por email': 'Activer avec un code par e-mail',
  'Prefiro usar uma app de autenticação': 'Je préfère utiliser une application d’authentification',
  '— mais seguro, mas obriga a instalar uma aplicação no telemóvel.':
    '— plus sûr, mais il faut installer une application sur le téléphone.',
  'Enviámos um código de 6 dígitos para': 'Nous avons envoyé un code à 6 chiffres à',
  'É válido durante': 'Il est valable',
  'minutos. Confirme também a pasta de spam.': 'minutes. Vérifiez aussi les indésirables.',
  'Código recebido por email': 'Code reçu par e-mail',
  'Enviar outro': 'En envoyer un autre',
  'Confirme também a pasta de spam.': 'Vérifiez aussi les indésirables.',
  'Enviámos outro código.': 'Nous avons envoyé un autre code.',
  'Enviámos um código para': 'Nous avons envoyé un code à',
  'Enviar-me um código': 'M’envoyer un code',
  'Para desativar, confirme um código atual': 'Pour désactiver, confirmez un code actuel',
  'Desativar': 'Désactiver',
  'por email': 'par e-mail',
  'por app de autenticação': 'par application d’authentification',
  'Verificação em dois passos ATIVADA. A partir de agora, ao entrar, enviamos-lhe um código por email.':
    'Vérification en deux étapes ACTIVÉE. Désormais, à la connexion, nous vous enverrons un code par e-mail.',
  'Verificação em dois passos ATIVADA. A partir de agora o login pede também o código da app.':
    'Vérification en deux étapes ACTIVÉE. Désormais la connexion demandera aussi le code de l’application.',
  'Verificação em dois passos desativada.': 'Vérification en deux étapes désactivée.',
  'A KIXIMA não envia o código.': 'KIXIMA n’envoie pas le code.',
  'Não há SMS nem email: é uma app no seu telemóvel que o gera, sem ligação à internet, e muda a cada 30 segundos.':
    'Ni SMS ni e-mail : c’est une application sur votre téléphone qui le génère, sans connexion Internet, et il change toutes les 30 secondes.',
  '1. Instale uma app de autenticação': '1. Installez une application d’authentification',
  '— Google Authenticator, Microsoft Authenticator ou Authy, gratuitas na Play Store e na App Store. Se já tiver uma, avance.':
    '— Google Authenticator, Microsoft Authenticator ou Authy, gratuites sur le Play Store et l’App Store. Si vous en avez déjà une, passez à la suite.',
  '2. Abra a app e digitalize o código QR': '2. Ouvrez l’application et scannez le code QR',
  '(ou use a chave manual). A app cria uma entrada KIXIMA e começa logo a mostrar um código de 6 dígitos.':
    '(ou utilisez la clé manuelle). L’application crée une entrée KIXIMA et affiche aussitôt un code à 6 chiffres.',
  '3. Introduza o código de 6 dígitos que a app está a mostrar': '3. Saisissez le code à 6 chiffres affiché par l’application',
  'Enviar email de teste para mim': 'M’envoyer un e-mail de test',
  'Enviado para': 'Envoyé à',
  'Confirme na caixa de entrada (e no spam).': 'Vérifiez votre boîte de réception (et les indésirables).',
  'Um convite nunca deixa de ser criado por o email falhar — por isso uma chave errada ou um remetente por verificar não dão sinal nenhum. Aqui o erro aparece por inteiro.':
    'Une invitation n’est jamais laissée de côté parce que l’e-mail a échoué — c’est pourquoi une clé erronée ou un expéditeur non vérifié ne donnent aucun signe. Ici, l’erreur est affichée en entier.',
  'Chave de assinatura das sessões (JWT_SECRET)': 'Clé de signature des sessions (JWT_SECRET)',
  // --- Prontidão : facturations d’abonnement ----------------------------------
  'Cobranças de subscrição': 'Facturations d’abonnement',
  'Dados bancários para as subscrições': 'Coordonnées bancaires pour les abonnements',
  'KIXIMA_BANCO_IBAN não está definido.': 'KIXIMA_BANCO_IBAN n’est pas défini.',
};
