// Regra única de "estoque baixo", usada no dashboard, na lista e nos alertas.
export function stockStatus(product) {
  if (product.quantity === 0) return 'zerado';
  if (product.quantity <= product.minStock) return 'baixo';
  return 'ok';
}

export const STATUS_LABELS = { zerado: 'Sem estoque', baixo: 'Abaixo do mínimo', ok: 'Em dia' };

export const needsRestock = (product) => stockStatus(product) !== 'ok';
