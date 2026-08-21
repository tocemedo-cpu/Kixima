// src/i18n/emails.js
// Traduções das mensagens que o SERVIDOR envia por email.
//
// Porquê existir: o idioma escolhido na plataforma vivia só no localStorage do
// browser. O servidor não o vê — e é o servidor que escreve o convite, o link de
// recuperação de senha e o aviso de fatura pendente. Resultado: um utilizador
// francês recebia tudo em português.
//
// A chave é o texto em português, como no frontend. Sem tradução, devolve o
// original — nunca falha, no pior caso fica em PT.
const PT = 'pt';

const EN = {
  'Nova ordem de compra recebida': 'New purchase order received',
  'Recebeu a ordem de compra {ref}. Reveja e aceite ou recuse.':
    'You have received purchase order {ref}. Review and accept or decline it.',
  'Fatura pendente de pagamento': 'Invoice pending payment',
  'A fatura {fatura} (PO {po}) foi gerada. Prazo de pagamento: {prazo}.':
    'Invoice {fatura} (PO {po}) has been issued. Payment due: {prazo}.',
  'Pagamento recebido': 'Payment received',
  'O pagamento da PO {ref} foi processado. Pode iniciar a execução/entrega.':
    'Payment for PO {ref} has been processed. You may start execution/delivery.',
  'Entrega despachada': 'Delivery dispatched',
  'Convite para a KIXIMA': 'Invitation to KIXIMA',
  'Recuperação de senha': 'Password recovery',
  'Nova candidatura ao Supplier Development': 'New Supplier Development application',
  'Código de acesso KIXIMA': 'KIXIMA access code',
  'Código para ativar a verificação em dois passos': 'Code to turn on two-step verification',
  'O seu código é {codigo}. É válido durante {minutos} minutos e só pode ser usado uma vez. Se não foi você a pedi-lo, alguém sabe a sua senha — mude-a assim que puder.':
    'Your code is {codigo}. It is valid for {minutos} minutes and can only be used once. If you did not request it, someone knows your password — change it as soon as you can.',
  'Falta ativar a verificação em dois passos': 'Two-step verification is still not on',
  'A sua conta KIXIMA aprova operações com dinheiro, por isso a senha deixou de bastar. Falta ativar a verificação em dois passos.':
    'Your KIXIMA account approves money operations, so a password is no longer enough. Two-step verification is still not turned on.',
  'A partir de {data}, sem isto configurado a sua conta só dá acesso ao ecrã de ativação — não conseguirá aprovar ordens nem consultar o resto da plataforma.':
    'From {data}, without this set up your account will only reach the activation screen — you will not be able to approve orders or view the rest of the platform.',
  'Entre na plataforma e vá a Configurações → Segurança. Demora menos de um minuto: enviamos-lhe um código por email e é só confirmá-lo.':
    'Sign in and go to Settings → Security. It takes less than a minute: we email you a code and you just confirm it.',
  'Apólice atualizada': 'Policy updated',
  'Subscrição a vencer': 'Subscription expiring soon',
  'A subscrição da sua empresa vence em 30 dias.': 'Your company subscription expires in 30 days.',
  'A subscrição da sua empresa vence em 7 dias. Renove para continuar a utilizar todos os recursos do plano.':
    'Your company subscription expires in 7 days. Renew to keep using all of your plan\'s features.',
  'A subscrição da sua empresa vence em 3 dias. Renove para não perder acesso aos recursos pagos.':
    'Your company subscription expires in 3 days. Renew to avoid losing access to paid features.',
  'A subscrição da sua empresa vence amanhã. Renove hoje para não interromper o serviço.':
    'Your company subscription expires tomorrow. Renew today to avoid a service interruption.',
  'A subscrição da sua empresa vence hoje. Envie o comprovativo de pagamento para não interromper o serviço.':
    'Your company subscription expires today. Send the payment proof to avoid a service interruption.',
  'A subscrição da sua empresa expirou. Os seus dados continuam seguros — envie o comprovativo de pagamento para renovar o acesso aos recursos pagos.':
    'Your company subscription has expired. Your data remains safe — send the payment proof to restore access to paid features.',
  'A subscrição da sua empresa continua por regularizar. Os seus dados continuam seguros, mas os recursos pagos ficam indisponíveis em breve sem renovação.':
    'Your company subscription is still unpaid. Your data remains safe, but paid features will become unavailable soon without renewal.',
};

