// Validação no navegador melhora a experiência, mas NÃO é segurança.
// Na etapa 3 as mesmas regras também ficam no banco (constraints + RLS).

export class ValidationError extends Error {
  constructor(errors) {
    super('Revise os campos destacados.');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// Aceita "19,90", "19.90", "1.234,56" e "R$ 19,90". Retorna centavos ou null.
export function parseMoneyToCents(raw) {
  let s = String(raw ?? '').trim().replace(/\s|R\$/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [int, frac = ''] = s.split('.');
  return Number(int) * 100 + Number(frac.padEnd(2, '0'));
}

export function parseNonNegativeInt(raw) {
  const s = String(raw ?? '').trim();
  if (!/^\d{1,7}$/.test(s)) return null;
  return Number(s);
}

export function validateProduct(input, { products, id = null, isNew }) {
  const errors = {};
  const values = {};

  const name = String(input.name ?? '').trim();
  if (!name) errors.name = 'Informe o nome do produto.';
  else if (name.length > 120) errors.name = 'Use no máximo 120 caracteres.';
  values.name = name;

  const sku = String(input.sku ?? '').trim().toUpperCase();
  if (sku.length > 40) errors.sku = 'Use no máximo 40 caracteres.';
  else if (sku && products.some((p) => p.id !== id && p.sku === sku)) {
    errors.sku = 'Já existe um produto com este SKU.';
  }
  values.sku = sku || null;

  const category = String(input.category ?? '').trim();
  if (!category) errors.category = 'Informe a categoria.';
  else if (category.length > 60) errors.category = 'Use no máximo 60 caracteres.';
  values.category = category;

  const price = parseMoneyToCents(input.salePrice);
  if (price === null) errors.salePrice = 'Use um valor como 19,90.';
  values.salePriceCents = price;

  const minStock = parseNonNegativeInt(input.minStock);
  if (minStock === null) errors.minStock = 'Use um número inteiro, zero ou maior.';
  values.minStock = minStock;

  // A quantidade só é definida no cadastro. Depois disso, muda apenas por
  // movimentações, para que toda alteração de estoque tenha origem rastreável.
  if (isNew) {
    const quantity = parseNonNegativeInt(input.quantity);
    if (quantity === null) errors.quantity = 'Use um número inteiro, zero ou maior.';
    values.quantity = quantity;
  }

  return { values, errors, ok: Object.keys(errors).length === 0 };
}

// Sem "product" (modo nuvem), valida só o formato. As regras que dependem do
// saldo atual são conferidas pelo banco, que tem o valor verdadeiro.
export function validateMovement(input, product = null) {
  const errors = {};
  const type = input.type;
  if (!['entrada', 'saida', 'ajuste'].includes(type)) errors.type = 'Escolha o tipo de movimentação.';

  const quantity = parseNonNegativeInt(input.quantity);
  if (quantity === null) {
    errors.quantity = 'Use um número inteiro, zero ou maior.';
  } else if (type !== 'ajuste' && quantity === 0) {
    errors.quantity = 'A quantidade precisa ser maior que zero.';
  } else if (product && type === 'saida' && quantity > product.quantity) {
    errors.quantity = `Há apenas ${product.quantity} unidade(s) em estoque.`;
  } else if (product && type === 'ajuste' && quantity === product.quantity) {
    errors.quantity = 'A contagem é igual ao estoque atual; não há o que ajustar.';
  }

  const reason = String(input.reason ?? '').trim();
  if (reason.length > 200) errors.reason = 'Use no máximo 200 caracteres.';
  else if (type === 'ajuste' && !reason) errors.reason = 'Explique o motivo do ajuste (ex.: contagem, avaria).';

  return { values: { type, quantity, reason: reason || null }, errors, ok: Object.keys(errors).length === 0 };
}
