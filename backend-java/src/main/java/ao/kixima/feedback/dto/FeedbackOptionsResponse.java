package ao.kixima.feedback.dto;

import java.util.List;

/**
 * Espelha o retorno de feedbackService.opcoes — as opções reais para o
 * dropdown "sobre o que é esta avaliação", por categoria. `pagamento` fica
 * sempre vazio: depende do domínio Payment, ainda não portado.
 */
public record FeedbackOptionsResponse(List<FeedbackOptionDto> FORNECEDOR, List<FeedbackOptionDto> PRODUTO,
                                       List<FeedbackOptionDto> SERVICO, List<FeedbackOptionDto> PEDIDO,
                                       List<FeedbackOptionDto> ENTREGA, List<FeedbackOptionDto> PAGAMENTO,
                                       List<FeedbackOptionDto> ATENDIMENTO) {
}
