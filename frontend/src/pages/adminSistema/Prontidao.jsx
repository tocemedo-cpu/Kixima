// src/pages/adminSistema/Prontidao.jsx
// Prontidão para produção — o que está mesmo configurado no servidor.
//
// Porquê existir: as definições que protegem a plataforma (armazenamento,
// cópias de segurança, envio de email, 2FA obrigatória) vivem em variáveis de
// ambiente, definidas no painel do Render. Uma variável esquecida ou mal
// escrita não dá erro nenhum — a aplicação arranca e comporta-se como se
// estivesse tudo bem, mas os emails ficam no registo, os ficheiros vão para um
// disco que é apagado e a cópia de segurança nunca corre. O plano gratuito não
// dá acesso a shell, por isso esta página é a forma de ir confirmar.
//
// Nunca mostra o valor de um segredo: diz que existe, ou que falta.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Pill, EmptyRow } from '../../components/BuyerUI';
import { useI18n } from '../../i18n';

const TOM = { ok: 'success', aviso: 'pending', falha: 'danger' };
const ROTULO = { ok: 'OK', aviso: 'Atenção', falha: 'Por fazer' };

export default function Prontidao() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [copia, setCopia] = useState(null);
  const [erroCopia, setErroCopia] = useState('');
  const [aCopiar, setACopiar] = useState(false);
  const [email, setEmail] = useState(null);
  const [erroEmail, setErroEmail] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  function load() {
    api.get('/api/admin/prontidao').then(setData).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  // Uma cópia agendada que nunca foi vista a correr é uma suposição. Este botão
  // confirma de uma vez o caminho todo: pg_dump, ligação direta, credenciais e
  // bucket privado.
  async function copiarAgora() {
    setACopiar(true); setErroCopia(''); setCopia(null);
    try {
      setCopia(await api.post('/api/admin/backup'));
      load();
    } catch (e) {
      setErroCopia(e.message);
    } finally {
      setACopiar(false);
    }
  }

  // O envio de email falha em silêncio por desenho — um convite não deve
  // deixar de ser criado porque o servidor de email não respondeu. Este botão é
  // o único sítio onde o erro aparece por inteiro.
  async function emailDeTeste() {
    setAEnviar(true); setErroEmail(''); setEmail(null);
    try {
      setEmail(await api.post('/api/admin/email-teste'));
    } catch (e) {
      setErroEmail(e.message);
    } finally {
      setAEnviar(false);
    }
  }

  const r = data?.resumo;

  return (
    <div>
      <Crumbs trail={['Configurações e Suporte', 'Prontidão para produção']} />
      <PageHead
        title="Prontidão para produção"
        subtitle="O que está mesmo configurado no servidor onde a plataforma está a correr. As definições vivem em variáveis de ambiente e uma que falte não dá erro — a aplicação arranca à mesma e parece estar tudo bem."
      />

      <KpiRow cards={[
        { icon: 'orders', tone: 'info', label: 'Verificações', value: r?.total ?? '—', sub: data ? `Ambiente: ${data.ambiente}` : '' },
        { icon: 'payment', tone: 'success', label: 'Prontas', value: r?.ok ?? '—', sub: 'Nada a fazer' },
        { icon: 'invoice', tone: 'pending', label: 'A merecer atenção', value: r?.avisos ?? '—', sub: 'Funciona, mas não é o ideal' },
        { icon: 'wallet', tone: 'danger', label: 'Por fazer', value: r?.falhas ?? '—', sub: 'Antes de abrir a operadoras' },
      ]} />

      {error ? <div className="empty-state"><p>{error}</p></div> : null}

      {!data && !error ? <EmptyRow>A verificar…</EmptyRow> : null}

      {data?.grupos.map((g) => (
        <div key={g.grupo} className="bz-card" style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line, #e6e6e6)' }}>
            <strong style={{ fontSize: 13.5 }}>{t(g.grupo)}</strong>
          </div>
          {g.checks.map((c) => (
            <div key={c.id} style={{ padding: '12px 16px', borderTop: '1px solid var(--line, #f0f0f0)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                {/* O Pill já traduz o que recebe — passa-se o texto em PT. */}
                <Pill tone={TOM[c.estado] || 'neutral'}>{ROTULO[c.estado] || c.estado}</Pill>
                <strong style={{ fontSize: 13 }}>{t(c.titulo)}</strong>
              </div>
              <p className="bz-muted" style={{ margin: '6px 0 0', fontSize: 12.5 }}>{c.detalhe}</p>
              {/* A acção é o que distingue um diagnóstico de uma queixa. */}
              {c.acao ? <p style={{ margin: '6px 0 0', fontSize: 12.5 }}>{c.acao}</p> : null}
            </div>
          ))}

          {g.grupo === 'Cópias de segurança' ? (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line, #f0f0f0)', background: 'var(--surface-2, #fafafa)' }}>
              <button className="btn btn-accent btn-sm" onClick={copiarAgora} disabled={aCopiar}>
                {aCopiar ? t('A copiar… (pode demorar)') : t('Fazer cópia agora')}
              </button>
              <p className="bz-muted" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
                {t('Confirma de uma vez que o pg_dump existe, que a ligação direta serve, que as credenciais são aceites e que o bucket privado recebe o ficheiro — antes de confiar no agendamento.')}
              </p>
              {copia ? (
                <p style={{ margin: '8px 0 0', fontSize: 12.5 }}>
                  ✅ {t('Cópia concluída')}: <strong>{copia.megabytes} MB</strong> {t('em')} {copia.segundos}s.
                </p>
              ) : null}
              {erroCopia ? <p className="error-text" style={{ margin: '8px 0 0', fontSize: 12.5 }}>{erroCopia}</p> : null}
            </div>
          ) : null}

          {g.grupo === 'Email' ? (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line, #f0f0f0)', background: 'var(--surface-2, #fafafa)' }}>
              <button className="btn btn-accent btn-sm" onClick={emailDeTeste} disabled={aEnviar}>
                {aEnviar ? t('A enviar…') : t('Enviar email de teste para mim')}
              </button>
              <p className="bz-muted" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
                {t('Um convite nunca deixa de ser criado por o email falhar — por isso uma chave errada ou um remetente por verificar não dão sinal nenhum. Aqui o erro aparece por inteiro.')}
              </p>
              {email ? (
                <p style={{ margin: '8px 0 0', fontSize: 12.5 }}>
                  ✅ {t('Enviado para')} <strong>{email.para}</strong> {t('via')} {email.provider}. {t('Confirme na caixa de entrada (e no spam).')}
                </p>
              ) : null}
              {erroEmail ? <p className="error-text" style={{ margin: '8px 0 0', fontSize: 12.5 }}>{erroEmail}</p> : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
