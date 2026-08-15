// src/components/Common.jsx
// Peças básicas partilhadas. Traduzem automaticamente as strings recebidas
// (título, subtítulo, labels) via i18n — números e nós React passam intactos.
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../auth/AuthContext';

function useT() {
  const { t } = useI18n();
  return (v) => (typeof v === 'string' ? t(v) : v);
}

export function StatCard({ label, value, sub }) {
  const tr = useT();
  return (
    <div className="card stat-card">
      <div className="stat-label">{tr(label)}</div>
      <div className="stat-value">{tr(value)}</div>
      {sub ? <div className="stat-sub">{tr(sub)}</div> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  const tr = useT();
  return (
    <div className="page-header">
      <div>
        <h1>{tr(title)}</h1>
        {subtitle ? <p>{tr(subtitle)}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Loading({ label = 'A carregar…' }) {
  const tr = useT();
  return <div className="loading-text">{tr(label)}</div>;
}

// Quem pode comprometer a empresa num plano. É a mesma regra do servidor
// (assinaturaRoutes: pedir exige COMPANY_ADMIN) — se divergisse, a interface
// mostrava um botão que dava 403.
const PODE_SUBSCREVER = ['COMPANY_ADMIN'];
// Quem chega à página de subscrição, mesmo sem poder pedir (o Financeiro é
// quem carrega o comprovativo).
const VE_SUBSCRICAO = ['COMPANY_ADMIN', 'FINANCEIRO'];

// As mensagens dos banners vêm muitas vezes do servidor (já em PT); as fixas
// das páginas passam por t() no ponto de chamada, as dinâmicas ficam como estão.
//
// `error` é opcional e serve um caso concreto: bater num limite do plano. Até
// aqui a pessoa lia "o plano CORE inclui 5 lugares" e ficava ali — a plataforma
// dizia-lhe o que estava errado e não lhe dava caminho nenhum para o corrigir.
// O momento em que alguém QUER mudar de plano é exatamente este, e era o único
// sítio sem botão.
//
// O muro reconhece-se pelo CÓDIGO do erro e não pelo texto: uma frase reescrita
// não pode partir o botão em silêncio.
export function ErrorBanner({ message, error }) {
  const tr = useT();
  const { t } = useI18n();
  const { user } = useAuth();
  // `message` aceita uma string OU o próprio erro. As páginas misturam os dois
  // no mesmo estado — validações locais guardam texto, o servidor guarda o erro
  // — e obrigá-las a separar em dois estados era mudar tudo para ganhar nada.
  const erro = typeof message === 'object' && message ? message : error;
  const texto = typeof message === 'string' ? message : erro?.message;
  if (!texto) return null;

  const muroDePlano = erro?.code === 'PLANO_INSUFICIENTE';
  if (!muroDePlano) return <div className="banner banner-error">{tr(texto)}</div>;

  const papel = user?.role;
  return (
    <div className="banner banner-error" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>{tr(texto)}</span>
      {PODE_SUBSCREVER.includes(papel) ? (
        <Link className="btn btn-accent btn-sm" to="/empresa/assinatura">{t('Ver planos e subscrever')}</Link>
      ) : VE_SUBSCRICAO.includes(papel) ? (
        <Link className="btn btn-ghost btn-sm" to="/empresa/assinatura">{t('Ver a subscrição')}</Link>
      ) : (
        // Sem botão para quem não pode pagar — mandá-lo para uma página que lhe
        // devolve 403 seria pior do que não ter botão. Diz-se quem trata disto.
        <span className="helptext">{t('Só o administrador da empresa pode mudar de plano — fale com ele.')}</span>
      )}
    </div>
  );
}

export function SuccessBanner({ message }) {
  const tr = useT();
  if (!message) return null;
  return <div className="banner banner-success">{tr(message)}</div>;
}

/**
 * Campo de formulário com o rótulo LIGADO ao controlo.
 *
 * O padrão antigo — <div className="field"><label>X</label><input/></div> —
 * parece certo e não é: sem `htmlFor`/`id`, o rótulo é só texto que por acaso
 * está por cima. Um leitor de ecrã anuncia "caixa de texto, em branco" e a
 * pessoa fica a adivinhar o que escrever; e clicar no rótulo não põe o cursor
 * no campo, o que toda a gente espera que aconteça.
 *
 * O id vem do useId em vez de ser escrito à mão porque o mesmo formulário pode
 * aparecer duas vezes na página (um modal por cima de uma lista) e dois ids
 * iguais ligam o rótulo ao campo errado.
 *
 * Uso: <Field label="NIF">{(id) => <input id={id} … />}</Field>
 */
export function Field({ label, hint, obrigatorio = false, children, ...rest }) {
  const tr = useT();
  const id = useId();
  return (
    <div className="field" {...rest}>
      <label htmlFor={id}>
        {tr(label)}
        {obrigatorio ? <span aria-hidden="true" style={{ color: 'var(--brand-600)' }}> *</span> : null}
      </label>
      {typeof children === 'function' ? children(id) : children}
      {hint ? <small className="helptext">{tr(hint)}</small> : null}
    </div>
  );
}
