// src/workers/lerXlsx.js
// Lê um .xlsx num ISOLADO próprio, e devolve só dados simples.
//
// PORQUE É QUE ISTO CORRE À PARTE. A biblioteca `xlsx` (SheetJS) tem duas
// falhas de severidade alta com aviso explícito de "No fix available":
// Prototype Pollution e ReDoS. Não há versão para onde subir.
//
// A alternativa era trocar de biblioteca. Reescrever uma importação que
// funciona, com todos os seus formatos tolerantes de cabeçalho e as fotos
// embebidas, para resolver um problema de CONTENÇÃO, seria trocar um risco
// conhecido por um caminho novo por testar. Aqui contém-se em vez de reescrever.
//
// O ISOLADO RESOLVE AS DUAS, e por razões diferentes:
//
//   Prototype Pollution — um worker do Node tem o seu próprio isolado V8, com
//   os seus próprios protótipos. Poluir Object.prototype aqui dentro não toca
//   no processo principal, e morre quando o worker morre.
//
//   ReDoS — uma expressão regular a arder prende ESTE worker, não o servidor.
//   O lado de fora tem um tempo-limite e mata-o. Sem isto, um ficheiro
//   construído prendia o único processo que serve toda a plataforma.
//
// O QUE ATRAVESSA A FRONTEIRA são apenas linhas de valores primitivos. Devolver
// o objeto do workbook traria de volta, por estrutura clonada, aquilo que se
// veio isolar.

const { parentPort, workerData } = require('worker_threads');
const XLSX = require('xlsx');

function escolherFolha(wb, nomes) {
  for (const n of wb.SheetNames) {
    if (nomes.includes(String(n).trim().toLowerCase())) return wb.Sheets[n];
  }
  return null;
}

try {
  const { buffer, nomesDeFolha } = workerData;
  const wb = XLSX.read(Buffer.from(buffer), { type: 'buffer' });

  const ws = escolherFolha(wb, nomesDeFolha) || wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    parentPort.postMessage({ ok: false, erro: 'VAZIO' });
  } else {
    const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    // `JSON.parse(JSON.stringify(...))` de propósito: garante que só
    // atravessam valores simples, sem protótipos nem getters vindos da
    // biblioteca.
    parentPort.postMessage({ ok: true, linhas: JSON.parse(JSON.stringify(linhas)) });
  }
} catch (err) {
  parentPort.postMessage({ ok: false, erro: 'ILEGIVEL', detalhe: String(err && err.message).slice(0, 200) });
}
