-- =====================================================================
-- StockFlow: esquema inicial (empresas, perfis, produtos, movimentações)
--
-- Princípios:
--   1. Cada usuário pertence a UMA empresa e só enxerga dados dela (RLS).
--   2. O company_id nunca vem do navegador: é descoberto pelo usuário logado.
--   3. A quantidade em estoque só muda por funções que também gravam o
--      histórico, dentro de uma transação e com bloqueio da linha do produto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  full_name  text not null check (char_length(trim(full_name)) between 1 and 80),
  role       text not null default 'admin' check (role in ('admin', 'funcionario')),
  created_at timestamptz not null default now()
);

create index profiles_company_id_idx on public.profiles (company_id);

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 1 and 120),
  sku              text check (sku is null or (sku = upper(trim(sku)) and char_length(sku) between 1 and 40)),
  category         text not null check (char_length(trim(category)) between 1 and 60),
  sale_price_cents integer not null check (sale_price_cents >= 0),  -- dinheiro em centavos
  quantity         integer not null default 0 check (quantity >= 0), -- nunca negativo
  min_stock        integer not null default 0 check (min_stock >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- SKU único POR EMPRESA (duas lojas podem usar o mesmo código).
create unique index products_company_sku_key on public.products (company_id, sku) where sku is not null;
create index products_company_name_idx on public.products (company_id, name);

create table public.inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  -- Se o produto for excluído, o histórico fica (com o nome guardado abaixo).
  product_id      uuid references public.products (id) on delete set null,
  product_name    text not null,
  type            text not null check (type in ('entrada', 'saida', 'ajuste')),
  quantity        integer not null check (quantity >= 0),
  delta           integer not null,
  balance_after   integer not null check (balance_after >= 0),
  reason          text check (reason is null or char_length(reason) <= 200),
  created_by      uuid references auth.users (id) on delete set null,
  created_by_name text,
  created_at      timestamptz not null default now()
);

create index inventory_movements_company_created_idx on public.inventory_movements (company_id, created_at desc);
create index inventory_movements_product_idx on public.inventory_movements (product_id);

-- ---------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------

