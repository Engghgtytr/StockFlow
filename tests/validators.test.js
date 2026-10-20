import { describe, it, expect } from 'vitest';
import {
  parseMoneyToCents,
  parseNonNegativeInt,
  validateProduct,
  validateMovement,
} from '../src/utils/validators.js';
import { stockStatus } from '../src/utils/stock.js';
import { formatCents, centsToInput } from '../src/utils/formatters.js';

describe('parseMoneyToCents', () => {
  it.each([
    ['19,90', 1990],
    ['19.90', 1990],
    ['19,9', 1990],
    ['20', 2000],
    ['1.234,56', 123456],
    ['R$ 12,50', 1250],
    ['0,10', 10],
  ])('converte "%s" em %i centavos', (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });

  it.each(['', 'abc', '-5', '1,999', '12,3,4', '10e2'])('rejeita "%s"', (input) => {
    expect(parseMoneyToCents(input)).toBeNull();
  });

  it('não sofre com erro de ponto flutuante', () => {
    // Em JavaScript, 0.1 + 0.2 === 0.30000000000000004
    expect(parseMoneyToCents('0,10') + parseMoneyToCents('0,20')).toBe(30);
  });
});

describe('parseNonNegativeInt', () => {
  it('aceita inteiros a partir de zero', () => {
    expect(parseNonNegativeInt('0')).toBe(0);
    expect(parseNonNegativeInt(' 42 ')).toBe(42);
  });

  it.each(['', '-1', '2.5', '3,0', 'dez'])('rejeita "%s"', (input) => {
    expect(parseNonNegativeInt(input)).toBeNull();
  });
});

describe('validateProduct', () => {
  const products = [{ id: 'p1', sku: 'RAC-AD-3' }];
  const valid = { name: 'Ração', sku: '', category: 'Alimentação', salePrice: '10,00', minStock: '2', quantity: '5' };

  it('aceita um produto válido', () => {
    const r = validateProduct(valid, { products, isNew: true });
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({ salePriceCents: 1000, minStock: 2, quantity: 5, sku: null });
  });

  it('aponta todos os campos obrigatórios vazios', () => {
    const r = validateProduct({}, { products, isNew: true });
    expect(Object.keys(r.errors).sort()).toEqual(['category', 'minStock', 'name', 'quantity', 'salePrice']);
  });

  it('bloqueia SKU duplicado sem diferenciar maiúsculas', () => {
    const r = validateProduct({ ...valid, sku: 'rac-ad-3' }, { products, isNew: true });
    expect(r.errors.sku).toMatch(/Já existe/);
  });

  it('permite manter o próprio SKU ao editar', () => {
    const r = validateProduct({ ...valid, sku: 'RAC-AD-3' }, { products, id: 'p1', isNew: false });
    expect(r.ok).toBe(true);
  });

  it('ignora a quantidade ao editar (ela só muda por movimentação)', () => {
    const r = validateProduct({ ...valid, quantity: '999' }, { products, id: 'p1', isNew: false });
    expect(r.values).not.toHaveProperty('quantity');
  });
});

describe('validateMovement', () => {
  const product = { quantity: 3 };

  it('bloqueia saída maior que o estoque', () => {
    const r = validateMovement({ type: 'saida', quantity: '4' }, product);
    expect(r.errors.quantity).toBe('Há apenas 3 unidade(s) em estoque.');
  });

  it('permite zerar o estoque com uma saída', () => {
    expect(validateMovement({ type: 'saida', quantity: '3' }, product).ok).toBe(true);
  });

  it('não aceita entrada de zero unidades', () => {
    expect(validateMovement({ type: 'entrada', quantity: '0' }, product).ok).toBe(false);
  });

  it('exige motivo no ajuste', () => {
    const r = validateMovement({ type: 'ajuste', quantity: '1' }, product);
    expect(r.errors.reason).toBeDefined();
  });

  it('recusa ajuste igual ao estoque atual', () => {
    const r = validateMovement({ type: 'ajuste', quantity: '3', reason: 'contagem' }, product);
    expect(r.errors.quantity).toBeDefined();
  });

  it('recusa tipo desconhecido', () => {
    expect(validateMovement({ type: 'roubo', quantity: '1' }, product).errors.type).toBeDefined();
  });
});

describe('stockStatus', () => {
  it.each([
    [{ quantity: 0, minStock: 5 }, 'zerado'],
    [{ quantity: 5, minStock: 5 }, 'baixo'],
    [{ quantity: 6, minStock: 5 }, 'ok'],
    [{ quantity: 0, minStock: 0 }, 'zerado'],
  ])('%o → %s', (product, status) => {
    expect(stockStatus(product)).toBe(status);
  });
});

describe('formatadores', () => {
  it('formata centavos em reais', () => {
    expect(formatCents(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56');
  });

  it('prepara o preço para o campo do formulário', () => {
    expect(centsToInput(1990)).toBe('19,90');
    expect(centsToInput(5)).toBe('0,05');
  });
});
