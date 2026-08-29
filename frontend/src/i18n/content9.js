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
  'Em período de tolerância': 'In grace period',
  'Restritas': 'Restricted',
  'Restritas (recursos premium bloqueados)': 'Restricted (premium features blocked)',
  'Já venceram, mas ainda dentro do período de tolerância — acesso total mantido, nada bloqueado. Contacte-as para regularizar ou emita uma nova cobrança.':
    'Already overdue, but still within the grace period — full access kept, nothing blocked. Contact them to settle it or issue a new charge.',
  'Nenhuma empresa em período de tolerância neste momento.': 'No company is in a grace period right now.',
  'Passaram o período de tolerância: recursos premium (novos utilizadores, kits, API, ERP, contratos-quadro) já bloqueados. Os dados e o histórico continuam intactos.':
    'Past the grace period: premium features (new users, kits, API, ERP, framework contracts) are already blocked. Data and history remain intact.',
  'Nenhuma empresa restrita neste momento.': 'No company is restricted right now.',
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
  'A subscrição da sua empresa vence em {n} dias. Renove para continuar a utilizar todos os recursos do plano {plano}.':
    'Your company subscription expires in {n} days. Renew to keep using all of the {plano} plan\'s features.',
  'A subscrição da sua empresa expirou. Os seus dados continuam seguros. Envie o comprovativo de pagamento para renovar o acesso aos recursos pagos.':
    'Your company subscription has expired. Your data remains safe. Send the payment proof to restore access to paid features.',
  'A subscrição da sua empresa está vencida. Os seus dados continuam seguros, mas alguns recursos pagos (novos utilizadores, integrações, funcionalidades premium) estão bloqueados até regularizar.':
    'Your company subscription is overdue. Your data remains safe, but some paid features (new users, integrations, premium capabilities) are blocked until it\'s settled.',
  'Renovar plano': 'Renew plan',
  'Renovar agora': 'Renew now',
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

  // --- FASE 3: confirmações e rótulo de perfil ------------------------------
  'Plano da empresa atualizado.': 'Company plan updated.',
  'Taxa marcada como cobrada.': 'Fee marked as charged.',
  'Pedido atualizado.': 'Request updated.',
  'Administrador da Empresa': 'Company Admin',

  // --- Chat de Suporte / Chat Comercial / Alertas de Segurança --------------
  'A abrir…': 'Opening…',
  'Ainda não há mensagens — comece a conversa.': 'No messages yet — start the conversation.',
  'Alerta já reclassificado': 'Alert already reclassified',
  'Alertas de Segurança': 'Security Alerts',
  'Anexar ficheiro': 'Attach file',
  'Anexo': 'Attachment',
  'Aprovadas': 'Approved',
  'Assumir': 'Take',
  'Avaliação de {nome} ({empresa}) aprovada — já é visível na homepage.': 'Review by {nome} ({empresa}) approved — now visible on the homepage.',
  'Chat': 'Chat',
  'Chat Comercial': 'Business Chat',
  'Chat de Suporte': 'Support Chat',
  'Conversa': 'Conversation',
  'Conversas do Chat Comercial com indícios de negociação ou pagamento fora da plataforma.': 'Business Chat conversations with signs of negotiation or payment outside the platform.',
  'Converse diretamente com compradores e fornecedores sobre produtos, cotações e pedidos.': 'Chat directly with buyers and suppliers about products, quotes and orders.',
  'Converse em tempo real com a equipa de Suporte.': 'Chat in real time with the Support team.',
  'Enviar': 'Send',
  'Escolha um alerta para analisar a conversa sinalizada.': 'Choose an alert to review the flagged conversation.',
  'Escolha um pedido para atender.': 'Choose a request to handle.',
  'Escolha um pedido para ver a conversa.': 'Choose a request to see the conversation.',
  'Escolha uma conversa para ver as mensagens.': 'Choose a conversation to see the messages.',
  'Escreva uma mensagem…': 'Write a message…',
  'Falar com o fornecedor': 'Talk to the supplier',
  'Falso positivo': 'False positive',
  'Fila': 'Queue',
  'Fila de pedidos e atendimentos em curso.': 'Queue of requests and ongoing conversations.',
  'Iniciar Conversa': 'Start Conversation',
  'Marcar como resolvido': 'Mark as resolved',
  'Marcar como Resolvido': 'Mark as Resolved',
  'Mensagens': 'Messages',
  'Motivo': 'Reason',
  'Nada por aqui.': 'Nothing here.',
  'Nenhum alerta neste estado.': 'No alerts in this state.',
  'Nenhuma avaliação neste estado.': 'No reviews in this state.',
  'Nota da análise (opcional)…': 'Review note (optional)…',
  'Novo Pedido': 'New Request',
  "O que é submetido no formulário da homepage ('Avaliações Verificadas') fica aqui até ser revisto. Só o que aprovar aparece publicamente.": "What is submitted through the homepage form ('Verified Reviews') stays here until reviewed. Only what you approve appears publicly.",
  'Os meus atendimentos': 'My assigned requests',
  'Os meus pedidos': 'My requests',
  'Para garantir segurança, rastreabilidade e proteção das partes, recomendamos manter a negociação e o pagamento dentro do Kixima.': 'To ensure security, traceability and protection for both parties, we recommend keeping the negotiation and payment within Kixima.',
  'Por rever': 'Pending review',
  'Reabrir': 'Reopen',
  'Remover a avaliação de {nome} ({empresa})? Não fica registo — se aprovada, também sai da homepage.': 'Remove the review by {nome} ({empresa})? There is no record kept — if approved, it also leaves the homepage.',
  'Sem acesso a Suporte — fale com quem lhe deu acesso ao sistema.': 'No access to Support — talk to whoever gave you access to the system.',
  'Sem conversas ainda — inicie uma a partir de um produto ou de um pedido.': 'No conversations yet — start one from a product or an order.',
  'Sinais': 'Signals',
  'Submetida em': 'Submitted on',
  'Suporte — Chat': 'Support — Chat',
  'Transferir': 'Transfer',
  'Transferir para…': 'Transfer to…',
  '— nada disponível ainda —': '— nothing available yet —',
  'Ainda não enviou nenhuma avaliação.': 'You have not submitted any reviews yet.',
  'Ainda não há avaliações públicas. Seja o primeiro a partilhar a sua experiência — inicie sessão e vá a Suporte → Feedback.': 'No public reviews yet. Be the first to share your experience — sign in and go to Support → Feedback.',
  'Ainda não há histórico real nesta categoria para a sua empresa.': 'There is no real history in this category for your company yet.',
  'As minhas avaliações': 'My reviews',
  'Atendimento': 'Support interaction',
  'Avaliação de uma conta e empresa reais da KIXIMA': 'Review from a real KIXIMA account and company',
  'Avalie a sua experiência com um fornecedor, produto, serviço, pedido, entrega, pagamento ou atendimento — ou deixe uma experiência geral. Cada avaliação é revista antes de ser publicada na homepage.': 'Rate your experience with a supplier, product, service, order, delivery, payment or support interaction — or leave a general experience. Every review is checked before it is published on the homepage.',
  'Compradores e fornecedores autenticados avaliam a experiência na KIXIMA. Cada avaliação é revista antes de ser publicada e a média mostrada conta sempre todas as aprovadas.': 'Authenticated buyers and suppliers rate their experience on KIXIMA. Every review is checked before publication, and the average shown always counts every approved review.',
  'Entrega': 'Delivery',
  'Escolha a que se refere esta avaliação.': 'Choose what this review refers to.',
  'Experiência geral': 'General experience',
  'Feedback': 'Feedback',
  'Fornecedor / Empresa': 'Supplier / Company',
  'O que é submetido em Suporte → Feedback por utilizadores autenticados fica aqui até ser revisto. Só o que aprovar aparece na homepage (\'Avaliações Verificadas\').': 'What is submitted via Support → Feedback by authenticated users stays here until reviewed. Only what you approve appears on the homepage (\'Verified Reviews\').',
  'Pedido': 'Order',
  'Qual': 'Which one',
  'Sobre o que é': 'What it\'s about',
  'Suporte — Feedback': 'Support — Feedback',
  '{canal} — a aguardar': '{canal} — awaiting confirmation',
  'Canal': 'Channel',
  'Número de telemóvel para pedir o pagamento:': 'Phone number to request the payment:',
  'o plano ativa-se automaticamente assim que o pagamento for confirmado — sem esperar pela KIXIMA.': 'the plan activates automatically as soon as the payment is confirmed — no need to wait for KIXIMA.',
  'Pagar agora:': 'Pay now:',
  'Pagar com {canal}': 'Pay with {canal}',
  'Pedido de pagamento enviado para {canal}. Confirme no telemóvel/aplicação — o plano ativa-se automaticamente assim que o pagamento for confirmado.': 'Payment request sent to {canal}. Confirm on your phone/app — the plan activates automatically as soon as the payment is confirmed.',
  'Transferência': 'Bank transfer',
};