-- Empresa do usuário logado. "security definer" permite ler profiles sem
-- cair na própria política de RLS (evita recursão).
create function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- Ao criar uma conta, cria também a empresa e o perfil (papel admin).
-- Na versão 3, convites vão permitir entrar numa empresa já existente.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  insert into public.companies (name)
  values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'company_name'), ''), 'Minha loja'))
  returning id into v_company_id;

  insert into public.profiles (id, company_id, full_name, role)
  values (
    new.id,
    v_company_id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    'admin'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Operações de estoque (únicas portas de entrada para mudar quantidade)
-- Erros usam "hint" com o nome do campo, para a tela marcar o campo certo.
-- ---------------------------------------------------------------------

create function public.create_product(
  p_name text,
  p_sku text,
  p_category text,
  p_sale_price_cents integer,
  p_min_stock integer,
  p_quantity integer
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := public.current_company_id();
  v_product    public.products;
begin
  if v_company_id is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 0 then
    raise exception 'Use um número inteiro, zero ou maior.' using errcode = '22023', hint = 'quantity';
  end if;

  begin
    insert into public.products (company_id, name, sku, category, sale_price_cents, min_stock, quantity)
    values (v_company_id, trim(p_name), nullif(upper(trim(p_sku)), ''), trim(p_category),
            p_sale_price_cents, p_min_stock, p_quantity)
    returning * into v_product;
  exception when unique_violation then
    raise exception 'Já existe um produto com este SKU.' using errcode = '23505', hint = 'sku';
  end;

  -- Estoque inicial também entra no histórico: nenhuma unidade "aparece do nada".
  if p_quantity > 0 then
    insert into public.inventory_movements
      (company_id, product_id, product_name, type, quantity, delta, balance_after, reason, created_by, created_by_name)
    select v_company_id, v_product.id, v_product.name, 'entrada', p_quantity, p_quantity, p_quantity,
           'Estoque inicial no cadastro', auth.uid(), p.full_name
    from public.profiles p where p.id = auth.uid();
  end if;

  return v_product;
end;
$$;

create function public.register_movement(
  p_product_id uuid,
  p_type text,
  p_quantity integer,
  p_reason text
)
returns public.inventory_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := public.current_company_id();
  v_reason     text := nullif(trim(p_reason), '');
  v_product    public.products;
  v_delta      integer;
  v_movement   public.inventory_movements;
begin
  if v_company_id is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;

  -- "for update" trava a linha do produto até o fim da transação:
  -- duas saídas ao mesmo tempo não conseguem deixar o estoque negativo.
  select * into v_product
  from public.products
  where id = p_product_id and company_id = v_company_id
  for update;

  if not found then
    raise exception 'Produto não encontrado.' using errcode = 'P0002', hint = 'productId';
  end if;
  if p_type is null or p_type not in ('entrada', 'saida', 'ajuste') then
    raise exception 'Escolha o tipo de movimentação.' using errcode = '22023', hint = 'type';
  end if;
  if p_quantity is null or p_quantity < 0 then
    raise exception 'Use um número inteiro, zero ou maior.' using errcode = '22023', hint = 'quantity';
  end if;
  if p_type <> 'ajuste' and p_quantity = 0 then
    raise exception 'A quantidade precisa ser maior que zero.' using errcode = '22023', hint = 'quantity';
  end if;
  if v_reason is not null and char_length(v_reason) > 200 then
    raise exception 'Use no máximo 200 caracteres.' using errcode = '22023', hint = 'reason';
  end if;
  if p_type = 'ajuste' and v_reason is null then
    raise exception 'Explique o motivo do ajuste (ex.: contagem, avaria).' using errcode = '22023', hint = 'reason';
  end if;

  v_delta := case p_type
    when 'entrada' then p_quantity
    when 'saida' then -p_quantity
    else p_quantity - v_product.quantity
  end;

  if p_type = 'ajuste' and v_delta = 0 then
    raise exception 'A contagem é igual ao estoque atual; não há o que ajustar.' using errcode = '22023', hint = 'quantity';
  end if;
  if v_product.quantity + v_delta < 0 then
    raise exception 'Há apenas % unidade(s) em estoque.', v_product.quantity using errcode = '23514', hint = 'quantity';
  end if;

  update public.products set quantity = quantity + v_delta where id = v_product.id;

  insert into public.inventory_movements
    (company_id, product_id, product_name, type, quantity, delta, balance_after, reason, created_by, created_by_name)
  select v_company_id, v_product.id, v_product.name, p_type, p_quantity, v_delta,
         v_product.quantity + v_delta, v_reason, auth.uid(), p.full_name
  from public.profiles p where p.id = auth.uid()
  returning * into v_movement;

  return v_movement;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- (select ...) em volta da função faz o Postgres calcular uma vez por consulta.
-- ---------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;

create policy "Ver a própria empresa"
on public.companies for select to authenticated
using (id = (select public.current_company_id()));

create policy "Ver perfis da própria empresa"
on public.profiles for select to authenticated
using (company_id = (select public.current_company_id()));

create policy "Ver produtos da própria empresa"
on public.products for select to authenticated
using (company_id = (select public.current_company_id()));

create policy "Editar produtos da própria empresa"
on public.products for update to authenticated
using (company_id = (select public.current_company_id()))
with check (company_id = (select public.current_company_id()));

create policy "Excluir produtos da própria empresa"
on public.products for delete to authenticated
using (company_id = (select public.current_company_id()));

create policy "Ver movimentações da própria empresa"
on public.inventory_movements for select to authenticated
using (company_id = (select public.current_company_id()));

-- ---------------------------------------------------------------------
-- Permissões (defesa extra além do RLS)
-- ---------------------------------------------------------------------
-- Visitantes sem login (anon) não acessam nada.
revoke all on public.companies, public.profiles, public.products, public.inventory_movements from anon;

-- Usuários logados:
--   - empresas, perfis e histórico: só leitura;
--   - produtos: criar só via create_product(); editar só campos que NÃO são
--     a quantidade (ela muda apenas por register_movement()).
revoke insert, update, delete on public.companies, public.profiles, public.inventory_movements from authenticated;
revoke insert, update on public.products from authenticated;
grant update (name, sku, category, sale_price_cents, min_stock) on public.products to authenticated;

-- Funções: ninguém além de usuários logados pode chamá-las.
revoke execute on function public.current_company_id() from public, anon;
revoke execute on function public.create_product(text, text, text, integer, integer, integer) from public, anon;
revoke execute on function public.register_movement(uuid, text, integer, text) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

grant execute on function public.current_company_id() to authenticated;
grant execute on function public.create_product(text, text, text, integer, integer, integer) to authenticated;
grant execute on function public.register_movement(uuid, text, integer, text) to authenticated;
