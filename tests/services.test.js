import { describe, it, expect, beforeEach } from 'vitest';
import { resetDemo, read } from '../src/services/store.js';
import { createProduct, updateProduct, deleteProduct, listProducts } from '../src/services/products.js';
import { registerMovement, listMovements, getDashboardSummary } from '../src/services/inventory.js';
import { ValidationError } from '../src/utils/validators.js';

// Cada teste começa com os dados fictícios originais.
beforeEach(() => resetDemo());

const product = (id) => read().products.find((p) => p.id === id);

describe('movimentações de estoque', () => {
  it('entrada soma ao estoque e registra o saldo', async () => {
    const { movement } = await registerMovement({ productId: 'p2', type: 'entrada', quantity: '10' });
    expect(product('p2').quantity).toBe(13);
    expect(movement).toMatchObject({ delta: 10, balanceAfter: 13, productName: 'Petisco de frango 100 g' });
  });

  it('saída subtrai do estoque', async () => {
    await registerMovement({ productId: 'p1', type: 'saida', quantity: '4' });
    expect(product('p1').quantity).toBe(10);
  });

  it('ajuste define a contagem real e guarda a diferença', async () => {
    const { movement } = await registerMovement({ productId: 'p4', type: 'ajuste', quantity: '20', reason: 'Inventário' });
    expect(product('p4').quantity).toBe(20);
    expect(movement.delta).toBe(-2);
  });

  it('não deixa o estoque ficar negativo e não grava nada', async () => {
    const before = structuredClone(read());
    await expect(registerMovement({ productId: 'p2', type: 'saida', quantity: '50' })).rejects.toBeInstanceOf(ValidationError);
    // "Transação": nem o saldo nem o histórico mudaram.
    expect(read()).toEqual(before);
  });

  it('recusa produto inexistente', async () => {
    await expect(registerMovement({ productId: 'nao-existe', type: 'entrada', quantity: '1' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('lista o histórico do mais recente para o mais antigo', async () => {
    await registerMovement({ productId: 'p1', type: 'entrada', quantity: '1' });
    const [first, second] = await listMovements();
    expect(first.createdAt >= second.createdAt).toBe(true);
    expect(first.productId).toBe('p1');
  });

  it('filtra o histórico por tipo', async () => {
    const rows = await listMovements({ type: 'ajuste' });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((m) => m.type === 'ajuste')).toBe(true);
  });
});

describe('produtos', () => {
  const novo = { name: 'Bebedouro', category: 'Acessórios', salePrice: '15,00', minStock: '2', quantity: '5' };

  it('o estoque inicial vira a primeira movimentação (origem rastreável)', async () => {
    const created = await createProduct(novo);
    const history = await listMovements({ productId: created.id });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ type: 'entrada', delta: 5, reason: 'Estoque inicial no cadastro' });
  });

  it('não cria movimentação quando o estoque inicial é zero', async () => {
    const created = await createProduct({ ...novo, quantity: '0' });
    expect(await listMovements({ productId: created.id })).toHaveLength(0);
  });

  it('bloqueia SKU duplicado', async () => {
    await expect(createProduct({ ...novo, sku: 'ARE-4' })).rejects.toMatchObject({ errors: { sku: expect.any(String) } });
  });

  it('editar não altera a quantidade', async () => {
    await updateProduct('p1', { name: 'Ração nova', category: 'Alimentação', salePrice: '90', minStock: '6', quantity: '999' });
    expect(product('p1')).toMatchObject({ name: 'Ração nova', quantity: 14, salePriceCents: 9000 });
  });

  it('excluir mantém o histórico do produto', async () => {
    await deleteProduct('p3');
    expect(product('p3')).toBeUndefined();
    expect((await listMovements({ productId: 'p3' })).length).toBeGreaterThan(0);
  });

  it('busca ignora acentos e maiúsculas', async () => {
    const rows = await listProducts({ search: 'RACAO' });
    expect(rows.map((p) => p.id)).toEqual(['p1']);
  });

  it('filtra só os abaixo do mínimo', async () => {
    const rows = await listProducts({ onlyLow: true });
    expect(rows.map((p) => p.id).sort()).toEqual(['p2', 'p3', 'p6']);
  });
});

describe('dashboard', () => {
  it('calcula os totais a partir dos dados', async () => {
    const s = await getDashboardSummary();
    const { products } = read();
    expect(s.totalProducts).toBe(products.length);
    expect(s.stockValueCents).toBe(products.reduce((t, p) => t + p.salePriceCents * p.quantity, 0));
    expect(s.outOfStockCount).toBe(1);
    expect(s.lowStock[0].id).toBe('p3'); // o mais crítico (zerado) vem primeiro
  });

  it('reflete uma movimentação imediatamente', async () => {
    await registerMovement({ productId: 'p3', type: 'entrada', quantity: '20' });
    const s = await getDashboardSummary();
    expect(s.outOfStockCount).toBe(0);
    expect(s.recent[0].productId).toBe('p3');
  });
});
