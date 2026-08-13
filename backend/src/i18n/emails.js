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
  'Apólice atualizada': 'Policy updated',
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
  'Apólice atualizada': 'Police mise à jour',
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