const FR = {
  'Nova ordem de compra recebida': 'Nouveau bon de commande reçu',
  'Recebeu a ordem de compra {ref}. Reveja e aceite ou recuse.':
    'Vous avez reçu le bon de commande {ref}. Vérifiez-le puis acceptez ou refusez.',
  'Fatura pendente de pagamento': 'Facture en attente de paiement',
  'A fatura {fatura} (PO {po}) foi gerada. Prazo de pagamento: {prazo}.':
    'La facture {fatura} (BC {po}) a été émise. Échéance de paiement : {prazo}.',
  'Pagamento recebido': 'Paiement reçu',
  'O pagamento da PO {ref} foi processado. Pode iniciar a execução/entrega.':
    'Le paiement du BC {ref} a été traité. Vous pouvez lancer l’exécution/la livraison.',
  'Entrega despachada': 'Livraison expédiée',
  'Convite para a KIXIMA': 'Invitation à KIXIMA',
  'Recuperação de senha': 'Récupération de mot de passe',
  'Nova candidatura ao Supplier Development': 'Nouvelle candidature au Supplier Development',
  'Código de acesso KIXIMA': 'Code d’accès KIXIMA',
  'Código para ativar a verificação em dois passos': 'Code pour activer la vérification en deux étapes',
  'O seu código é {codigo}. É válido durante {minutos} minutos e só pode ser usado uma vez. Se não foi você a pedi-lo, alguém sabe a sua senha — mude-a assim que puder.':
    'Votre code est {codigo}. Il est valable {minutos} minutes et ne peut servir qu’une seule fois. Si vous ne l’avez pas demandé, quelqu’un connaît votre mot de passe — changez-le dès que possible.',
  'Falta ativar a verificação em dois passos': 'La vérification en deux étapes n’est toujours pas activée',
  'A sua conta KIXIMA aprova operações com dinheiro, por isso a senha deixou de bastar. Falta ativar a verificação em dois passos.':
    'Votre compte KIXIMA approuve des opérations financières, le mot de passe ne suffit donc plus. La vérification en deux étapes n’est toujours pas activée.',
  'A partir de {data}, sem isto configurado a sua conta só dá acesso ao ecrã de ativação — não conseguirá aprovar ordens nem consultar o resto da plataforma.':
    'À partir du {data}, sans cette configuration votre compte n’accédera qu’à l’écran d’activation — vous ne pourrez ni approuver de bons de commande ni consulter le reste de la plateforme.',
  'Entre na plataforma e vá a Configurações → Segurança. Demora menos de um minuto: enviamos-lhe um código por email e é só confirmá-lo.':
    'Connectez-vous et allez dans Paramètres → Sécurité. Cela prend moins d’une minute : nous vous envoyons un code par e-mail, il suffit de le confirmer.',
  'Apólice atualizada': 'Police mise à jour',
  'Subscrição a vencer': 'Abonnement bientôt expiré',
  'A subscrição da sua empresa vence em 30 dias.': 'L’abonnement de votre entreprise expire dans 30 jours.',
  'A subscrição da sua empresa vence em 7 dias. Renove para continuar a utilizar todos os recursos do plano.':
    'L’abonnement de votre entreprise expire dans 7 jours. Renouvelez pour continuer à profiter de toutes les fonctionnalités de votre forfait.',
  'A subscrição da sua empresa vence em 3 dias. Renove para não perder acesso aos recursos pagos.':
    'L’abonnement de votre entreprise expire dans 3 jours. Renouvelez pour ne pas perdre l’accès aux fonctionnalités payantes.',
  'A subscrição da sua empresa vence amanhã. Renove hoje para não interromper o serviço.':
    'L’abonnement de votre entreprise expire demain. Renouvelez aujourd’hui pour éviter une interruption de service.',
  'A subscrição da sua empresa vence hoje. Envie o comprovativo de pagamento para não interromper o serviço.':
    'L’abonnement de votre entreprise expire aujourd’hui. Envoyez le justificatif de paiement pour éviter une interruption de service.',
  'A subscrição da sua empresa expirou. Os seus dados continuam seguros — envie o comprovativo de pagamento para renovar o acesso aos recursos pagos.':
    'L’abonnement de votre entreprise a expiré. Vos données restent en sécurité — envoyez le justificatif de paiement pour retrouver l’accès aux fonctionnalités payantes.',
  'A subscrição da sua empresa continua por regularizar. Os seus dados continuam seguros, mas os recursos pagos ficam indisponíveis em breve sem renovação.':
    'L’abonnement de votre entreprise reste à régulariser. Vos données restent en sécurité, mais les fonctionnalités payantes seront bientôt indisponibles sans renouvellement.',
};

const DICT = { en: EN, fr: FR };

const IDIOMAS = ['pt', 'en', 'fr'];

// Normaliza o que vier da base ("EN", "fr-FR", null) para um dos três idiomas.
function normalizar(locale) {
  const l = String(locale || '').toLowerCase().slice(0, 2);
  return IDIOMAS.includes(l) ? l : PT;
}

/**
 * Traduz uma mensagem para o idioma do destinatário.
 * @param texto   texto em português (é a chave)
 * @param locale  idioma do utilizador ('pt' | 'en' | 'fr')
 * @param vars    substituições {chave} → valor
 */
function t(texto, locale, vars) {
  const lang = normalizar(locale);
  let s = (lang !== PT && DICT[lang]?.[texto]) || texto;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

module.exports = { t, normalizar, IDIOMAS };
