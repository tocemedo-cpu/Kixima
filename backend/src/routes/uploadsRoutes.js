// src/routes/uploadsRoutes.js
// Serve os ficheiros carregados (fotos de produto, avatares, documentos de
// credenciamento, comprovativos de pagamento, anexos de chat) em modo de
// armazenamento 'local' — em modo 's3' o URL devolvido pelo storageService já
// aponta diretamente para o bucket, e este ficheiro nunca é tocado.
//
// Antes, `express.static` servia esta pasta inteira a QUALQUER pedido, sem
// sessão nem verificação de posse — bastava adivinhar/conhecer o nome do
// ficheiro para descarregar um comprovativo de pagamento ou um documento de
// credenciamento de outra empresa. Ver uploadAccessService.js para a decisão
// de quem pode ver cada ficheiro.
const express = require('express');
const path = require('path');
const { optionalAuthenticate } = require('../middleware/auth');
const storageService = require('../services/storageService');
const uploadAccessService = require('../services/uploadAccessService');
const fileSignature = require('../utils/fileSignature');

const router = express.Router();

// O nome é sempre gerado no servidor (storageService.buildFilename) — nunca
// contém '/' nem '..'. Isto só recusa pedidos manifestamente forjados antes
// de tocar a base de dados ou o disco.
const NOME_VALIDO = /^[a-z0-9-]+\.[a-z0-9]+$/i;

function ficheiroNaoEncontrado(res) {
  return res.status(404).json({
    error: {
      code: 'FILE_NOT_FOUND',
      message: 'Este ficheiro já não está disponível. Peça para o documento ser enviado novamente.',
    },
  });
}

router.get('/:filename', optionalAuthenticate, async (req, res) => {
  const { filename } = req.params;
  if (!NOME_VALIDO.test(filename)) return ficheiroNaoEncontrado(res);

  const acesso = await uploadAccessService.resolverAcesso(filename, req.user || null);
  if (!acesso.publico && !acesso.permitido) {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Inicie sessão para aceder a este ficheiro.' } });
    }
    // 404 e não 403: não se confirma a um utilizador sem posse que o ficheiro
    // existe — mesmo raciocínio já usado no resto da API (ver contractService).
    return ficheiroNaoEncontrado(res);
  }

  let buffer;
  try {
    buffer = await storageService.lerFicheiro(filename);
  } catch {
    return ficheiroNaoEncontrado(res);
  }

  const detetado = fileSignature.detetar(buffer);
  res.set('Content-Type', detetado?.tipo || 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${path.basename(filename)}"`);
  // Público (imagem de catálogo/avatar): pode ficar em cache do browser por
  // muito tempo, o nome já é único por upload. Privado: nunca em cache
  // partilhada nem em disco — é um documento fiscal ou um comprovativo.
  res.set('Cache-Control', acesso.publico ? 'public, max-age=31536000, immutable' : 'private, no-store');
  res.send(buffer);
});

module.exports = router;
