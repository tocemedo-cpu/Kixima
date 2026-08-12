// src/i18n/content7.js
// Modelo comercial: planos (Básico/Pro), taxas por transação e Supplier Development.
// Cobre as páginas de planos e preços, a gestão de subscrições e o programa de
// apoio ao fornecedor nacional (emancipação burocrática + parceiros internacionais).
// Os marcadores {perPo}, {perInvoice}, {limiar}, {pct} e {n} são substituídos em
// tempo de execução e mantêm-se iguais nos três idiomas. Nomes próprios (KIXIMA,
// ERP, SAP, AS400, Ariba, Maximo, Oracle) e a moeda USD não se traduzem.
// Números: EN usa 11,500 USD / 0.20%; FR usa 11 500 USD / 0,20 %.

export const EN8 = {
  // --- Planos e preços --------------------------------------------------------
  'Planos e preços': 'Plans and pricing',
  'Planos e Subscrições': 'Plans and Subscriptions',
  'Planos KIXIMA': 'KIXIMA plans',
  'Ver planos': 'View plans',
  'Plano': 'Plan',
  'Básico': 'Basic',
  'Básico e Pro — taxas por transação e acesso por utilizador':
    'Basic and Pro — transaction fees and per-user access',
  'Preços simples, ligados ao negócio real': 'Simple pricing, tied to real business',
  'Paga-se pelo que se transaciona e pelo acesso de cada utilizador. Sem custos escondidos.':
    'You pay for what you transact and for each user’s access. No hidden costs.',
  'Acesso mensal': 'Monthly access',
  'Custo mensal': 'Monthly cost',
  'Preço/utilizador': 'Price/user',
  'Com integração ERP': 'With ERP integration',
  'No plano PRO': 'On the PRO plan',
  'Exigem PRO': 'Require PRO',
  'obrigatório para grandes empresas': 'mandatory for large companies',
  'Grandes empresas': 'Large companies',
  'Registar a minha empresa': 'Register my company',

  // --- Taxa KIXIMA por transação ---------------------------------------------
  'Taxa por transação (Taxa KIXIMA)': 'Transaction fee (KIXIMA Fee)',
  'Cobrada ao fornecedor em cada pagamento processado, à parte da ordem de compra e da fatura.':
    'Charged to the supplier on each payment processed, separately from the purchase order and the invoice.',
  'Taxas da plataforma geradas em cada pagamento, à parte da fatura. 8 USD por PO até 11.500 USD por transação (0,20% acima) + 15 USD por fatura — cobradas ao fornecedor.':
    'Platform fees generated on each payment, separately from the invoice. 8 USD per PO up to 11,500 USD per transaction (0.20% above that) + 15 USD per invoice — charged to the supplier.',
  'por ordem de compra, até 11.500 USD por transação':
    'per purchase order, up to 11,500 USD per transaction',
  'por fatura emitida': 'per invoice issued',
  'do valor da transação, acima de 11.500 USD (substitui os 8 USD)':
    'of the transaction value, above 11,500 USD (replaces the 8 USD)',
  '(nº de POs × {perPo}) + {perInvoice} por fatura · acima de {limiar}: {pct} do valor':
    '(no. of POs × {perPo}) + {perInvoice} per invoice · above {limiar}: {pct} of the value',
  'Total faturável/mês': 'Total billable/month',
  'Total recebido': 'Total received',

  // --- Dimensão da empresa (critério MPME) ------------------------------------
  'Dimensão': 'Size',
  'Trabalhadores': 'Employees',
  'Nº de trabalhadores': 'No. of employees',
  'Volume de negócios anual (USD)': 'Annual turnover (USD)',
  'A dimensão da empresa segue o critério das micro, pequenas e médias empresas e é confirmada pela KIXIMA no credenciamento.':
    'Company size follows the micro, small and medium-sized enterprise criteria and is confirmed by KIXIMA during accreditation.',
  'Dimensão da empresa (critério MPME), plano contratado e taxa de acesso por utilizador. Empresas de grande dimensão têm de subscrever o plano PRO.':
    'Company size (MSME criteria), subscribed plan and per-user access fee. Large companies must subscribe to the PRO plan.',
  'Serve para classificar a dimensão da empresa e o plano aplicável. Empresas de grande dimensão subscrevem o plano PRO.':
    'Used to classify company size and the applicable plan. Large companies subscribe to the PRO plan.',
  'Credenciadas': 'Accredited',

  // --- Supplier Development ---------------------------------------------------
  'Supplier Development': 'Supplier Development',
  'Programa KIXIMA': 'KIXIMA Programme',
  'Emancipação burocrática': 'Regulatory onboarding',
  'Parcerias internacionais': 'International partnerships',
  'Apoio burocrático e parceiros internacionais para empresas angolanas':
    'Regulatory support and international partners for Angolan companies',
  'Apoiamos o fornecedor angolano em todo o processo de emancipação burocrática e procuramos parceiros internacionais para empresas locais — mais tecnologia, mais capacidade e mais participação nacional no setor Oil & Gas.':
    'We support Angolan suppliers throughout the regulatory onboarding process and seek international partners for local companies — more technology, more capacity and greater national participation in the Oil & Gas sector.',
  'Candidaturas ao programa de apoio ao fornecedor nacional: emancipação burocrática e procura de parceiros internacionais.':
    'Applications to the national supplier support programme: regulatory onboarding and the search for international partners.',
  'Percurso': 'Track',
  'Tipo de apoio': 'Type of support',

  // --- Formulário de candidatura ---------------------------------------------
  'Candidatar-se ao programa': 'Apply to the programme',
  'Nova candidatura': 'New application',
  'Submeter candidatura': 'Submit application',
  'Candidatura recebida': 'Application received',
  'Não é preciso ter conta na KIXIMA. Preencha e a nossa equipa entra em contacto.':
    'No KIXIMA account is required. Fill in the form and our team will get in touch.',
  'Nome do contacto': 'Contact name',
  'Área de atividade': 'Field of activity',
  'Província': 'Province',
  'O que precisa do programa?': 'What do you need from the programme?',
  'O que precisa': 'What they need',
  'Ex.: Metalomecânica, Logística, Inspeção': 'E.g.: Metalworking, Logistics, Inspection',
  'Ex.: apoio no licenciamento e um parceiro para soldadura certificada.':
    'E.g.: support with licensing and a partner for certified welding.',
  'A sua candidatura ficou registada com a referência':
    'Your application has been registered under reference',
  'A equipa KIXIMA entra em contacto pelo email indicado. Guarde a referência para acompanhar o estado.':
    'The KIXIMA team will get in touch using the email provided. Keep the reference to follow up on its status.',

  // --- Gestão de candidaturas -------------------------------------------------
  'Candidaturas': 'Applications',
  'Ainda não há candidaturas ao programa.': 'There are no applications to the programme yet.',
  'Aguardam triagem': 'Awaiting screening',
  'Por analisar': 'To review',
  'Em análise': 'Under review',
  'Em acompanhamento': 'In follow-up',
  'Casos ativos': 'Active cases',
  'Processos fechados': 'Closed cases',
  'Rejeitadas': 'Rejected',
  'Marcar em análise': 'Mark as under review',
  'Concluir': 'Complete',
  'Ver / Acompanhar': 'View / Follow up',
  'Notas de acompanhamento (internas)': 'Follow-up notes (internal)',
  'Pesquisar por empresa ou NIF…': 'Search by company or tax ID…',
  'Pesquisar por empresa, referência ou email…': 'Search by company, reference or email…',
};

