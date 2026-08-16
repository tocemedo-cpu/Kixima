// src/components/Button.jsx
// O botão da KIXIMA.
//
// NÃO INTRODUZ APARÊNCIA NOVA. Cada variante mapeia para as classes CSS que já
// existiam em global.css, e o resultado é pixel a pixel o mesmo de antes. Este
// componente existe por outra razão: até aqui não havia componente nenhum —
// eram 197 `className="btn ..."` escritos à mão em 63 páginas, e cada botão
// novo era uma oportunidade para alguém escolher a classe errada.
//
// O QUE A AUDITORIA DIZ E O QUE ESTÁ LÁ. Falava de 19 variantes. São seis, e
// duas delas são a MESMA: `.btn-primary` e `.btn-accent` têm exatamente o mesmo
// fundo e o mesmo hover. Oitenta e cinco usos repartidos por dois nomes que
// produzem o mesmo pixel — é essa a duplicação real, e é a que este componente
// fecha, ao dar um só nome (`primary`) ao botão de marca.
//
// A `variant` descreve o PAPEL e não a cor. Quem escreve `variant="danger"`
// está a dizer "isto destrói alguma coisa", não "isto é vermelho" — e no dia
// em que o vermelho de perigo mudar, muda num sítio.

import { Link } from 'react-router-dom';

// Papel -> classes existentes. Mudar a aparência de um papel faz-se aqui e no
// CSS, e não em 63 páginas.
const VARIANTES = {
  primary: 'btn-accent',    // ação principal da marca (== .btn-primary, idênticos)
  secondary: 'btn-ghost',   // ação alternativa, contorno
  danger: 'btn-danger',     // destrói ou é irreversível
  dark: 'btn-dark',         // sobre superfícies escuras — visualmente distinto, fica
};

// `md` não tem classe porque é o tamanho base do `.btn`. Acrescentar uma classe
// vazia só para haver simetria daria uma regra que não faz nada.
const TAMANHOS = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

/**
 * @param variant primary | secondary | danger | dark
 * @param size    sm | md | lg
 * @param to      quando presente, sai um <Link> em vez de <button> — um botão
 *                que navega deve ser um link, para abrir em nova aba e ser
 *                anunciado como ligação pelos leitores de ecrã.
 */
export default function Button({
  variant = 'secondary',
  size = 'md',
  to,
  href,
  className = '',
  children,
  ...resto
}) {
  const classes = ['btn', VARIANTES[variant] || VARIANTES.secondary, TAMANHOS[size] || '', className]
    .filter(Boolean)
    .join(' ');

  if (to) return <Link to={to} className={classes} {...resto}>{children}</Link>;
  if (href) return <a href={href} className={classes} {...resto}>{children}</a>;
  // `type` por omissão é "submit" dentro de um <form>, e um botão de ação que
  // submete o formulário sem querer é dos enganos mais difíceis de ver.
  return <button type="button" className={classes} {...resto}>{children}</button>;
}
