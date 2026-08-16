// src/i18n/content9.js
// Subscrição: pedir plano, pagar por transferência, confirmar.
//
// Quase todas estas frases têm marcadores de interpolação ({ref}, {valor},
// {n}). Até agora a auditoria estática tratava qualquer texto com chavetas como
// fragmento de JSX e SALTAVA-O — uma frase interpolada nova entrava em produção
// por traduzir e o relatório continuava a dizer "0 em falta". A regra foi
// corrigida em scripts/i18n-audit.mjs; este ficheiro é o primeiro a nascer já
// sob ela.
//
// As frases são COMPLETAS de propósito, nunca partidas em pedaços à volta de um
// número: a ordem das palavras muda entre idiomas, e "faltam" + n + "dias"
// montado no ecrã só funciona em português.

export const EN10 = {
  // --- Vocabulário base -------------------------------------------------------
  'Subscrição': 'Subscription',
  'Subscrições vencidas': 'Overdue subscriptions',
  'Cobranças': 'Charges',
  'Cobranças de subscrição': 'Subscription charges',
  'Histórico de cobranças': 'Charge history',
  'Plano atual': 'Current plan',
  'Mudar de plano': 'Change plan',
  'Atual': 'Current',
  'Lugares': 'Seats',
  'Mudança': 'Change',
  'Confirmar': 'Confirm',
  'Confirmada em': 'Confirmed on',
  'Enviado em': 'Submitted on',
  'Dias em atraso': 'Days overdue',
  'Por confirmar': 'Awaiting confirmation',
  'Por pagar': 'Unpaid',
  'Abrir': 'Open',
  'Como pagar:': 'How to pay:',
  'Cancelar cobrança': 'Cancel charge',
  'Quer continuar?': 'Do you want to continue?',
  'Sem cobrança registada': 'No charge on record',
  'sem limite': 'unlimited',

  // --- Estados da cobrança ----------------------------------------------------
  'Aguarda confirmação da KIXIMA': 'Awaiting KIXIMA confirmation',

  // --- Funcionalidades listadas nos cartões de plano ---------------------------
  'Cotações sem limite': 'Unlimited quotations',
  'Histórico de relatórios sem limite': 'Unlimited report history',
  'Carregamento de catálogo em massa': 'Bulk catalogue upload',
  'Integração com ERPs': 'ERP integration',
  'Contratos-quadro': 'Framework contracts',
  '{n} utilizadores': '{n} users',
  '{n} cotações por mês': '{n} quotations per month',
  '{n} imagens e {d} documentos por item': '{n} images and {d} documents per item',
  'Histórico de relatórios de {n} meses': '{n} months of report history',
  '{usados} de {total}': '{usados} of {total}',
  '{usados} ocupados, sem limite': '{usados} in use, unlimited',
  '{n} imagens e 1 documento por item': '{n} images and 1 document per item',
  'equivale a {v} USD por mês': 'equivalent to {v} USD per month',

  // --- Página da empresa ------------------------------------------------------
  'O plano da sua empresa, o que cada plano inclui e como se paga. O pagamento é por transferência bancária com comprovativo — o plano muda quando a KIXIMA confirma a entrada do valor.':
    'Your company plan, what each plan includes and how it is paid. Payment is by bank transfer with proof — the plan changes when KIXIMA confirms the funds have arrived.',
  'Cobrança {ref}': 'Charge {ref}',
  'Cobrança {ref} emitida. Faça a transferência e carregue o comprovativo aqui.':
    'Charge {ref} issued. Make the transfer and upload the proof here.',
  'Plano {plano} — {valor} {periodo}': 'Plan {plano} — {valor} {periodo}',
  'Este valor está fixado nesta cobrança e não muda, mesmo que a tabela de preços mude.':
    'This amount is fixed on this charge and does not change, even if the price list does.',
  'transfira o valor indicando a referência {ref} e carregue aqui o comprovativo (PDF ou imagem).':
    'transfer the amount quoting reference {ref} and upload the proof here (PDF or image).',
  'Indique a referência {ref} na descrição da transferência — é assim que a KIXIMA a associa à sua empresa.':
    'Quote reference {ref} in the transfer description — that is how KIXIMA matches it to your company.',
  'Os dados bancários da KIXIMA ainda não estão publicados na plataforma. Contacte o suporte para os obter antes de transferir.':
    'KIXIMA’s bank details are not yet published on the platform. Contact support to obtain them before transferring.',
  'Titular': 'Account holder',
  'Banco': 'Bank',
  'Moeda': 'Currency',
  'Comprovativo enviado em {data}. O plano fica ativo assim que a KIXIMA confirmar a entrada do valor.':
    'Proof submitted on {data}. The plan becomes active as soon as KIXIMA confirms the funds have arrived.',
  'Comprovativo recebido. A KIXIMA confirma a entrada do valor e o plano fica ativo.':
    'Proof received. KIXIMA will confirm the funds have arrived and the plan will become active.',
  'A subscrição venceu em {data}. O acesso mantém-se — a KIXIMA vai contactá-lo para regularizar.':
    'The subscription expired on {data}. Access continues — KIXIMA will contact you to settle it.',
  'Faltam {n} dias para a subscrição terminar. Renove para não interromper o serviço.':
    'The subscription ends in {n} days. Renew to avoid an interruption in service.',
  'Descer para o plano {plano} faz perder:': 'Moving down to plan {plano} means losing:',
  'Ao descer perde: {lista}.': 'Moving down loses: {lista}.',
  'Conclua ou cancele a cobrança em aberto para pedir outro plano.':
    'Complete or cancel the open charge before requesting another plan.',
  'Porque está a cancelar esta cobrança?': 'Why are you cancelling this charge?',
  'Ainda não há cobranças.': 'No charges yet.',
  'Subir para este plano': 'Move up to this plan',
  'Descer para este plano': 'Move down to this plan',
  'Renovar este plano': 'Renew this plan',

  // --- Página do Admin do Sistema ---------------------------------------------
  'O plano de uma empresa só muda quando a entrada do valor é confirmada aqui. Confirme apenas o que já viu na conta bancária.':
    'A company’s plan only changes when the incoming funds are confirmed here. Confirm only what you have seen in the bank account.',
  'Confirma que o valor de {valor} referente a {ref} ({empresa}) entrou na conta da KIXIMA?':
    'Do you confirm that {valor} for {ref} ({empresa}) has arrived in KIXIMA’s account?',
  'Nota interna (opcional) — ex.: data e banco da entrada.':
    'Internal note (optional) — e.g. date and bank of the incoming payment.',
  '{ref} confirmada. A empresa {empresa} está agora no plano {plano}.':
    '{ref} confirmed. {empresa} is now on plan {plano}.',
  'Porque está a cancelar {ref}?': 'Why are you cancelling {ref}?',
  'Nada por confirmar.': 'Nothing awaiting confirmation.',
  'Nenhuma cobrança por liquidar.': 'No outstanding charges.',
  'Nenhuma subscrição vencida.': 'No overdue subscriptions.',
  'Estas empresas mantêm o acesso — a plataforma não corta o plano sozinha. Contacte-as para regularizar ou emita uma nova cobrança.':
    'These companies keep their access — the platform does not cut a plan on its own. Contact them to settle it or issue a new charge.',

  // --- Apanhadas pela auditoria corrigida (já existiam, sem tradução) ----------
  '{valor} USD emitidos na submissão': '{valor} USD invoiced on submission',
  '{valor} USD/mês': '{valor} USD/month',
  // --- Mensagens do SERVIDOR que chegam à interface -----------------------------
  // Só as de texto FIXO. As que o servidor compõe com valores (referência,
  // valor, número de lugares) não podem ser chave de dicionário — a chave só
  // existe depois de já estar montada. É uma limitação conhecida do modelo de
  // tradução desta plataforma, e vale para todos os serviços, não só este.
  'Anexe o comprovativo da transferência (PDF ou imagem) para submeter o pagamento.':
    'Attach the transfer proof (PDF or image) to submit the payment.',
  'A empresa tem de estar aprovada para subscrever um plano.':
    'The company must be approved before subscribing to a plan.',
  'Só pode pagar cobranças da sua própria empresa.':
    'You can only pay charges belonging to your own company.',
  'Só pode cancelar cobranças da sua própria empresa.':
    'You can only cancel charges belonging to your own company.',
  'Indique o motivo do cancelamento.': 'State the reason for the cancellation.',
  'Saltar para o conteúdo': 'Skip to content',
  // --- Nomes de controlos sem rótulo visível ----------------------------------
  // Filtros e interruptores que a interface identifica pela posição ou pelo
  // ícone. Para quem usa leitor de ecrã não há posição nenhuma — há uma lista
  // de "combobox" sem nome.
  'Dimensão da empresa': 'Company size',
  'Estado do pedido de suporte': 'Support request status',
  'Filtrar por estado': 'Filter by status',
  'Filtrar por tipo': 'Filter by type',
  // --- Caminhos para a subscrição ---------------------------------------------
  // O muro de plano é o momento em que alguém quer mudar de plano. Era o único
  // sítio da plataforma sem botão.
  'Ver planos e subscrever': 'View plans and subscribe',
  'Ver a subscrição': 'View the subscription',
  'Só o administrador da empresa pode mudar de plano — fale com ele.':
    'Only the company administrator can change the plan — talk to them.',
  'Só o administrador da empresa escolhe o plano. Pode carregar o comprovativo de uma cobrança já emitida.':
    'Only the company administrator chooses the plan. You can upload the proof for a charge already issued.',
  'Subscrever este plano': 'Subscribe to this plan',
  'Começar com o plano {plano}': 'Get started on the {plano} plan',
  // --- Chaves usadas via t(VARIÁVEL), invisíveis à auditoria estática ----------
  // A auditoria procura t('literal'). Estas passam por t(PERIODOS[x]) e por
  // t(p.label), com o valor a vir de um objeto ou do servidor — nenhuma delas
  // aparece no relatório. Ficam agrupadas aqui para não se perderem.
  'por mês': 'per month',
  'por trimestre': 'per quarter',
  'por semestre': 'per half-year',
  'por ano': 'per year',
  'chaves de API do catálogo ativas': 'active catalogue API keys',
  'kits publicados': 'published kits',
  'as chaves deixam de autenticar e qualquer integração que as use pára':
    'the keys stop authenticating and any integration using them halts',
  'os kits deixam de estar visíveis no marketplace': 'the kits stop being visible in the marketplace',
  'não poderá criar novos contratos-quadro': 'you will not be able to create new framework contracts',

  // --- Impedimentos: o servidor manda o código e os números --------------------
  'Empresas de dimensão {dimensao} têm de subscrever o plano {minimo}.':
    'Companies of size {dimensao} must subscribe to plan {minimo}.',
  'O plano {plano} inclui {lugares} lugares e a empresa tem {ocupados} (utilizadores ativos mais convites por aceitar). Desative os utilizadores em excesso antes de descer de plano.':
    'Plan {plano} includes {lugares} seats and the company has {ocupados} (active users plus pending invitations). Deactivate the extra users before moving down a plan.',

  // --- Janela de histórico dos relatórios (limite do plano, à vista) -----------
  'Receita, ordens e mais vendidos cobrem os últimos {n} meses — o histórico incluído no seu plano.':
    'Revenue, orders and best sellers cover the last {n} months — the history included in your plan.',
  'Produtos, estoque e visualizações mostram sempre o estado atual.':
    'Products, stock and views always show the current state.',

  // --- Estados vazios com saída, e menu do fornecedor (KX-09, KX-15) ---------
  'Ainda não criou nenhuma chave. Crie a primeira no formulário acima para o seu sistema começar a enviar preços e stock.':
    'You have not created a key yet. Create the first one in the form above so your system can start sending prices and stock.',
  'Ainda não recebeu pedidos de cotação': 'You have not received any quote requests yet',
  'Ainda não respondeu a cotações': 'You have not answered any quotes yet',
  'As cotações que responder ficam guardadas aqui, com o histórico de preços e prazos que ofereceu.':
    'The quotes you answer are kept here, with the history of prices and lead times you offered.',
  'Os pedidos chegam de compradores que encontram os seus produtos. Um catálogo mais completo — com fichas técnicas e certificados — aparece em mais pesquisas.':
    'Requests come from buyers who find your products. A fuller catalogue — with datasheets and certificates — shows up in more searches.',
  'Taxas por transação e acesso por utilizador, com os limites de cada plano':
    'Per-transaction fees and per-user access, with each plan\u2019s limits',
  'Ver o meu catálogo': 'View my catalogue',
  'Ver solicitações por responder': 'View requests awaiting reply',
  'A mostrar os {n} movimentos mais recentes de {total} no total.':
    'Showing the {n} most recent movements out of {total} in total.',

  // --- FASE 1: dashboards acionáveis, estados vazios, migalhas ---------------
  'Caminho': 'Breadcrumb',
  'Ir para o catálogo': 'Go to catalogue',
  'Peça uma cotação quando quiser preço e prazo antes de emitir uma ordem.':
    'Request a quote whenever you want price and lead time before issuing an order.',
  'Nada por confirmar. As cobranças aparecem aqui quando uma empresa carrega o comprovativo da transferência.':
    'Nothing to confirm. Charges appear here when a company uploads the transfer proof.',
  'Nenhuma cobrança por liquidar. Aparecem aqui as que foram emitidas e ainda não foram pagas.':
    'No outstanding charges. Those issued and not yet paid appear here.',
  'Nenhuma subscrição vencida. A plataforma não corta planos sozinha — as que passarem do prazo aparecem aqui para serem contactadas.':
    'No overdue subscriptions. The platform does not cut plans on its own — those past due appear here to be contacted.',
};

