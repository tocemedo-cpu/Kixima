package ao.kixima.realtime;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Spring WebSocket/STOMP no lugar do Socket.IO (decisão do plano, M6). O
 * cliente do frontend só muda no cutover deste domínio — até lá o Node
 * continua a servir o Socket.IO e isto fica pronto, lado a lado.
 *
 * Mapa das salas (realtimeService.js → destinos STOMP), para o cutover:
 * <pre>
 *   user:&lt;id&gt;            → /user/queue/notifications      (evento notification:new)
 *   support:&lt;ticketId&gt;   → /topic/support/{ticketId}      (support:message, support:updated)
 *   conversation:&lt;id&gt;    → /topic/conversation/{id}       (conversation:message, conversation:risk-alert)
 * </pre>
 * Cada mensagem é um envelope {@code { event, payload }} com o MESMO nome de
 * evento e o MESMO payload que o Socket.IO emite — o cliente troca
 * {@code socket.on(evento)} por uma subscrição por sala e despacha por
 * {@code event}. "support:join"/"conversation:join" passam a ser a própria
 * subscrição, autorizada em {@link RealtimeAuthInterceptor}.
 *
 * Endpoint {@code /ws} (WebSocket nativo) e {@code /ws/sockjs} (fallback,
 * o "polling" do Socket.IO). CORS: as mesmas origens que o REST
 * (SecurityConfig.corsConfigurationSource — hoje qualquer, com o mesmo TODO).
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final RealtimeAuthInterceptor realtimeAuthInterceptor;
    private final RealtimeHandshakeInterceptor realtimeHandshakeInterceptor;

    public WebSocketConfig(RealtimeAuthInterceptor realtimeAuthInterceptor,
                            RealtimeHandshakeInterceptor realtimeHandshakeInterceptor) {
        this.realtimeAuthInterceptor = realtimeAuthInterceptor;
        this.realtimeHandshakeInterceptor = realtimeHandshakeInterceptor;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.setErrorHandler(new RealtimeErrorHandler());
        registry.addEndpoint("/ws")
                .addInterceptors(realtimeHandshakeInterceptor)
                .setAllowedOriginPatterns("*");
        registry.addEndpoint("/ws/sockjs")
                .addInterceptors(realtimeHandshakeInterceptor)
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setUserDestinationPrefix("/user");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(realtimeAuthInterceptor);
    }
}