export const FR8 = {
  // --- Plans et tarifs --------------------------------------------------------
  'Planos e preços': 'Plans et tarifs',
  'Planos e Subscrições': 'Plans et abonnements',
  'Planos KIXIMA': 'Plans KIXIMA',
  'Ver planos': 'Voir les plans',
  'Plano': 'Plan',
  'Básico': 'Basique',
  'Básico e Pro — taxas por transação e acesso por utilizador':
    'Basique et Pro — frais par transaction et accès par utilisateur',
  'Preços simples, ligados ao negócio real': 'Une tarification simple, liée à l’activité réelle',
  'Paga-se pelo que se transaciona e pelo acesso de cada utilizador. Sem custos escondidos.':
    'Vous payez en fonction de vos transactions et de l’accès de chaque utilisateur. Aucun coût caché.',
  'Acesso mensal': 'Accès mensuel',
  'Custo mensal': 'Coût mensuel',
  'Preço/utilizador': 'Prix/utilisateur',
  'Com integração ERP': 'Avec intégration ERP',
  'No plano PRO': 'Dans le plan PRO',
  'Exigem PRO': 'Exigent PRO',
  'obrigatório para grandes empresas': 'obligatoire pour les grandes entreprises',
  'Grandes empresas': 'Grandes entreprises',
  'Registar a minha empresa': 'Enregistrer mon entreprise',

  // --- Frais KIXIMA par transaction -------------------------------------------
  'Taxa por transação (Taxa KIXIMA)': 'Frais par transaction (Frais KIXIMA)',
  'Cobrada ao fornecedor em cada pagamento processado, à parte da ordem de compra e da fatura.':
    'Facturés au fournisseur sur chaque paiement traité, indépendamment du bon de commande et de la facture.',
  'Taxas da plataforma geradas em cada pagamento, à parte da fatura. 8 USD por PO até 11.500 USD por transação (0,20% acima) + 15 USD por fatura — cobradas ao fornecedor.':
    'Frais de plateforme générés sur chaque paiement, indépendamment de la facture. 8 USD par BC jusqu’à 11 500 USD par transaction (0,20 % au-delà) + 15 USD par facture — facturés au fournisseur.',
  'por ordem de compra, até 11.500 USD por transação':
    'par bon de commande, jusqu’à 11 500 USD par transaction',
  'por fatura emitida': 'par facture émise',
  'do valor da transação, acima de 11.500 USD (substitui os 8 USD)':
    'de la valeur de la transaction, au-delà de 11 500 USD (remplace les 8 USD)',
  '(nº de POs × {perPo}) + {perInvoice} por fatura · acima de {limiar}: {pct} do valor':
    '(nbre de BC × {perPo}) + {perInvoice} par facture · au-delà de {limiar} : {pct} de la valeur',
  'Total faturável/mês': 'Total facturable/mois',
  'Total recebido': 'Total reçu',

  // --- Taille de l’entreprise (critère MPME) ----------------------------------
  'Dimensão': 'Taille',
  'Trabalhadores': 'Employés',
  'Nº de trabalhadores': 'Nombre d’employés',
  'Volume de negócios anual (USD)': 'Chiffre d’affaires annuel (USD)',
  'A dimensão da empresa segue o critério das micro, pequenas e médias empresas e é confirmada pela KIXIMA no credenciamento.':
    'La taille de l’entreprise suit le critère des micro, petites et moyennes entreprises et est confirmée par KIXIMA lors de l’accréditation.',
  'Dimensão da empresa (critério MPME), plano contratado e taxa de acesso por utilizador. Empresas de grande dimensão têm de subscrever o plano PRO.':
    'Taille de l’entreprise (critère MPME), plan souscrit et frais d’accès par utilisateur. Les grandes entreprises doivent souscrire au plan PRO.',
  'Serve para classificar a dimensão da empresa e o plano aplicável. Empresas de grande dimensão subscrevem o plano PRO.':
    'Sert à classer la taille de l’entreprise et le plan applicable. Les grandes entreprises souscrivent au plan PRO.',
  'Credenciadas': 'Accréditées',

  // --- Supplier Development ---------------------------------------------------
  'Supplier Development': 'Supplier Development',
  'Programa KIXIMA': 'Programme KIXIMA',
  'Emancipação burocrática': 'Accompagnement administratif',
  'Parcerias internacionais': 'Partenariats internationaux',
  'Apoio burocrático e parceiros internacionais para empresas angolanas':
    'Accompagnement administratif et partenaires internationaux pour les entreprises angolaises',
  'Apoiamos o fornecedor angolano em todo o processo de emancipação burocrática e procuramos parceiros internacionais para empresas locais — mais tecnologia, mais capacidade e mais participação nacional no setor Oil & Gas.':
    'Nous accompagnons le fournisseur angolais tout au long du processus d’accompagnement administratif et recherchons des partenaires internationaux pour les entreprises locales — plus de technologie, plus de capacité et une participation nationale accrue dans le secteur Oil & Gas.',
  'Candidaturas ao programa de apoio ao fornecedor nacional: emancipação burocrática e procura de parceiros internacionais.':
    'Candidatures au programme de soutien au fournisseur national : accompagnement administratif et recherche de partenaires internationaux.',
  'Percurso': 'Parcours',
  'Tipo de apoio': 'Type d’accompagnement',

  // --- Formulaire de candidature ----------------------------------------------
  'Candidatar-se ao programa': 'Postuler au programme',
  'Nova candidatura': 'Nouvelle candidature',
  'Submeter candidatura': 'Soumettre la candidature',
  'Candidatura recebida': 'Candidature reçue',
  'Não é preciso ter conta na KIXIMA. Preencha e a nossa equipa entra em contacto.':
    'Aucun compte KIXIMA n’est nécessaire. Remplissez le formulaire et notre équipe vous contactera.',
  'Nome do contacto': 'Nom du contact',
  'Área de atividade': 'Secteur d’activité',
  'Província': 'Province',
  'O que precisa do programa?': 'Qu’attendez-vous du programme ?',
  'O que precisa': 'Besoin exprimé',
  'Ex.: Metalomecânica, Logística, Inspeção': 'Ex. : Métallurgie, Logistique, Inspection',
  'Ex.: apoio no licenciamento e um parceiro para soldadura certificada.':
    'Ex. : accompagnement pour les licences et un partenaire pour la soudure certifiée.',
  'A sua candidatura ficou registada com a referência':
    'Votre candidature a été enregistrée sous la référence',
  'A equipa KIXIMA entra em contacto pelo email indicado. Guarde a referência para acompanhar o estado.':
    'L’équipe KIXIMA vous contactera à l’adresse e-mail indiquée. Conservez la référence pour suivre l’état du dossier.',

  // --- Gestion des candidatures -----------------------------------------------
  'Candidaturas': 'Candidatures',
  'Ainda não há candidaturas ao programa.': 'Aucune candidature au programme pour le moment.',
  'Aguardam triagem': 'En attente de tri',
  'Por analisar': 'À analyser',
  'Em análise': 'En cours d’analyse',
  'Em acompanhamento': 'En suivi',
  'Casos ativos': 'Dossiers actifs',
  'Processos fechados': 'Dossiers clôturés',
  'Rejeitadas': 'Rejetées',
  'Marcar em análise': 'Marquer en cours d’analyse',
  'Concluir': 'Clôturer',
  'Ver / Acompanhar': 'Voir / Suivre',
  'Notas de acompanhamento (internas)': 'Notes de suivi (internes)',
  'Pesquisar por empresa ou NIF…': 'Rechercher par entreprise ou NIF…',
  'Pesquisar por empresa, referência ou email…': 'Rechercher par entreprise, référence ou e-mail…',
};
