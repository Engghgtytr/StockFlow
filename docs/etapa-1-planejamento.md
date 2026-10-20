# Etapa 1: inspeção e planejamento

## Situação encontrada

A pasta `portifolio linkedin` tinha apenas o documento do plano. Não havia código, repositório Git nem stack anterior, então nada foi apagado ou migrado.

## Stack escolhida

| Camada | Escolha | Por quê |
|---|---|---|
| Interface | HTML + CSS + JavaScript em módulos | Pouca "mágica": dá para entender cada linha. React/TypeScript só se o projeto crescer a ponto de justificar. |
| Ferramenta de build | Vite | Servidor de desenvolvimento rápido e `build` pronto para o Vercel. |
| Dados (etapas 1–2) | `localStorage`, com dados fictícios | Permite testar telas e regras antes de configurar o banco. |
| Dados (etapa 3+) | Supabase (PostgreSQL) | Banco relacional, com RLS para isolar empresas. |
| Login (etapa 4) | Supabase Auth | Evita implementar senhas e tokens por conta própria. |
| Hospedagem (etapa 7) | Vercel | Gratuito para projetos pessoais, com deploy a partir do GitHub. |

## Arquitetura em camadas

```text
páginas (pages/)          → o que aparece na tela e reage a cliques
   │ chamam
componentes (components/) → peças reutilizáveis: modal, toast, formulários, medidor
   │ chamam
serviços (services/)      → ÚNICO lugar que lê/grava dados (hoje localStorage, depois Supabase)
   │ usam
utilitários (utils/)      → funções puras: formatar moeda, validar campos, status do estoque
```

**Decisão importante:** as páginas nunca acessam o `localStorage` diretamente. Na etapa 3, só `services/products.js` e `services/inventory.js` vão mudar para chamar o Supabase. As telas continuam iguais.

## Telas

| Rota | Tela | Estado |
|---|---|---|
| `#/login` | Entrada da demonstração | Funciona (sem senha, só para a demonstração) |
| `#/` | Dashboard: indicadores, reposição e movimentações recentes | Funciona |
| `#/produtos` | Lista, busca, filtros, cadastro, edição e exclusão | Funciona |
| `#/movimentacoes` | Histórico e registro de entrada/saída/ajuste | Funciona |
| Vendas | — | Fora do menu até a versão 2 |

## Modelo de dados (será criado no Supabase na etapa 3)

```text
companies ──< profiles (usuário + papel)
    │
    ├──< products ──< inventory_movements
    │
    └──< (v2) sales ──< sale_items >── products
```

| Tabela | Campos | Regras |
|---|---|---|
| `companies` | `id uuid PK`, `name text not null`, `created_at timestamptz` | — |
| `profiles` | `id uuid PK = auth.users.id`, `company_id uuid FK`, `full_name text`, `role text check (role in ('admin','funcionario'))` | Um usuário pertence a uma empresa |
| `products` | `id uuid PK`, `company_id uuid FK`, `name text not null`, `sku text null`, `category text not null`, `sale_price_cents integer check (>= 0)`, `quantity integer check (>= 0)`, `min_stock integer check (>= 0)`, `created_at`, `updated_at` | `unique (company_id, sku)`; índice em `(company_id, name)` |
| `inventory_movements` | `id uuid PK`, `company_id uuid FK`, `product_id uuid FK`, `type text check (in ('entrada','saida','ajuste'))`, `quantity integer`, `delta integer`, `balance_after integer check (>= 0)`, `reason text`, `created_by uuid FK`, `created_at` | Somente inserção (histórico não é editado) |

Pontos de segurança previstos:

- O `company_id` **não vem do navegador**. Ele é preenchido no banco a partir do perfil do usuário logado (`auth.uid()`).
- RLS em todas as tabelas: cada usuário só lê e grava linhas da própria empresa.
- A movimentação será uma função SQL (`register_movement`) executada em transação, com `select ... for update` no produto. Isso evita que duas saídas simultâneas deixem o estoque negativo.
- Dinheiro em centavos (`integer`), nunca `float`.

## Regras já implementadas no front (e que também irão para o banco)

- A quantidade nunca fica negativa. Uma saída maior que o estoque é bloqueada.
- O SKU, quando preenchido, é único (sem diferenciar maiúsculas e minúsculas).
- A quantidade do produto **não é editável** no formulário. Ela só muda por movimentação, para que toda mudança tenha origem rastreável. O estoque inicial do cadastro vira a primeira entrada.
- O ajuste exige um motivo.
- Os números do dashboard são calculados a partir dos dados, sem valores fixos.

## Lista de tarefas

- [x] Etapa 1: planejamento (este documento)
- [x] Etapa 2: base visual, navegação, estados de carregamento, vazio e erro, CRUD local
- [x] Etapas 3 a 5: migration, Supabase Auth, RLS e funções SQL transacionais (veja `etapa-3-supabase.md`). Falta testar num projeto Supabase real.
- [x] Etapa 6 (parcial): 71 testes automatizados, incluindo RLS no PostgreSQL embutido (`npm test`)
- [x] Etapa 6: auditoria de acessibilidade (axe-core, 7 telas, 0 problemas) e navegação por teclado
- [x] Etapa 7 (preparação): `vercel.json` com cabeçalhos de segurança, `npm audit` zerado, screenshots e roteiro do vídeo
- [x] Etapa 7: publicado no GitHub e na Vercel (https://stock-flow-xi-indol.vercel.app); login, demonstração, celular e cabeçalhos testados na versão publicada
- [ ] Etapa 8: conversar com 3 a 5 comerciantes (roteiro e registro em `etapa-8-validacao.md`)
