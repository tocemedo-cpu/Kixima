// src/pages/shared/SupplierDevelopment.jsx
// Supplier Development — página PÚBLICA (acessível a partir do login e da home).
// Duas frentes: (1) emancipação burocrática do fornecedor nacional e (2) procura
// de parceiros internacionais para empresas locais. A candidatura não exige
// conta: qualquer empresa angolana se pode candidatar e acompanhar por
// referência.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import Logo from '../../components/Logo';
import { Icon } from '../../components/icons';
import { useI18n, LANGS } from '../../i18n';

const EMPTY = {
  companyName: '', taxId: '', contactName: '', contactEmail: '', contactPhone: '',
  province: '', sector: '', employees: '', track: 'AMBOS', needs: '',
};

const TRACKS = [
  { key: 'BUROCRACIA', icon: 'contract', title: 'Emancipação burocrática',
    body: 'Acompanhamento no registo comercial, alvarás, licenças do setor, certificações e conformidade — o percurso completo para se tornar um fornecedor credenciado.' },
  { key: 'PARCERIA', icon: 'offshore', title: 'Parcerias internacionais',
    body: 'Ligação a parceiros estrangeiros para transferência de tecnologia e capacitação, para que mais empresas angolanas participem no setor com meios próprios.' },
];

export default function SupplierDevelopment({ initialTrack = 'BUROCRACIA' }) {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // A página serve as duas portas de entrada: /supplier-development e
  // /parcerias. O percurso entra pré-selecionado, mas o OUTRO fica sempre
  // disponível — quem procura parceiros pode precisar de apoio burocrático e
  // vice-versa.
  const base = pathname.startsWith('/parcerias') ? 'PARCERIA' : initialTrack;
  const other = base === 'PARCERIA' ? 'BUROCRACIA' : 'PARCERIA';
  const [form, setForm] = useState(EMPTY);
  const [alsoOther, setAlsoOther] = useState(false);
  const track = alsoOther ? 'AMBOS' : base;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  // A taxa de acesso é cobrada no acto de submeter — tem de estar à vista ANTES
  // de o candidato submeter, e ele tem de a aceitar expressamente.
  const [fee, setFee] = useState(null);
  const [feeAccepted, setFeeAccepted] = useState(false);

  useEffect(() => { api.get('/api/supplier-development/fee').then(setFee).catch(() => setFee(null)); }, []);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form, track, feeAccepted: true,
        employees: form.employees === '' ? undefined : Number(form.employees),
      };
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      setDone(await api.post('/api/supplier-development/requests', payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sd-page">
      <header className="sd-top">
        <Link to="/login" className="sd-brand"><Logo size={20} mark={44} subtitle light /></Link>
        <div className="sd-top-actions">
          <select className="input sd-lang" value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('Idioma')}>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>{t('Entrar')}</button>
        </div>
      </header>

      <section className="sd-hero">
        <span className="sd-tag">{t('Programa KIXIMA')}</span>
        <h1>{t(base === 'PARCERIA' ? 'Parceiros internacionais' : 'Supplier Development')}</h1>
        <p>
          {t('Apoiamos o fornecedor angolano em todo o processo de emancipação burocrática e procuramos parceiros internacionais para empresas locais — mais tecnologia, mais capacidade e mais participação nacional no setor Oil & Gas.')}
        </p>
      </section>

      <section className="sd-tracks">
        {TRACKS.map((x) => (
          <article className="sd-track" key={x.key}>
            <span className="sd-track-ico"><Icon name={x.icon} size={22} /></span>
            <h2>{t(x.title)}</h2>
            <p>{t(x.body)}</p>
          </article>
        ))}
      </section>

      <section className="sd-formwrap">
        {done ? (
          <div className="sd-card sd-done">
            <h2>{t('Candidatura recebida')}</h2>
            <p>
              {t('A sua candidatura ficou registada com a referência')}{' '}
              <strong className="mono">{done.reference}</strong>. {t('A equipa KIXIMA entra em contacto pelo email indicado. Guarde a referência para acompanhar o estado.')}
            </p>
            {done.accessFee ? (
              <div className="sd-fee sd-fee-done">
                <div className="sd-fee-head">
                  <span className="sd-fee-ico"><Icon name="wallet" size={18} /></span>
                  <div>
                    <strong>{t('Taxa de acesso cobrada nesta submissão')}</strong>
                    <span className="sd-fee-amount">{t('{valor} USD/mês', { valor: done.accessFee.amountUsd })}</span>
                  </div>
                </div>
                <p>
                  {t('A taxa ficou emitida em seu nome com a referência acima e está por liquidar. A KIXIMA envia as coordenadas de pagamento para o email indicado.')}
                </p>
                <p>{t('O restante do programa é orçamentado caso a caso e enviado com a proposta.')}</p>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <Link className="btn btn-accent" to="/login">{t('Ir para o login')}</Link>
              <button className="btn btn-ghost" onClick={() => { setDone(null); setForm(EMPTY); }}>
                {t('Nova candidatura')}
              </button>
            </div>
          </div>
        ) : (
          <div className="sd-card">
            <h2>{t('Candidatar-se ao programa')}</h2>
            <p className="helptext">{t('Não é preciso ter conta na KIXIMA. Preencha e a nossa equipa entra em contacto.')}</p>

            <div className="sd-selected">
              <span className="sd-selected-tag">{t('Candidatura a')}</span>
              <strong>{t(base === 'PARCERIA' ? 'Parceiros internacionais' : 'Supplier Development')}</strong>
            </div>

            {/* Opção cruzada: os dois programas complementam-se. */}
            <label className="sd-cross">
              <input type="checkbox" checked={alsoOther} onChange={(e) => setAlsoOther(e.target.checked)} />
              <span>
                <strong>
                  {t(other === 'PARCERIA'
                    ? 'Também procuro parceiros internacionais'
                    : 'Também preciso de apoio no processo burocrático')}
                </strong>
                <span>
                  {t(other === 'PARCERIA'
                    ? 'Ligação a parceiros estrangeiros para tecnologia e capacitação.'
                    : 'Acompanhamento no registo, licenças, certificações e conformidade.')}
                </span>
              </span>
            </label>

            <form onSubmit={handleSubmit}>
              <div className="grid-cols grid-2">
                <div className="field">
                  <label>{t('Nome da empresa')} <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                  <input required value={form.companyName} onChange={(e) => update('companyName', e.target.value)} />
                </div>
                <div className="field">
                  <label>{t('NIF')}</label>
                  <input value={form.taxId} onChange={(e) => update('taxId', e.target.value)} />
                </div>
              </div>
              <div className="grid-cols grid-2">
                <div className="field">
                  <label>{t('Nome do contacto')} <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                  <input required value={form.contactName} onChange={(e) => update('contactName', e.target.value)} />
                </div>
                <div className="field">
                  <label>{t('Email')} <span style={{ color: 'var(--brand-600)' }}>*</span></label>
                  <input type="email" required value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} />
                </div>
              </div>
              <div className="grid-cols grid-2">
                <div className="field">
                  <label>{t('Telefone')}</label>
                  <input value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} />
                </div>
                <div className="field">
                  <label>{t('Província')}</label>
                  <input value={form.province} onChange={(e) => update('province', e.target.value)} />
                </div>
              </div>
              <div className="grid-cols grid-2">
                <div className="field">
                  <label>{t('Área de atividade')}</label>
                  <input value={form.sector} onChange={(e) => update('sector', e.target.value)} placeholder={t('Ex.: Metalomecânica, Logística, Inspeção')} />
                </div>
                <div className="field">
                  <label>{t('Nº de trabalhadores')}</label>
                  <input type="number" min="0" value={form.employees} onChange={(e) => update('employees', e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>{t('O que precisa do programa?')}</label>
                <textarea rows={4} value={form.needs} onChange={(e) => update('needs', e.target.value)}
                  placeholder={t('Ex.: apoio no licenciamento e um parceiro para soldadura certificada.')} />
              </div>

              {/* A taxa é cobrada no acto: tem de estar à vista antes de submeter. */}
              <div className="sd-fee">
                <div className="sd-fee-head">
                  <span className="sd-fee-ico"><Icon name="wallet" size={18} /></span>
                  <div>
                    <strong>{t('Taxa de acesso ao programa')}</strong>
                    <span className="sd-fee-amount">
                      {fee ? t('{valor} USD/mês', { valor: fee.amountUsd }) : '—'}
                    </span>
                  </div>
                </div>
                <p>
                  {t('Esta taxa é cobrada logo na submissão da intenção — é o que dá acesso ao programa. É a mesma taxa de acesso das pequenas empresas.')}
                </p>
                <p>
                  {t('O restante do programa (os serviços efetivamente prestados) é orçamentado caso a caso, depois da triagem da sua candidatura.')}
                </p>
                <label className="sd-fee-accept">
                  <input type="checkbox" required checked={feeAccepted} onChange={(e) => setFeeAccepted(e.target.checked)} />
                  <span>{t('Li e aceito que a taxa de acesso é cobrada na submissão desta candidatura.')}</span>
                </label>
              </div>

              {error ? <p className="error-text" style={{ margin: '10px 0' }}>{error}</p> : null}
              <button className="btn btn-accent" type="submit" disabled={submitting || !feeAccepted} style={{ width: '100%' }}>
                {submitting ? t('A submeter…') : t('Submeter candidatura e aceitar a taxa')}
              </button>
            </form>
          </div>
        )}
      </section>

      <footer className="sd-foot">
        <Link to="/termos">{t('Termos de Uso')}</Link> · <Link to="/privacidade">{t('Política de Privacidade')}</Link>
      </footer>
    </div>
  );
}