export const FR10 = {
  'Subscrição': 'Abonnement',
  'Subscrições vencidas': 'Abonnements échus',
  'Em período de tolerância': 'En période de tolérance',
  'Restritas': 'Restreintes',
  'Restritas (recursos premium bloqueados)': 'Restreintes (fonctionnalités premium bloquées)',
  'Já venceram, mas ainda dentro do período de tolerância — acesso total mantido, nada bloqueado. Contacte-as para regularizar ou emita uma nova cobrança.':
    'Déjà échus, mais encore dans la période de tolérance — accès complet maintenu, rien n’est bloqué. Contactez-les pour régulariser ou émettez une nouvelle facturation.',
  'Nenhuma empresa em período de tolerância neste momento.': 'Aucune entreprise en période de tolérance pour le moment.',
  'Passaram o período de tolerância: recursos premium (novos utilizadores, kits, API, ERP, contratos-quadro) já bloqueados. Os dados e o histórico continuam intactos.':
    'Ont dépassé la période de tolérance : les fonctionnalités premium (nouveaux utilisateurs, kits, API, ERP, contrats-cadres) sont déjà bloquées. Les données et l’historique restent intacts.',
  'Nenhuma empresa restrita neste momento.': 'Aucune entreprise restreinte pour le moment.',
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
  'A subscrição da sua empresa vence em {n} dias. Renove para continuar a utilizar todos os recursos do plano {plano}.':
    'L’abonnement de votre entreprise expire dans {n} jours. Renouvelez pour continuer à profiter de toutes les fonctionnalités du forfait {plano}.',
  'A subscrição da sua empresa expirou. Os seus dados continuam seguros. Envie o comprovativo de pagamento para renovar o acesso aos recursos pagos.':
    'L’abonnement de votre entreprise a expiré. Vos données restent en sécurité. Envoyez le justificatif de paiement pour retrouver l’accès aux fonctionnalités payantes.',
  'A subscrição da sua empresa está vencida. Os seus dados continuam seguros, mas alguns recursos pagos (novos utilizadores, integrações, funcionalidades premium) estão bloqueados até regularizar.':
    'L’abonnement de votre entreprise est en retard. Vos données restent en sécurité, mais certaines fonctionnalités payantes (nouveaux utilisateurs, intégrations, fonctionnalités premium) sont bloquées jusqu’à régularisation.',
  'Renovar plano': 'Renouveler le forfait',
  'Renovar agora': 'Renouveler maintenant',
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

  // --- PHASE 3 : confirmations et libellé de profil --------------------------
  'Plano da empresa atualizado.': 'Forfait de l\u2019entreprise mis à jour.',
  'Taxa marcada como cobrada.': 'Frais marqués comme facturés.',
  'Pedido atualizado.': 'Demande mise à jour.',
  'Administrador da Empresa': 'Admin entreprise',

  // --- Chat de Suporte / Chat Comercial / Alertas de Seguranca --------------
  'A abrir…': 'Ouverture…',
  'Ainda não há mensagens — comece a conversa.': 'Aucun message pour l’instant — commencez la conversation.',
  'Alerta já reclassificado': 'Alerte déjà reclassée',
  'Alertas de Segurança': 'Alertes de sécurité',
  'Anexar ficheiro': 'Joindre un fichier',
  'Anexo': 'Pièce jointe',
  'Aprovadas': 'Approuvées',
  'Assumir': 'Prendre en charge',
  'Avaliação de {nome} ({empresa}) aprovada — já é visível na homepage.': 'Avis de {nome} ({empresa}) approuvé — désormais visible sur la page d’accueil.',
  'Chat': 'Chat',
  'Chat Comercial': 'Chat commercial',
  'Chat de Suporte': 'Chat de support',
  'Conversa': 'Conversation',
  'Conversas do Chat Comercial com indícios de negociação ou pagamento fora da plataforma.': 'Conversations du Chat commercial présentant des indices de négociation ou de paiement hors plateforme.',
  'Converse diretamente com compradores e fornecedores sobre produtos, cotações e pedidos.': 'Échangez directement avec les acheteurs et fournisseurs à propos de produits, devis et commandes.',
  'Converse em tempo real com a equipa de Suporte.': 'Discutez en temps réel avec l’équipe de Support.',
  'Enviar': 'Envoyer',
  'Escolha um alerta para analisar a conversa sinalizada.': 'Choisissez une alerte pour examiner la conversation signalée.',
  'Escolha um pedido para atender.': 'Choisissez une demande à traiter.',
  'Escolha um pedido para ver a conversa.': 'Choisissez une demande pour voir la conversation.',
  'Escolha uma conversa para ver as mensagens.': 'Choisissez une conversation pour voir les messages.',
  'Escreva uma mensagem…': 'Écrivez un message…',
  'Falar com o fornecedor': 'Parler au fournisseur',
  'Falso positivo': 'Faux positif',
  'Fila': 'File d’attente',
  'Fila de pedidos e atendimentos em curso.': 'File d’attente des demandes et prises en charge en cours.',
  'Iniciar Conversa': 'Démarrer la conversation',
  'Marcar como resolvido': 'Marquer comme résolu',
  'Marcar como Resolvido': 'Marquer comme résolu',
  'Mensagens': 'Messages',
  'Motivo': 'Motif',
  'Nada por aqui.': 'Rien ici.',
  'Nenhum alerta neste estado.': 'Aucune alerte dans cet état.',
  'Nenhuma avaliação neste estado.': 'Aucun avis dans cet état.',
  'Nota da análise (opcional)…': 'Note d’analyse (facultatif)…',
  'Novo Pedido': 'Nouvelle demande',
  "O que é submetido no formulário da homepage ('Avaliações Verificadas') fica aqui até ser revisto. Só o que aprovar aparece publicamente.": "Ce qui est soumis via le formulaire de la page d'accueil (« Avis vérifiés ») reste ici jusqu'à révision. Seul ce que vous approuvez apparaît publiquement.",
  'Os meus atendimentos': 'Mes prises en charge',
  'Os meus pedidos': 'Mes demandes',
  'Para garantir segurança, rastreabilidade e proteção das partes, recomendamos manter a negociação e o pagamento dentro do Kixima.': 'Pour garantir sécurité, traçabilité et protection des parties, nous recommandons de garder la négociation et le paiement au sein de Kixima.',
  'Por rever': 'À examiner',
  'Reabrir': 'Rouvrir',
  'Remover a avaliação de {nome} ({empresa})? Não fica registo — se aprovada, também sai da homepage.': 'Supprimer l’avis de {nome} ({empresa}) ? Aucune trace ne sera conservée — s’il est approuvé, il disparaît aussi de la page d’accueil.',
  'Sem acesso a Suporte — fale com quem lhe deu acesso ao sistema.': 'Aucun accès au Support — contactez la personne qui vous a donné accès au système.',
  'Sem conversas ainda — inicie uma a partir de um produto ou de um pedido.': 'Aucune conversation pour l’instant — démarrez-en une depuis un produit ou une commande.',
  'Sinais': 'Signaux',
  'Submetida em': 'Soumis le',
  'Suporte — Chat': 'Support — Chat',
  'Transferir': 'Transférer',
  'Transferir para…': 'Transférer à…',
  '— nada disponível ainda —': '— rien de disponible pour l\'instant —',
  'Ainda não enviou nenhuma avaliação.': 'Vous n\'avez encore soumis aucun avis.',
  'Ainda não há avaliações públicas. Seja o primeiro a partilhar a sua experiência — inicie sessão e vá a Suporte → Feedback.': 'Aucun avis public pour l\'instant. Soyez le premier à partager votre expérience — connectez-vous et allez dans Support → Feedback.',
  'Ainda não há histórico real nesta categoria para a sua empresa.': 'Il n\'y a pas encore d\'historique réel dans cette catégorie pour votre entreprise.',
  'As minhas avaliações': 'Mes avis',
  'Atendimento': 'Interaction avec le support',
  'Avaliação de uma conta e empresa reais da KIXIMA': 'Avis provenant d\'un compte et d\'une entreprise KIXIMA réels',
  'Avalie a sua experiência com um fornecedor, produto, serviço, pedido, entrega, pagamento ou atendimento — ou deixe uma experiência geral. Cada avaliação é revista antes de ser publicada na homepage.': 'Évaluez votre expérience avec un fournisseur, un produit, un service, une commande, une livraison, un paiement ou une interaction avec le support — ou laissez une expérience générale. Chaque avis est vérifié avant d\'être publié sur la page d\'accueil.',
  'Compradores e fornecedores autenticados avaliam a experiência na KIXIMA. Cada avaliação é revista antes de ser publicada e a média mostrada conta sempre todas as aprovadas.': 'Les acheteurs et fournisseurs authentifiés évaluent leur expérience sur KIXIMA. Chaque avis est vérifié avant publication, et la moyenne affichée compte toujours tous les avis approuvés.',
  'Entrega': 'Livraison',
  'Escolha a que se refere esta avaliação.': 'Choisissez à quoi se rapporte cet avis.',
  'Experiência geral': 'Expérience générale',
  'Feedback': 'Avis',
  'Fornecedor / Empresa': 'Fournisseur / Entreprise',
  'O que é submetido em Suporte → Feedback por utilizadores autenticados fica aqui até ser revisto. Só o que aprovar aparece na homepage (\'Avaliações Verificadas\').': 'Ce qui est soumis via Support → Avis par des utilisateurs authentifiés reste ici jusqu\'à révision. Seul ce que vous approuvez apparaît sur la page d\'accueil (« Avis vérifiés »).',
  'Pedido': 'Commande',
  'Qual': 'Lequel',
  'Sobre o que é': 'Sur quoi porte l\'avis',
  'Suporte — Feedback': 'Support — Avis',
  '{canal} — a aguardar': '{canal} — en attente de confirmation',
  'Canal': 'Canal',
  'Número de telemóvel para pedir o pagamento:': 'Numéro de téléphone pour demander le paiement :',
  'o plano ativa-se automaticamente assim que o pagamento for confirmado — sem esperar pela KIXIMA.': 'le plan s\'active automatiquement dès que le paiement est confirmé — sans attendre KIXIMA.',
  'Pagar agora:': 'Payer maintenant :',
  'Pagar com {canal}': 'Payer avec {canal}',
  'Pedido de pagamento enviado para {canal}. Confirme no telemóvel/aplicação — o plano ativa-se automaticamente assim que o pagamento for confirmado.': 'Demande de paiement envoyée à {canal}. Confirmez sur votre téléphone/application — le plan s\'active automatiquement dès que le paiement est confirmé.',
  'Transferência': 'Virement bancaire',
};
