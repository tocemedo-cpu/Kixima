// src/components/SubscriptionBanner.jsx
// Aviso de urgência da subscrição — mesma leitura em qualquer página
// (AppLayout, para quem nunca visita /empresa/assinatura) e na própria
// página de Subscrição. Mesmo padrão de escalada de cor já usado no aviso de
// 2FA obrigatória (banner-warn -> banner-danger conforme o prazo aperta —
// ver global.css). ATIVA não mostra nada.
//
// A mensagem NUNCA esconde a garantia central desta política: os dados da
// empresa não se perdem por causa da subscrição vencer.
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function SubscriptionBanner({ data, mostrarBotao = true }) {
  const { t } = useI18n();
  if (!data || data.estadoSubscricao === 'ATIVA') return null;

  const { estadoSubscricao: estado, diasAteExpirar, planoAtual } = data;

  let texto;
  let classe = 'banner-warn';
  if (estado === 'A_EXPIRAR') {
    texto = t(
      'A subscrição da sua empresa vence em {n} dias. Renove para continuar a utilizar todos os recursos do plano {plano}.',
      { n: diasAteExpirar, plano: planoAtual },
    );
  } else if (estado === 'GRACE') {
    classe = 'banner-danger';
    texto = t('A subscrição da sua empresa expirou. Os seus dados continuam seguros. Envie o comprovativo de pagamento para renovar o acesso aos recursos pagos.');
  } else {
    classe = 'banner-danger';
    texto = t('A subscrição da sua empresa está vencida. Os seus dados continuam seguros, mas alguns recursos pagos (novos utilizadores, integrações, funcionalidades premium) estão bloqueados até regularizar.');
  }

  return (
    <div className={`banner ${classe}`} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>{texto}</span>
      {mostrarBotao ? (
        <Link className="btn btn-accent btn-sm" to="/empresa/assinatura">
          {estado === 'A_EXPIRAR' ? t('Renovar plano') : t('Renovar agora')}
        </Link>
      ) : null}
    </div>
  );
}
