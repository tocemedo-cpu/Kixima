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

  // --- 2FA obrigatória --------------------------------------------------------
  'Ative a verificação em dois passos': 'Turn on two-step verification',
  'o seu perfil aprova operações com dinheiro, por isso a senha deixou de bastar.':
    'your role approves money operations, so a password is no longer enough.',
  'Ativar agora': 'Turn it on now',

  // --- Política de senhas -----------------------------------------------------
  'A nova senha deve ter pelo menos 10 caracteres.': 'The new password must be at least 10 characters long.',
  'Escolha a nova senha da sua conta KIXIMA (mínimo 10 caracteres; 12 se aprovar pagamentos).':
    'Choose the new password for your KIXIMA account (at least 10 characters; 12 if you approve payments).',
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

  // --- 2FA obligatoire --------------------------------------------------------
  'Ative a verificação em dois passos': 'Activez la vérification en deux étapes',
  'o seu perfil aprova operações com dinheiro, por isso a senha deixou de bastar.':
    "votre profil approuve des opérations financières : le mot de passe ne suffit plus.",
  'Ativar agora': 'Activer maintenant',

  // --- Politique de mots de passe ---------------------------------------------
  'A nova senha deve ter pelo menos 10 caracteres.': 'Le nouveau mot de passe doit comporter au moins 10 caractères.',
  'Escolha a nova senha da sua conta KIXIMA (mínimo 10 caracteres; 12 se aprovar pagamentos).':
    'Choisissez le nouveau mot de passe de votre compte KIXIMA (au moins 10 caractères ; 12 si vous approuvez des paiements).',
};
