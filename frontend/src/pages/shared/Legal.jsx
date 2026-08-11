// src/pages/shared/Legal.jsx
// Termos de Uso e Política de Privacidade — páginas públicas (folha legível,
// imprimível). O aceite é obrigatório no cadastro de empresas e nos convites.
// NOTA: conteúdo-modelo profissional; recomenda-se revisão por advogado antes
// do lançamento comercial.
import { useNavigate } from 'react-router-dom';

const UPDATED = '11 de agosto de 2026';

function S({ n, title, children }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 14.5, margin: '0 0 6px' }}>{n}. {title}</h2>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </section>
  );
}

function TermsContent() {
  return (
    <>
      <S n="1" title="O que é a KIXIMA">
        <p>A KIXIMA é uma plataforma digital B2B (e-marketplace) de procurement para o setor de Oil &amp; Gas em Angola, que liga empresas compradoras a empresas fornecedoras credenciadas, com um fluxo de compra estruturado (ordem de compra, aprovação, fatura, pagamento em prazo definido e receção) e mecanismos de confiança, incluindo credenciamento documental, apólices de seguro e registo de auditoria.</p>
        <p>A KIXIMA <strong>não é parte</strong> nos contratos de compra e venda celebrados entre compradores e fornecedores: é a infraestrutura que os suporta.</p>
      </S>
      <S n="2" title="Elegibilidade e cadastro">
        <p>A plataforma destina-se exclusivamente a empresas (pessoas coletivas) e aos seus utilizadores autorizados. O cadastro exige documentos de credenciamento verdadeiros e válidos (certidão comercial, alvará, licenças aplicáveis) e, para fornecedores, apólice de seguro válida. Quem regista a empresa declara ter poderes para a vincular a estes Termos.</p>
        <p>A KIXIMA pode aprovar, rejeitar ou suspender cadastros com base na análise de credenciamento (due diligence), sem que disso resulte direito a indemnização.</p>
      </S>
      <S n="3" title="Contas e segurança">
        <p>As credenciais de acesso são pessoais e intransmissíveis. A empresa é responsável pelos atos praticados através das contas dos seus utilizadores. Devem ser-nos comunicados de imediato acessos não autorizados. Recomendamos senhas fortes e a ativação da autenticação de dois fatores quando disponível.</p>
      </S>
      <S n="4" title="Fluxo de compra e pagamento">
        <p>O fluxo padrão é: emissão de ordem de compra pelo comprador; aprovação interna; aceitação pelo fornecedor (que gera a fatura da plataforma); pagamento pelo comprador dentro do prazo definido (por omissão, 7 dias); execução/entrega; e confirmação de receção. Divergências na receção são registadas e resolvidas na plataforma (aceitação da entrega ou reposição).</p>
        <p>Os comprovativos de pagamento carregados e as confirmações de receção fazem fé no histórico da plataforma. As faturas geradas pela KIXIMA são documentos de suporte da operação na plataforma; a emissão de faturas fiscalmente válidas nos termos da legislação angolana é responsabilidade de cada fornecedor.</p>
      </S>
      <S n="5" title="Taxa KIXIMA">
        <p>Pela utilização da plataforma é devida pelo fornecedor uma taxa de serviço ("Taxa KIXIMA"), calculada por fatura processada segundo a fórmula publicada na plataforma. O extrato de taxas está disponível na conta do fornecedor. A KIXIMA pode rever a fórmula, com comunicação prévia razoável.</p>
      </S>
      <S n="6" title="Obrigações das empresas utilizadoras">
        <p>As empresas comprometem-se a: fornecer informação verdadeira e mantê-la atualizada; publicar apenas produtos/serviços que podem legalmente fornecer; cumprir as ordens de compra aceites e os prazos assumidos; não usar a plataforma para fins ilícitos, fraudulentos ou anticoncorrenciais; e respeitar direitos de propriedade intelectual de terceiros.</p>
      </S>
      <S n="7" title="Conteúdos e catálogo">
        <p>Cada fornecedor é responsável pelos conteúdos que publica (descrições, preços, imagens, certificações). A KIXIMA pode remover conteúdos que violem estes Termos ou a lei. Os preços apresentados são da responsabilidade do fornecedor.</p>
      </S>
      <S n="8" title="Suspensão e cessação">
        <p>A KIXIMA pode suspender ou encerrar contas em caso de violação destes Termos, suspeita fundada de fraude, incumprimento reiterado ou exigência legal. A empresa pode cessar a utilização a qualquer momento, mantendo-se devidos os valores e obrigações pendentes; os registos de operações são conservados nos termos da Política de Privacidade e da lei.</p>
      </S>
      <S n="9" title="Responsabilidade">
        <p>A plataforma é disponibilizada "tal como está". Na máxima medida permitida por lei, a KIXIMA não responde por lucros cessantes nem por danos indiretos decorrentes de negócios entre utilizadores, sem prejuízo da responsabilidade que não possa ser legalmente excluída. Nada nestes Termos limita a responsabilidade por dolo.</p>
      </S>
      <S n="10" title="Lei aplicável e foro">
        <p>Estes Termos regem-se pela lei da República de Angola. Para qualquer litígio emergente é competente o foro da Comarca de Luanda, com renúncia expressa a qualquer outro.</p>
      </S>
      <S n="11" title="Alterações">
        <p>Podemos atualizar estes Termos; as alterações relevantes serão comunicadas na plataforma com antecedência razoável. A utilização continuada após a entrada em vigor constitui aceitação.</p>
      </S>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <S n="1" title="Responsável pelo tratamento">
        <p>A KIXIMA é a responsável pelo tratamento dos dados pessoais recolhidos na plataforma, nos termos da Lei n.º 22/11, de 17 de junho (Lei da Proteção de Dados Pessoais de Angola). Contacto: através do módulo de Ajuda/Suporte da plataforma.</p>
      </S>
      <S n="2" title="Dados que tratamos">
        <p><strong>Dados de conta:</strong> nome, email profissional, telefone, função/perfil, empresa a que pertence e credenciais (a senha é guardada apenas de forma cifrada e irreversível).</p>
        <p><strong>Dados da empresa:</strong> identificação fiscal, documentos de credenciamento, apólices, dados bancários para pagamentos.</p>
        <p><strong>Dados de operação:</strong> ordens de compra, faturas, pagamentos e comprovativos, confirmações de receção, mensagens de suporte, registos de auditoria (quem fez o quê, quando e de que endereço IP).</p>
        <p><strong>Dados técnicos:</strong> registos de acesso e erros, necessários à segurança e ao funcionamento.</p>
      </S>
      <S n="3" title="Finalidades e fundamentos">
        <p>Tratamos os dados para: prestar o serviço contratado (execução do contrato); cumprir obrigações legais (contabilísticas, fiscais e de conservação de registos); garantir a segurança, prevenir fraude e manter o trilho de auditoria (interesse legítimo); e comunicar notificações operacionais da plataforma.</p>
        <p>Não vendemos dados pessoais nem os usamos para publicidade de terceiros.</p>
      </S>
      <S n="4" title="Partilha de dados">
        <p>Os dados de operação são visíveis às contrapartes do negócio na medida do necessário (ex.: o fornecedor vê a ordem e o comprovativo de pagamento do comprador; o comprador vê os dados do fornecedor). Usamos subcontratantes técnicos para alojamento, base de dados, armazenamento de ficheiros, envio de email e monitorização de erros, vinculados a deveres de confidencialidade e segurança. Podemos divulgar dados quando exigido por lei ou autoridade competente.</p>
      </S>
      <S n="5" title="Transferências internacionais">
        <p>Alguns subcontratantes técnicos podem alojar dados fora de Angola (ex.: centros de dados na União Europeia). Nesses casos, procuramos garantias adequadas de proteção equivalente.</p>
      </S>
      <S n="6" title="Conservação">
        <p>Conservamos os dados enquanto a conta estiver ativa e, após o encerramento, pelos prazos exigidos por lei ou necessários à defesa de direitos — em particular, os registos de operações financeiras e o trilho de auditoria, que por natureza são conservados de forma imutável.</p>
      </S>
      <S n="7" title="Segurança">
        <p>Aplicamos medidas técnicas e organizativas adequadas: cifragem em trânsito (HTTPS), senhas com hash forte, controlo de acessos por perfil, registo de auditoria imutável, isolamento por empresa (multi-tenant) e monitorização de erros. Nenhum sistema é 100% seguro; incidentes relevantes serão comunicados nos termos da lei.</p>
      </S>
      <S n="8" title="Os seus direitos">
        <p>Nos termos da Lei n.º 22/11, tem direito de acesso, retificação, atualização e, quando aplicável, eliminação dos seus dados pessoais, bem como de oposição ao tratamento em certas circunstâncias. Pode exercê-los através do módulo de Ajuda/Suporte. Note que dados integrados em registos de operações e auditoria podem ter de ser conservados por obrigação legal.</p>
      </S>
      <S n="9" title="Cookies e tecnologias locais">
        <p>A plataforma usa apenas armazenamento local estritamente necessário ao funcionamento (ex.: manter a sessão iniciada). Não usamos cookies de publicidade nem rastreamento de terceiros.</p>
      </S>
      <S n="10" title="Alterações a esta política">
        <p>Podemos atualizar esta Política; as alterações relevantes serão comunicadas na plataforma. A data da última atualização consta no topo do documento.</p>
      </S>
    </>
  );
}

const DOCS = {
  termos: { title: 'Termos de Uso', Content: TermsContent },
  privacidade: { title: 'Política de Privacidade', Content: PrivacyContent },
};

export default function Legal({ kind }) {
  const navigate = useNavigate();
  const doc = DOCS[kind] || DOCS.termos;
  const { Content } = doc;

  return (
    <div className="doc-page">
      <div className="doc-toolbar no-print">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Voltar</button>
        <button className="btn btn-accent" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
      </div>

      <div className="pdoc-sheet">
        <header className="pdoc-head">
          <div className="pdoc-tagline" style={{ fontSize: 15 }}><strong>KIXIMA</strong> — e-Market Oil &amp; Gas · Angola / África</div>
          <div className="pdoc-tagline">Última atualização: {UPDATED}</div>
        </header>

        <div className="pdoc-titlebar">
          <h1>{doc.title.toUpperCase()}</h1>
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <Content />
        </div>

        <p className="pdoc-muted no-print" style={{ marginTop: 22, fontSize: 11 }}>
          Consulte também: <a href="/termos">Termos de Uso</a> · <a href="/privacidade">Política de Privacidade</a>
        </p>
      </div>
    </div>
  );
}
