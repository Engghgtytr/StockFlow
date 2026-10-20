# Etapas 3 a 5: banco de dados, login e segurança (Supabase)

As etapas 3 (banco), 4 (login + RLS) e 5 (movimentações seguras) foram feitas juntas porque dependem umas das outras: uma tabela sem RLS fica aberta para qualquer pessoa com a chave pública, e o RLS precisa saber quem está logado para filtrar por empresa.

## Como configurar (passo a passo)

### 1. Criar o projeto

1. Crie uma conta em https://supabase.com (dá para entrar com o GitHub).
2. **New project**: escolha um nome (ex.: `stockflow`), uma senha forte para o banco (guarde num gerenciador de senhas) e a região **South America (São Paulo)**.
3. Espere o projeto terminar de ser criado (1 a 2 minutos).

### 2. Criar as tabelas

1. No menu lateral, abra **SQL Editor** → **New query**.
2. Copie **todo** o conteúdo de `supabase/migrations/001_initial_schema.sql`, cole e clique em **Run**.
3. Deve aparecer "Success. No rows returned". Em **Table Editor** você verá `companies`, `profiles`, `products` e `inventory_movements`, todas com o selo **RLS enabled**.

> Rode a migration **uma vez só**. Se rodar de novo, vai dar erro de "already exists". Isso é esperado e não estraga nada.

### 3. Ligar o app ao projeto

1. Em **Project Settings → API** (ou **Connect**), copie:
   - **Project URL**;
   - a chave **anon** / **publishable**. Ela é **pública** e pode ir para o navegador, porque quem protege os dados é o RLS.
2. Na pasta `stockflow`, copie `.env.example` para `.env` e preencha:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=cole-a-chave-anon-aqui
   ```
3. Reinicie o `npm.cmd run dev`. O Vite só lê o `.env` ao iniciar.

> ⚠️ **Nunca** use a chave `service_role` / `secret` no `.env` do frontend. Ela ignora o RLS e dá acesso total ao banco.

### 4. Confirmação de e-mail

Por padrão, o Supabase envia um link de confirmação ao criar a conta. O app já mostra a mensagem "Confirme seu e-mail".

- O e-mail gratuito do Supabase tem limite baixo (poucos por hora). Para testar à vontade, desative em **Authentication → Sign In / Providers → Email → Confirm email**.
- Se mantiver a confirmação ativa, em **Authentication → URL Configuration** coloque `http://localhost:5173` como **Site URL** (e depois o endereço publicado).

## Como a segurança funciona

```text
navegador (chave pública)          Supabase
──────────────────────────         ─────────────────────────────────────────
login → token JWT do usuário  ──►  auth.uid() = id do usuário
select * from products        ──►  RLS: só linhas com company_id = empresa do usuário
update products set quantity  ──►  ❌ sem permissão (coluna bloqueada)
rpc('register_movement')      ──►  função SQL: trava o produto, valida, atualiza
                                   o saldo e grava o histórico, tudo ou nada
```

| Proteção | Onde está |
|---|---|
| Cada loja só vê os próprios dados | Políticas RLS usando `current_company_id()` |
| `company_id` não vem do navegador | Preenchido pelas funções SQL a partir do usuário logado |
| Visitante sem login não lê nada | Privilégios revogados do papel `anon` |
| Estoque nunca negativo | `check (quantity >= 0)` + validação em `register_movement` |
| Quantidade só muda com histórico | `update` liberado só para nome, SKU, categoria, preço e mínimo; criação e movimentação só pelas funções |
| Duas saídas ao mesmo tempo | `select ... for update` trava a linha do produto |
| SKU único por loja | Índice único `(company_id, sku)` |
| Dinheiro sem erro de arredondamento | Coluna `integer` em centavos |

## Testes

### Automáticos (já rodam no seu PC, sem Supabase)

```bash
npm.cmd test
```

`tests/database.test.js` executa a migration real num PostgreSQL embutido ([PGlite](https://pglite.dev)), simulando dois usuários de lojas diferentes. Os testes verificam:

- se o cadastro cria a empresa e o perfil;
- se a loja A **não** vê, edita, exclui nem movimenta os dados da loja B;
- se um visitante sem login não lê nada;
- se é impossível alterar a quantidade direto na tabela ou gravar histórico falso;
- se o estoque negativo é bloqueado sem gravar nada;
- se excluir um produto mantém o histórico.

O arquivo `supabase/tests/supabase-stub.sql` imita só o necessário do Supabase (`auth.uid()` e os papéis `anon` e `authenticated`). **Não** rode esse arquivo no seu projeto.

### Manuais (depois de configurar)

1. Crie a conta **A** e cadastre um produto.
2. Em outra janela anônima, crie a conta **B**. A lista de produtos tem que aparecer **vazia**.
3. Na conta A, tente uma saída maior que o estoque: o erro aparece no campo de quantidade.
4. Recarregue a página: você continua logado e os dados continuam lá.
5. Clique em **Sair** e tente abrir `#/produtos`: o app volta para o login.
6. Desligue a internet e tente salvar: aparece "Sem conexão com o servidor".
7. Abra o app no celular (mesma conta): os dados são os mesmos.

## Limitações conhecidas

- A busca e os filtros rodam no navegador depois de baixar os produtos. Isso basta para uma loja pequena, mas com milhares de produtos o ideal seria filtrar no banco.
- O histórico mostra as 500 movimentações mais recentes, sem paginação ainda.
- Cada conta cria a própria loja. Convidar funcionários para a mesma loja fica para a versão 3.
- Ainda não existe tela de "esqueci minha senha" nem troca de senha.
- Backups: o plano gratuito do Supabase não inclui backups automáticos para restaurar. Não use para dados comerciais reais sem rever isso.
