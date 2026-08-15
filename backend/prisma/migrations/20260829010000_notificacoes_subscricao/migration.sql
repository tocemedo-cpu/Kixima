-- Tipos de notificação da subscrição.
--
-- À parte da migração das assinaturas de propósito: o Postgres não deixa USAR
-- um valor de enum adicionado na MESMA transação em que foi criado, e uma
-- migração que cria o valor e o usa a seguir rebentaria no arranque.
--
-- Sem estes dois valores, o "comprovativo de subscrição recebido" teria de ir
-- marcado como PAGAMENTO_PROCESSADO — que é outra coisa. Uma notificação com o
-- tipo errado não se consegue filtrar, contar, nem explicar a quem a recebe.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRICAO_COMPROVATIVO';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRICAO_CONFIRMADA';
