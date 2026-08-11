// src/components/PaymentSlaRing.jsx
// Elemento assinatura do produto: mostra visualmente a promessa central da
// KIXIMA — pagamento garantido ao fornecedor dentro de N dias após a
// aceitação da PO. O anel enche à medida que os dias passam e muda de cor
// (verde-azulado -> âmbar -> terracota) conforme se aproxima o prazo.
import { useI18n } from '../i18n';
import { activeLocale } from '../i18n';

const SIZE = 56;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function colorFor(fraction) {
  if (fraction >= 1) return 'var(--terracotta-600)';
  if (fraction >= 0.7) return 'var(--amber-500)';
  return 'var(--teal-600)';
}

export default function PaymentSlaRing({ acceptedAt, paymentDueAt, paidAt, totalDays = 7 }) {
  const { t } = useI18n();
  if (!acceptedAt || !paymentDueAt) {
    return (
      <div className="sla-ring-wrap">
        <svg className="sla-ring" viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle className="sla-track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} />
        </svg>
        <div>
          <div className="sla-label">{t('Aguarda aceitação')}</div>
          <div className="sla-caption">{t('O relógio dos {n} dias começa quando o fornecedor aceitar a PO.', { n: totalDays })}</div>
        </div>
      </div>
    );
  }

  const now = paidAt ? new Date(paidAt) : new Date();
  const start = new Date(acceptedAt);
  const due = new Date(paymentDueAt);
  const elapsedMs = Math.max(0, now - start);
  const totalMs = Math.max(1, due - start);
  const fraction = Math.min(1, elapsedMs / totalMs);
  const daysElapsed = Math.min(totalDays, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
  const color = paidAt ? 'var(--teal-600)' : colorFor(fraction);
  const dashOffset = CIRCUMFERENCE * (1 - (paidAt ? 1 : fraction));

  return (
    <div className="sla-ring-wrap">
      <svg className="sla-ring" viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle className="sla-track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} />
        <circle
          className="sla-progress"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div>
        <div className="sla-label" style={{ color }}>
          {paidAt ? t('Pago') : t('Dia {a} de {b}', { a: daysElapsed, b: totalDays })}
        </div>
        <div className="sla-caption">
          {paidAt
            ? t('Pagamento garantido cumprido dentro do prazo.')
            : `${t('Prazo de pagamento')}: ${new Intl.DateTimeFormat(activeLocale(), { day: '2-digit', month: 'short' }).format(due)}`}
        </div>
      </div>
    </div>
  );
}
