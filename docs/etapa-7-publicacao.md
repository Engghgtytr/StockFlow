# Etapa 7: publicação

Como colocar o StockFlow no ar (GitHub + Vercel) com segurança, e o que conferir depois.

## O que já foi preparado

| Item | Estado |
|---|---|
| `vercel.json` com cabeçalhos de segurança (CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy) | ✅ Testado localmente: nenhum bloqueio, fonte e Supabase funcionando |
| `npm audit` | ✅ 0 vulnerabilidades (Vite 8, Vitest 5 e supabase-js atualizados) |
| Busca por segredos no código e no build | ✅ Nenhuma chave secreta; só a chave pública `anon` |
| `.env` fora do Git | ✅ Está no `.gitignore` |
| Acessibilidade (axe-core, 7 telas) | ✅ 0 problemas depois da correção de contraste |
| Teclado | ✅ O foco entra no modal e volta ao botão ao fechar |
| Screenshots | ✅ Em `docs/screenshots/` |
| Roteiro do vídeo | ✅ Em `docs/roteiro-demonstracao.md` |

## Passo a passo

### 1. Criar o repositório no GitHub

1. Crie uma conta em https://github.com, se ainda não tiver.
2. Clique em **New repository** e use o nome `stockflow`, **Public** (para portfólio). **Não** marque "Add a README", porque o projeto já tem um.
3. Na pasta `stockflow`, no terminal:

   ```powershell
   git init
   git add .
   git status
   ```

   **Confira no `git status` que NÃO aparecem** `.env`, `node_modules/` nem `dist/`. Se aparecer, pare e revise o `.gitignore`.

   ```powershell
   git commit -m "StockFlow: primeira versão"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/stockflow.git
   git push -u origin main
   ```

### 2. Publicar na Vercel

1. Entre em https://vercel.com com a conta do GitHub.
2. **Add New → Project** e importe o repositório `stockflow`.
3. Framework: **Vite**. O build já vem do `vercel.json` (`npm run build` → `dist`).
4. Em **Environment Variables**, adicione as duas variáveis **públicas**:
   - `VITE_SUPABASE_URL` = a URL do projeto
   - `VITE_SUPABASE_ANON_KEY` = a chave `anon`
5. Clique em **Deploy**. Em cerca de 1 minuto sai um endereço como `stockflow-xxx.vercel.app`.

> ⚠️ Nunca cadastre a `service_role` na Vercel para este projeto: o frontend não precisa dela.

### 3. Avisar o Supabase sobre o novo endereço

Em **Supabase → Authentication → URL Configuration**:

- **Site URL:** `https://stockflow-xxx.vercel.app`
- **Redirect URLs:** adicione `https://stockflow-xxx.vercel.app` e mantenha `http://localhost:5173` para continuar testando no PC.

Sem isso, o link de confirmação de e-mail leva para o endereço errado.

### 4. Testar a versão publicada (não só a local)

- [ ] Abrir o site numa aba anônima: a abertura toca e a tela de login aparece.
- [ ] "Explorar a demonstração" funciona.
- [ ] Criar uma conta nova (com outro e-mail) e cadastrar um produto.
- [ ] Em outra aba anônima, com outra conta: a lista aparece **vazia** (RLS funcionando).
- [ ] F12 → Console: **nenhum** erro de "Content Security Policy".
- [ ] Abrir no celular.
- [ ] https://securityheaders.com com o endereço: nota esperada **A** ou **A+**.
- [ ] https://developer.mozilla.org/en-US/observatory com o endereço.

### 5. Depois de publicar

- Coloque o link no README (seção "Demonstração") e no LinkedIn.
- Grave o vídeo seguindo `docs/roteiro-demonstracao.md`.
- Projetos gratuitos do Supabase **pausam após cerca de 1 semana sem uso**. Antes de mandar o link para alguém, abra o site para "acordar" o banco ou reative no painel.

## Se algo der errado

| Problema | Causa provável | Solução |
|---|---|---|
| Só aparece "Explorar a demonstração" | Variáveis não cadastradas na Vercel | Cadastre-as e faça **Redeploy** (as variáveis entram no build) |
| Erro "Content Security Policy" no console | Algum domínio novo não liberado | Adicione o domínio na diretiva indicada no erro, em `vercel.json` |
| Link do e-mail abre `localhost` | Site URL do Supabase | Passo 3 |
| "Sem conexão com o servidor" | Projeto Supabase pausado | Reative no painel do Supabase |
