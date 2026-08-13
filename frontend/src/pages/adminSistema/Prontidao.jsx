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
  const [verificacao, setVerificacao] = useState(null);
  const [erroVerificacao, setErroVerificacao] = useState('');
  const [aVerificar, setAVerificar] = useState(false);
  const [email, setEmail] = useState(null);
  const [erroEmail, setErroEmail] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const [pendentes, setPendentes] = useState(null);
  const [lembrete, setLembrete] = useState(null);
  const [erroLembrete, setErroLembrete] = useState('');
  const [aLembrar, setALembrar] = useState(false);

  function load() {
    api.get('/api/admin/prontidao').then(setData).catch((e) => setError(e.message));
    // Quem são, e não só quantos: um número não se persegue.
    api.get('/api/admin/mfa-pendentes').then(setPendentes).catch(() => setPendentes([]));
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

  // Fazer a cópia prova que ela se escreve. Isto prova que se lê — que é a
  // pergunta que só se costuma fazer no dia em que já é tarde.
  async function verificarCopia() {
    setAVerificar(true); setErroVerificacao(''); setVerificacao(null);
    try {
      setVerificacao(await api.post('/api/admin/backup/verificar'));
      load();
    } catch (e) {
      setErroVerificacao(e.message);
    } finally {
      setAVerificar(false);
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

  // Não se pode ativar a 2FA por outra pessoa — se um administrador o fizesse,
  // ficaria com os dois fatores e deixava de haver dois. O que se pode fazer é
  // pedir-lhe, com o prazo à frente.
  async function enviarLembretes() {
    setALembrar(true); setErroLembrete(''); setLembrete(null);
    try {
      setLembrete(await api.post('/api/admin/mfa-lembrete'));
      load();
    } catch (e) {
      setErroLembrete(e.message);
    } finally {
      setALembrar(false);
    }
  }

  const diasDesde = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null);

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

              <div style={{ borderTop: '1px solid var(--line, #f0f0f0)', marginTop: 14, paddingTop: 14 }}>
                <button className="btn btn-ghost btn-sm" onClick={verificarCopia} disabled={aVerificar}>
                  {aVerificar ? t('A ler a cópia…') : t('Verificar a última cópia')}
                </button>
                <p className="bz-muted" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
                  {t('Vai buscá-la ao bucket, descomprime-a e confirma que traz a base toda. Um objeto truncado ou um gzip corrompido são indistinguíveis de uma cópia boa até alguém tentar lê-los.')}
                </p>
                {verificacao ? (
                  <p style={{ margin: '8px 0 0', fontSize: 12.5 }}>
                    ✅ {t('Lida e completa')}: {verificacao.tabelasNoDump} {t('tabelas')}
                    {' · '}{verificacao.blocosDeDados} {t('blocos de dados')}
                    {' · '}{verificacao.megabytes} MB {t('em')} {verificacao.segundos}s.
                    <br />
                    <span className="bz-muted">{verificacao.nota}</span>
                  </p>
                ) : null}
                {erroVerificacao ? <p className="error-text" style={{ margin: '8px 0 0', fontSize: 12.5 }}>{erroVerificacao}</p> : null}
              </div>
            </div>
          ) : null}

          {g.grupo === 'Autenticação de dois fatores' && pendentes?.length ? (
            <div style={{ borderTop: '1px solid var(--line, #f0f0f0)', background: 'var(--surface-2, #fafafa)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="bz-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>{t('Pessoa')}</th><th>{t('Perfil')}</th><th>{t('Empresa')}</th>
                      <th>{t('Último acesso')}</th><th>{t('Último lembrete')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendentes.map((u) => {
                      const dias = diasDesde(u.ultimoLogin);
                      return (
                        <tr key={u.id}>
                          <td><strong>{u.nome}</strong><br /><span className="bz-muted" style={{ fontSize: 12 }}>{u.email}</span></td>
                          <td className="bz-muted">{u.perfil}</td>
                          <td className="bz-muted">{u.empresa || '—'}</td>
                          {/* Quem não entra há muito tempo pode ser uma conta que
                              já ninguém usa — essa desativa-se, em vez de se
                              andar atrás dela. */}
                          {/* Frases completas, não fragmentos: "há 2 dias" e
                              "2 days ago" não têm a mesma ordem de palavras. */}
                          <td className="bz-muted">
                            {dias === null ? t('nunca entrou')
                              : dias === 0 ? t('hoje')
                                : dias === 1 ? t('há 1 dia')
                                  : t('há {n} dias', { n: dias })}
                          </td>
                          <td className="bz-muted">
                            {u.ultimoLembrete
                              ? (diasDesde(u.ultimoLembrete) === 0 ? t('hoje')
                                : diasDesde(u.ultimoLembrete) === 1 ? t('há 1 dia')
                                  : t('há {n} dias', { n: diasDesde(u.ultimoLembrete) }))
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <button className="btn btn-accent btn-sm" onClick={enviarLembretes} disabled={aLembrar}>
                  {aLembrar ? t('A enviar…') : t('Pedir a todos que ativem')}
                </button>
                <p className="bz-muted" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
                  {t('Envia um email a cada pessoa com o prazo e o que acontece quando ele passar. Ninguém é lembrado duas vezes no mesmo dia.')}
                </p>
                {lembrete ? (
                  <p style={{ margin: '8px 0 0', fontSize: 12.5 }}>
                    ✅ {lembrete.enviados.length} {t('enviado(s)')}
                    {lembrete.ignorados.length ? ` · ${lembrete.ignorados.length} ${t('já avisado(s) hoje')}` : ''}
                    {lembrete.falhas.length ? ` · ${lembrete.falhas.length} ${t('falharam')}` : ''}
                    {lembrete.falhas.length ? (
                      <><br /><span className="error-text">{lembrete.falhas.map((f) => `${f.email}: ${f.erro}`).join(' · ')}</span></>
                    ) : null}
                  </p>
                ) : null}
                {erroLembrete ? <p className="error-text" style={{ margin: '8px 0 0', fontSize: 12.5 }}>{erroLembrete}</p> : null}
              </div>
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
