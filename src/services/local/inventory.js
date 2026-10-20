// Modo demonstração: movimentações guardadas no localStorage.
import { read, write, simulate, uid, now } from '../store.js';
import { getSession } from '../session.js';
import { validateMovement, ValidationError } from '../../utils/validators.js';
import { summarize } from '../../utils/summary.js';

const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt);

export function listMovements({ productId = '', type = '', limit = 0 } = {}) {
  return simulate(() => {
    const rows = read()
      .movements.filter((m) => !productId || m.productId === productId)
      .filter((m) => !type || m.type === type)
      .sort(newestFirst);
    return limit ? rows.slice(0, limit) : rows;
  });
}

// Entrada soma, saída subtrai e ajuste define a nova contagem.
// Validação, atualização do saldo e registro do histórico acontecem juntos:
// se qualquer parte falhar, nada é gravado.
export function registerMovement({ productId, ...input }) {
  return simulate(() =>
    write((db) => {
      const product = db.products.find((p) => p.id === productId);
      if (!product) throw new ValidationError({ productId: 'Escolha um produto.' });

      const result = validateMovement(input, product);
      if (!result.ok) throw new ValidationError(result.errors);
      const { type, quantity, reason } = result.values;

      const delta =
        type === 'entrada' ? quantity : type === 'saida' ? -quantity : quantity - product.quantity;
      const balanceAfter = product.quantity + delta;
      if (balanceAfter < 0) throw new ValidationError({ quantity: 'O estoque não pode ficar negativo.' });

      const t = now();
      product.quantity = balanceAfter;
      product.updatedAt = t;

      const movement = {
        id: uid(), productId, productName: product.name, type, quantity, delta,
        balanceAfter, reason, createdBy: getSession()?.name ?? null, createdAt: t,
      };
      db.movements.push(movement);
      return { movement, product: { ...product } };
    }),
  );
}

export function getDashboardSummary() {
  return simulate(() => {
    const { products, movements, company } = read();
    return summarize({
      companyName: company.name,
      products,
      recent: [...movements].sort(newestFirst).slice(0, 6),
    });
  });
}
