// src/pages/shared/Help.jsx
import { PageHeader } from '../../components/Common';

const FAQ = [
  {
    q: 'Quando é que o fornecedor recebe o pagamento?',
    a: 'Até 7 dias após aceitar a ordem de compra (PO), com fundos do próprio cliente, protegido pela apólice KIXIMA→Cliente. Em POs ao abrigo de um contrato-quadro (call-off), o prazo é o definido no contrato.',
  },
  {
    q: 'O que acontece se eu reportar uma divergência na receção?',
    a: 'O sistema regista o estado e notifica o Admin do Sistema KIXIMA. O acionamento do sinistro da apólice acontece fora da plataforma — a KIXIMA entra em contacto para acompanhar o caso.',
  },
  {
    q: 'Quem aprova uma ordem de compra?',
    a: 'O Company Admin da empresa compradora é o único ponto de aprovação. O Financeiro executa o pagamento já aprovado, mas não decide sobre a compra.',
  },
  {
    q: 'O que é uma PO "Call-off"?',
    a: 'Uma ordem de compra emitida ao abrigo de um contrato-quadro ativo. Dispensa aprovação individual e pagamento antecipado por PO — é faturada de forma consolidada, no prazo definido no contrato.',
  },
  {
    q: 'Como é que a minha empresa é credenciada?',
    a: 'Após o cadastro, a equipa da KIXIMA faz due diligence. Empresas fornecedoras precisam ainda de submeter a apólice Fornecedor→KIXIMA antes de serem aprovadas.',
  },
];

export default function Help() {
  return (
    <div>
      <PageHeader title="Ajuda & Suporte" subtitle="Perguntas frequentes sobre o funcionamento da KIXIMA." />

      <div className="card" style={{ marginBottom: 20 }}>
        {FAQ.map((item, i) => (
          <div
            key={item.q}
            className="card-pad"
            style={{ borderBottom: i === FAQ.length - 1 ? 'none' : '1px solid var(--paper-100)' }}
          >
            <strong style={{ fontSize: 14 }}>{item.q}</strong>
            <p style={{ fontSize: 13.5, color: 'var(--ink-600)', marginTop: 6 }}>{item.a}</p>
          </div>
        ))}
      </div>

      <div className="card card-pad">
        <strong style={{ fontSize: 14 }}>Ainda precisa de ajuda?</strong>
        <p style={{ fontSize: 13.5, color: 'var(--ink-600)', marginTop: 6 }}>
          Contacte a equipa KIXIMA em{' '}
          <a href="mailto:suporte@kixima.co.ao" style={{ color: 'var(--navy-700)', fontWeight: 600 }}>
            suporte@kixima.co.ao
          </a>
          .
        </p>
      </div>
    </div>
  );
}
