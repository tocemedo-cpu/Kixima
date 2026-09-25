# Storage: PostgreSQL ≠ ficheiros

**A migração da base de dados não move ficheiros.** O `pg_dump` copia as
linhas das tabelas, e nelas só existem os **URLs** dos ficheiros
(`image_url`, `file_url`, `document_url`, `logo_url`, `avatar_url`,
`proof_url`, `comprovativo_url`, `attachment_url`). Os bytes vivem no
Supabase Storage, acedido pela aplicação como um S3 qualquer
(`STORAGE_PROVIDER=s3`, `STORAGE_ENDPOINT=https://<ref>.supabase.co/storage/v1/s3`,
bucket `product-images`, `STORAGE_PUBLIC_URL=https://<ref>.supabase.co/storage/v1/object/public/product-images`)
e as cópias de segurança automáticas (`BACKUP_CRON`) vão para `STORAGE_BACKUP_BUCKET`.

## O que acontece se só a base migrar

Nada parte: as linhas restauradas apontam aos mesmos URLs públicos do
Supabase, o browser continua a carregá-los, e a aplicação continua a gravar
ficheiros novos no mesmo bucket, porque as variáveis `STORAGE_*` não mudam.
É a opção recomendada para o dia da migração da base — **uma coisa de cada
vez**.

Fica uma dependência residual do Supabase (o projecto tem de continuar a
existir, com o Storage activo) até o Storage migrar.

## Se o Storage também tiver de migrar (projecto separado)

1. **Escolher o destino** S3-compatível (MinIO próprio, Cloudflare R2, AWS S3,
   Backblaze). A aplicação não precisa de mudar: só as variáveis
   `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`,
   `STORAGE_SECRET_KEY`, `STORAGE_PUBLIC_URL`, `STORAGE_FORCE_PATH_STYLE`,
   `STORAGE_BACKUP_BUCKET`.
2. **Copiar os objectos** bucket a bucket com uma ferramenta S3 (`rclone sync`
   ou `aws s3 sync` com o endpoint do Supabase como origem: as chaves S3 do
   Supabase estão em Project Settings → Storage → S3 access keys). Confirmar
   número de objectos e bytes nos dois lados.
3. **Reescrever os URLs na base**: as colunas acima guardam o URL público
   completo com o host antigo. Um `UPDATE … SET coluna = replace(coluna,
   '<STORAGE_PUBLIC_URL antigo>', '<novo>')` por coluna, dentro de uma
   transacção, depois de contar quantas linhas contêm o host antigo. Fazer
   isto **depois** de a cópia dos objectos estar confirmada e **antes** de
   apontar a aplicação ao novo Storage.
4. **CSP**: `backend/src/config/csp.js` autoriza imagens do host de
   `STORAGE_PUBLIC_URL`; ao mudar a variável, a política acompanha. Durante a
   transição, se houver URLs antigos ainda na base, o host antigo tem de
   continuar autorizado.
5. **Anexos privados** (`attachment_url` do suporte e do chat, `proof_url`,
   `comprovativo_url`, `document_url`): são servidos pela aplicação
   (`/api/uploads/...`), não directamente pelo bucket — confirmar que o
   novo bucket é lido pelas mesmas credenciais.
6. **Cópias de segurança**: repetir o `npm run backup` e o
   `npm run backup:restore-test` contra o novo bucket antes de desligar o
   antigo.

Só depois de tudo isto o projecto Supabase pode ser desligado.
