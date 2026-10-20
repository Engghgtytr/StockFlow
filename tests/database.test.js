// Testes do banco: roda a migration real num PostgreSQL embutido (PGlite)
// e verifica RLS, permissões e as regras de estoque das funções SQL.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const ALICE = '00000000-0000-0000-0000-00000000000a';
const BRUNO = '00000000-0000-0000-0000-00000000000b';

let db;

// Executa uma consulta "como" um usuário (ou como visitante anônimo),
// do mesmo jeito que o Supabase faz a cada requisição.
async function as(userId, query, params = []) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
  try {
    return (await db.query(query, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

const createProduct = (user, name, sku, quantity) =>
  as(user, 'select * from public.create_product($1, $2, $3, $4, $5, $6)', [name, sku, 'Teste', 1990, 2, quantity]);

const move = (user, productId, type, quantity, reason = null) =>
  as(user, 'select * from public.register_movement($1, $2, $3, $4)', [productId, type, quantity, reason]);

let aliceProduct;
let brunoProduct;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(sql('../supabase/tests/supabase-stub.sql'));
  await db.exec(sql('../supabase/migrations/001_initial_schema.sql'));

  // Cadastro de duas contas: o gatilho cria empresa e perfil para cada uma.
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ($1, 'alice@exemplo.com', '{"full_name":"Alice","company_name":"Loja da Alice"}'),
       ($2, 'bruno@exemplo.com', '{"full_name":"Bruno","company_name":"Loja do Bruno"}')`,
    [ALICE, BRUNO],
  );

  [aliceProduct] = await createProduct(ALICE, 'Ração', 'rac-1', 10);
  [brunoProduct] = await createProduct(BRUNO, 'Coleira', 'COL-1', 4);
}, 30000);

describe('cadastro de conta', () => {
  it('cria empresa e perfil admin automaticamente', async () => {
    const rows = await as(ALICE, `select p.full_name, p.role, c.name as company
                                  from public.profiles p join public.companies c on c.id = p.company_id`);
    expect(rows).toEqual([{ full_name: 'Alice', role: 'admin', company: 'Loja da Alice' }]);
  });
});

describe('isolamento entre empresas (RLS)', () => {
  it('cada usuário só vê os produtos da própria empresa', async () => {
    const alice = await as(ALICE, 'select name from public.products');
    const bruno = await as(BRUNO, 'select name from public.products');
    expect(alice.map((r) => r.name)).toEqual(['Ração']);
    expect(bruno.map((r) => r.name)).toEqual(['Coleira']);
  });

  it('não vê movimentações nem empresas de outra loja', async () => {
    const moves = await as(ALICE, 'select product_name from public.inventory_movements');
    expect(moves.every((m) => m.product_name === 'Ração')).toBe(true);
    expect(await as(ALICE, 'select name from public.companies')).toEqual([{ name: 'Loja da Alice' }]);
  });

  it('não consegue editar nem excluir produto de outra loja', async () => {
    const updated = await as(ALICE, `update public.products set name = 'Hackeado' where id = $1 returning id`, [brunoProduct.id]);
    const deleted = await as(ALICE, 'delete from public.products where id = $1 returning id', [brunoProduct.id]);
    expect(updated).toEqual([]);
    expect(deleted).toEqual([]);
    const [still] = await as(BRUNO, 'select name from public.products where id = $1', [brunoProduct.id]);
    expect(still.name).toBe('Coleira');
  });

  it('não consegue movimentar estoque de outra loja', async () => {
    await expect(move(ALICE, brunoProduct.id, 'saida', 1)).rejects.toThrow('Produto não encontrado.');
  });

  it('visitante sem login não lê nada', async () => {
    await expect(as(null, 'select * from public.products')).rejects.toThrow(/permission denied/);
    await expect(as(null, 'select public.current_company_id()')).rejects.toThrow(/permission denied/);
  });
});

describe('quantidade só muda pelas funções de estoque', () => {
  it('bloqueia alterar a quantidade direto na tabela', async () => {
    await expect(
      as(ALICE, 'update public.products set quantity = 999 where id = $1', [aliceProduct.id]),
    ).rejects.toThrow(/permission denied/);
  });

  it('bloqueia inserir produto direto na tabela (sem histórico)', async () => {
    await expect(
      as(ALICE, `insert into public.products (company_id, name, category, sale_price_cents, quantity)
                 values (public.current_company_id(), 'X', 'Y', 100, 50)`),
    ).rejects.toThrow(/permission denied/);
  });

  it('bloqueia escrever direto no histórico', async () => {
    await expect(
      as(ALICE, `insert into public.inventory_movements (company_id, product_name, type, quantity, delta, balance_after)
                 values (public.current_company_id(), 'X', 'entrada', 1, 1, 1)`),
    ).rejects.toThrow(/permission denied/);
  });

  it('permite editar nome e preço', async () => {
    const [row] = await as(ALICE, `update public.products set name = 'Ração 3 kg', sale_price_cents = 2500
                                   where id = $1 returning name, sale_price_cents, quantity`, [aliceProduct.id]);
    expect(row).toEqual({ name: 'Ração 3 kg', sale_price_cents: 2500, quantity: 10 });
  });
});

describe('create_product', () => {
  it('registra o estoque inicial como primeira movimentação', async () => {
    const rows = await as(ALICE, 'select type, delta, reason, created_by_name from public.inventory_movements where product_id = $1', [aliceProduct.id]);
    expect(rows).toEqual([{ type: 'entrada', delta: 10, reason: 'Estoque inicial no cadastro', created_by_name: 'Alice' }]);
  });

  it('guarda o SKU em maiúsculas e bloqueia duplicado na mesma loja', async () => {
    expect(aliceProduct.sku).toBe('RAC-1');
    await expect(createProduct(ALICE, 'Outra', 'RAC-1', 0)).rejects.toThrow('Já existe um produto com este SKU.');
  });

  it('permite o mesmo SKU em lojas diferentes', async () => {
    const [p] = await createProduct(BRUNO, 'Ração do Bruno', 'RAC-1', 0);
    expect(p.sku).toBe('RAC-1');
  });
});

describe('register_movement', () => {
  it('entrada e saída atualizam saldo e histórico', async () => {
    const [entrada] = await move(ALICE, aliceProduct.id, 'entrada', 5);
    const [saida] = await move(ALICE, aliceProduct.id, 'saida', 3);
    expect(entrada).toMatchObject({ delta: 5, balance_after: 15 });
    expect(saida).toMatchObject({ delta: -3, balance_after: 12, created_by_name: 'Alice' });
  });

  it('impede estoque negativo sem gravar nada', async () => {
    const before = await as(ALICE, 'select count(*)::int as n from public.inventory_movements');
    await expect(move(ALICE, aliceProduct.id, 'saida', 999)).rejects.toThrow('Há apenas 12 unidade(s) em estoque.');
    const [{ quantity }] = await as(ALICE, 'select quantity from public.products where id = $1', [aliceProduct.id]);
    const after = await as(ALICE, 'select count(*)::int as n from public.inventory_movements');
    expect(quantity).toBe(12);
    expect(after).toEqual(before);
  });

  it('ajuste exige motivo e define a contagem', async () => {
    await expect(move(ALICE, aliceProduct.id, 'ajuste', 8)).rejects.toThrow(/motivo/);
    const [ajuste] = await move(ALICE, aliceProduct.id, 'ajuste', 8, 'Contagem');
    expect(ajuste).toMatchObject({ delta: -4, balance_after: 8 });
  });

  it('informa o campo com erro via hint', async () => {
    try {
      await move(ALICE, aliceProduct.id, 'saida', 0);
      expect.unreachable();
    } catch (err) {
      expect(err.hint).toBe('quantity');
    }
  });

  it('excluir o produto mantém o histórico', async () => {
    const [p] = await createProduct(ALICE, 'Temporário', null, 2);
    await as(ALICE, 'delete from public.products where id = $1', [p.id]);
    const rows = await as(ALICE, `select product_id from public.inventory_movements where product_name = 'Temporário'`);
    expect(rows).toEqual([{ product_id: null }]);
  });
});