export const FR10 = {
  'Subscrição': 'Abonnement',
  'Subscrições vencidas': 'Abonnements échus',
  'Cobranças': 'Facturations',
  'Cobranças de subscrição': 'Facturations d’abonnement',
  'Histórico de cobranças': 'Historique des facturations',
  'Plano atual': 'Forfait actuel',
  'Mudar de plano': 'Changer de forfait',
  'Atual': 'Actuel',
  'Lugares': 'Sièges',
  'Mudança': 'Changement',
  'Confirmar': 'Confirmer',
  'Confirmada em': 'Confirmée le',
  'Enviado em': 'Envoyé le',
  'Dias em atraso': 'Jours de retard',
  'Por confirmar': 'En attente de confirmation',
  'Por pagar': 'Impayé',
  'Abrir': 'Ouvrir',
  'Como pagar:': 'Comment payer :',
  'Cancelar cobrança': 'Annuler la facturation',
  'Quer continuar?': 'Voulez-vous continuer ?',
  'Sem cobrança registada': 'Aucune facturation enregistrée',
  'sem limite': 'sans limite',

  'Aguarda confirmação da KIXIMA': 'En attente de confirmation par KIXIMA',

  'Cotações sem limite': 'Demandes de prix sans limite',
  'Histórico de relatórios sem limite': 'Historique des rapports sans limite',
  'Carregamento de catálogo em massa': 'Import de catalogue en masse',
  'Integração com ERPs': 'Intégration aux ERP',
  'Contratos-quadro': 'Contrats-cadres',
  '{n} utilizadores': '{n} utilisateurs',
  '{n} cotações por mês': '{n} demandes de prix par mois',
  '{n} imagens e {d} documentos por item': '{n} images et {d} documents par article',
  'Histórico de relatórios de {n} meses': 'Historique des rapports sur {n} mois',
  '{usados} de {total}': '{usados} sur {total}',
  '{usados} ocupados, sem limite': '{usados} occupés, sans limite',
  '{n} imagens e 1 documento por item': '{n} images et 1 document par article',
  'equivale a {v} USD por mês': 'équivaut à {v} USD par mois',

  'O plano da sua empresa, o que cada plano inclui e como se paga. O pagamento é por transferência bancária com comprovativo — o plano muda quando a KIXIMA confirma a entrada do valor.':
    'Le forfait de votre entreprise, ce que chaque forfait comprend et comment il se paie. Le paiement se fait par virement bancaire avec justificatif — le forfait change lorsque KIXIMA confirme la réception des fonds.',
  'Cobrança {ref}': 'Facturation {ref}',
  'Cobrança {ref} emitida. Faça a transferência e carregue o comprovativo aqui.':
    'Facturation {ref} émise. Effectuez le virement et téléversez le justificatif ici.',
  'Plano {plano} — {valor} {periodo}': 'Forfait {plano} — {valor} {periodo}',
  'Este valor está fixado nesta cobrança e não muda, mesmo que a tabela de preços mude.':
    'Ce montant est figé sur cette facturation et ne change pas, même si la grille tarifaire évolue.',
  'transfira o valor indicando a referência {ref} e carregue aqui o comprovativo (PDF ou imagem).':
    'effectuez le virement en indiquant la référence {ref} et téléversez ici le justificatif (PDF ou image).',
  'Indique a referência {ref} na descrição da transferência — é assim que a KIXIMA a associa à sua empresa.':
    'Indiquez la référence {ref} dans le libellé du virement — c’est ainsi que KIXIMA la rattache à votre entreprise.',
  'Os dados bancários da KIXIMA ainda não estão publicados na plataforma. Contacte o suporte para os obter antes de transferir.':
    'Les coordonnées bancaires de KIXIMA ne sont pas encore publiées sur la plateforme. Contactez le support pour les obtenir avant de virer.',
  'Titular': 'Titulaire',
  'Banco': 'Banque',
  'Moeda': 'Devise',
  'Comprovativo enviado em {data}. O plano fica ativo assim que a KIXIMA confirmar a entrada do valor.':
    'Justificatif envoyé le {data}. Le forfait sera actif dès que KIXIMA aura confirmé la réception des fonds.',
  'Comprovativo recebido. A KIXIMA confirma a entrada do valor e o plano fica ativo.':
    'Justificatif reçu. KIXIMA confirmera la réception des fonds et le forfait deviendra actif.',
  'A subscrição venceu em {data}. O acesso mantém-se — a KIXIMA vai contactá-lo para regularizar.':
    'L’abonnement a expiré le {data}. L’accès est maintenu — KIXIMA vous contactera pour régulariser.',
  'Faltam {n} dias para a subscrição terminar. Renove para não interromper o serviço.':
    'L’abonnement se termine dans {n} jours. Renouvelez pour éviter une interruption de service.',
  'Descer para o plano {plano} faz perder:': 'Passer au forfait {plano} fait perdre :',
  'Ao descer perde: {lista}.': 'En descendant, vous perdez : {lista}.',
  'Conclua ou cancele a cobrança em aberto para pedir outro plano.':
    'Terminez ou annulez la facturation en cours avant de demander un autre forfait.',
  'Porque está a cancelar esta cobrança?': 'Pourquoi annulez-vous cette facturation ?',
  'Ainda não há cobranças.': 'Aucune facturation pour l’instant.',
  'Subir para este plano': 'Passer à ce forfait supérieur',
  'Descer para este plano': 'Passer à ce forfait inférieur',
  'Renovar este plano': 'Renouveler ce forfait',

  'O plano de uma empresa só muda quando a entrada do valor é confirmada aqui. Confirme apenas o que já viu na conta bancária.':
    'Le forfait d’une entreprise ne change que lorsque la réception des fonds est confirmée ici. Ne confirmez que ce que vous avez vu sur le compte bancaire.',
  'Confirma que o valor de {valor} referente a {ref} ({empresa}) entrou na conta da KIXIMA?':
    'Confirmez-vous que le montant de {valor} correspondant à {ref} ({empresa}) est bien arrivé sur le compte de KIXIMA ?',
  'Nota interna (opcional) — ex.: data e banco da entrada.':
    'Note interne (facultative) — p. ex. date et banque de l’encaissement.',
  '{ref} confirmada. A empresa {empresa} está agora no plano {plano}.':
    '{ref} confirmée. L’entreprise {empresa} est désormais sur le forfait {plano}.',
  'Porque está a cancelar {ref}?': 'Pourquoi annulez-vous {ref} ?',
  'Nada por confirmar.': 'Rien à confirmer.',
  'Nenhuma cobrança por liquidar.': 'Aucune facturation impayée.',
  'Nenhuma subscrição vencida.': 'Aucun abonnement échu.',
  'Estas empresas mantêm o acesso — a plataforma não corta o plano sozinha. Contacte-as para regularizar ou emita uma nova cobrança.':
    'Ces entreprises conservent leur accès — la plateforme ne coupe pas un forfait d’elle-même. Contactez-les pour régulariser ou émettez une nouvelle facturation.',

  '{valor} USD emitidos na submissão': '{valor} USD facturés à la soumission',
  '{valor} USD/mês': '{valor} USD/mois',
  // --- Mensagens do SERVIDOR que chegam à interface -----------------------------
  'Anexe o comprovativo da transferência (PDF ou imagem) para submeter o pagamento.':
    'Joignez le justificatif du virement (PDF ou image) pour soumettre le paiement.',
  'A empresa tem de estar aprovada para subscrever um plano.':
    'L’entreprise doit être approuvée avant de souscrire un forfait.',
  'Só pode pagar cobranças da sua própria empresa.':
    'Vous ne pouvez payer que les facturations de votre propre entreprise.',
  'Só pode cancelar cobranças da sua própria empresa.':
    'Vous ne pouvez annuler que les facturations de votre propre entreprise.',
  'Indique o motivo do cancelamento.': 'Indiquez le motif de l’annulation.',
  'Saltar para o conteúdo': 'Aller au contenu',
  // --- Nomes de controlos sem rótulo visível ----------------------------------
  'Dimensão da empresa': 'Taille de l’entreprise',
  'Estado do pedido de suporte': 'Statut de la demande d’assistance',
  'Filtrar por estado': 'Filtrer par statut',
  'Filtrar por tipo': 'Filtrer par type',
  // --- Caminhos para a subscrição ---------------------------------------------
  'Ver planos e subscrever': 'Voir les forfaits et souscrire',
  'Ver a subscrição': 'Voir l’abonnement',
  'Só o administrador da empresa pode mudar de plano — fale com ele.':
    'Seul l’administrateur de l’entreprise peut changer de forfait — adressez-vous à lui.',
  'Só o administrador da empresa escolhe o plano. Pode carregar o comprovativo de uma cobrança já emitida.':
    'Seul l’administrateur de l’entreprise choisit le forfait. Vous pouvez téléverser le justificatif d’une facturation déjà émise.',
  'Subscrever este plano': 'Souscrire ce forfait',
  'Começar com o plano {plano}': 'Commencer avec le forfait {plano}',
  // --- Chaves usadas via t(VARIÁVEL), invisíveis à auditoria estática ----------
  'por mês': 'par mois',
  'por trimestre': 'par trimestre',
  'por semestre': 'par semestre',
  'por ano': 'par an',
  'chaves de API do catálogo ativas': 'clés d’API catalogue actives',
  'kits publicados': 'kits publiés',
  'as chaves deixam de autenticar e qualquer integração que as use pára':
    'les clés cessent d’authentifier et toute intégration qui les utilise s’arrête',
  'os kits deixam de estar visíveis no marketplace': 'les kits cessent d’être visibles sur la place de marché',
  'não poderá criar novos contratos-quadro': 'vous ne pourrez plus créer de nouveaux contrats-cadres',

  // --- Impedimentos -----------------------------------------------------------
  'Empresas de dimensão {dimensao} têm de subscrever o plano {minimo}.':
    'Les entreprises de taille {dimensao} doivent souscrire le forfait {minimo}.',
  'O plano {plano} inclui {lugares} lugares e a empresa tem {ocupados} (utilizadores ativos mais convites por aceitar). Desative os utilizadores em excesso antes de descer de plano.':
    'Le forfait {plano} comprend {lugares} sièges et l’entreprise en a {ocupados} (utilisateurs actifs plus invitations en attente). Désactivez les utilisateurs en trop avant de passer à un forfait inférieur.',

  // --- Fenêtre d’historique des rapports (limite du forfait, visible) ----------
  'Receita, ordens e mais vendidos cobrem os últimos {n} meses — o histórico incluído no seu plano.':
    'Le chiffre d’affaires, les commandes et les meilleures ventes couvrent les {n} derniers mois — l’historique inclus dans votre forfait.',
  'Produtos, estoque e visualizações mostram sempre o estado atual.':
    'Les produits, le stock et les vues affichent toujours l’état actuel.',

  // --- États vides avec issue, et menu du fournisseur (KX-09, KX-15) ---------
  'Ainda não criou nenhuma chave. Crie a primeira no formulário acima para o seu sistema começar a enviar preços e stock.':
    'Vous n\u2019avez pas encore créé de clé. Créez la première dans le formulaire ci-dessus pour que votre système commence à envoyer prix et stock.',
  'Ainda não recebeu pedidos de cotação': 'Vous n\u2019avez encore reçu aucune demande de devis',
  'Ainda não respondeu a cotações': 'Vous n\u2019avez encore répondu à aucun devis',
  'As cotações que responder ficam guardadas aqui, com o histórico de preços e prazos que ofereceu.':
    'Les devis auxquels vous répondez sont conservés ici, avec l\u2019historique des prix et des délais proposés.',
  'Os pedidos chegam de compradores que encontram os seus produtos. Um catálogo mais completo — com fichas técnicas e certificados — aparece em mais pesquisas.':
    'Les demandes viennent d\u2019acheteurs qui trouvent vos produits. Un catalogue plus complet — avec fiches techniques et certificats — apparaît dans plus de recherches.',
  'Taxas por transação e acesso por utilizador, com os limites de cada plano':
    'Frais par transaction et accès par utilisateur, avec les limites de chaque forfait',
  'Ver o meu catálogo': 'Voir mon catalogue',
  'Ver solicitações por responder': 'Voir les demandes en attente de réponse',
  'A mostrar os {n} movimentos mais recentes de {total} no total.':
    'Affichage des {n} mouvements les plus récents sur {total} au total.',

  // --- PHASE 1 : tableaux de bord actionnables, états vides, fil d\u2019Ariane ---
  'Caminho': 'Fil d\u2019Ariane',
  'Ir para o catálogo': 'Aller au catalogue',
  'Peça uma cotação quando quiser preço e prazo antes de emitir uma ordem.':
    'Demandez un devis lorsque vous voulez prix et délai avant d\u2019émettre une commande.',
  'Nada por confirmar. As cobranças aparecem aqui quando uma empresa carrega o comprovativo da transferência.':
    'Rien à confirmer. Les facturations apparaissent ici lorsqu\u2019une entreprise téléverse la preuve de virement.',
  'Nenhuma cobrança por liquidar. Aparecem aqui as que foram emitidas e ainda não foram pagas.':
    'Aucune facturation en attente. Celles émises et non encore payées apparaissent ici.',
  'Nenhuma subscrição vencida. A plataforma não corta planos sozinha — as que passarem do prazo aparecem aqui para serem contactadas.':
    'Aucun abonnement échu. La plateforme ne coupe pas les forfaits d\u2019elle-même — ceux en retard apparaissent ici pour être contactés.',
};
