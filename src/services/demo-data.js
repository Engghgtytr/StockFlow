// DADOS FICTÍCIOS de demonstração. Não representam uma loja, cliente ou venda real.
const daysAgo = (d, h = 10) => {
  const date = new Date();
  date.setDate(date.getDate() - d);
  date.setHours(h, 0, 0, 0);
  return date.toISOString();
};

const products = [
  ['p1', 'Ração seca adulto 3 kg', 'RAC-AD-3', 'Alimentação', 8990, 14, 6],
  ['p2', 'Petisco de frango 100 g', 'PET-FR-100', 'Alimentação', 1290, 3, 10],
  ['p3', 'Areia higiênica 4 kg', 'ARE-4', 'Higiene', 2450, 0, 8],
  ['p4', 'Shampoo neutro 500 ml', 'SHA-500', 'Higiene', 3290, 22, 5],
  ['p5', 'Coleira ajustável M', 'COL-M', 'Acessórios', 2790, 9, 4],
  ['p6', 'Comedouro inox 500 ml', null, 'Acessórios', 3490, 4, 4],
  ['p7', 'Brinquedo corda trançada', 'BRI-CORDA', 'Brinquedos', 1990, 17, 5],
  ['p8', 'Tapete higiênico 30 un', 'TAP-30', 'Higiene', 6990, 7, 6],
].map(([id, name, sku, category, salePriceCents, quantity, minStock], i) => ({
  id, name, sku, category, salePriceCents, quantity, minStock,
  createdAt: daysAgo(30 - i), updatedAt: daysAgo(2),
}));

const movements = [
  ['m1', 'p1', 'entrada', 20, 20, 20, 'Compra do fornecedor (fictícia)', 9],
  ['m2', 'p3', 'entrada', 10, 10, 10, 'Compra do fornecedor (fictícia)', 8],
  ['m3', 'p1', 'saida', 6, -6, 14, 'Venda no balcão', 5],
  ['m4', 'p2', 'saida', 7, -7, 3, 'Venda no balcão', 4],
  ['m5', 'p3', 'saida', 9, -9, 1, 'Venda no balcão', 3],
  ['m6', 'p3', 'ajuste', 0, -1, 0, 'Embalagem rasgada (avaria)', 2],
  ['m7', 'p4', 'entrada', 12, 12, 22, 'Reposição', 1],
].map(([id, productId, type, quantity, delta, balanceAfter, reason, d]) => ({
  id, productId, productName: products.find((p) => p.id === productId).name,
  type, quantity, delta, balanceAfter, reason,
  createdBy: 'Usuário de demonstração', createdAt: daysAgo(d, 15),
}));

export function createDemoData() {
  return {
    company: { id: 'demo', name: 'Loja Demonstração (fictícia)' },
    products: structuredClone(products),
    movements: structuredClone(movements),
  };
}
