import { ValidationError } from '../../utils/validators.js';

const FIELDS = ['name', 'sku', 'category', 'salePrice', 'minStock', 'quantity', 'productId', 'type', 'reason'];

// Converte erros do Supabase/Postgres em mensagens que a tela entende.
// As funções SQL usam "hint" com o nome do campo que tem problema.
export function toAppError(error) {
  if (FIELDS.includes(error.hint)) return new ValidationError({ [error.hint]: error.message });
  if (error.code === '23505') return new ValidationError({ sku: 'Já existe um produto com este SKU.' });
  if (error.code === '23514') return new Error('Algum valor ficou fora do permitido. Revise os campos.');
  if (error.code === '42501' || error.code === 'PGRST301') {
    return new Error('Sua sessão expirou ou você não tem permissão. Entre novamente.');
  }
  if (String(error.message).includes('fetch')) {
    return new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }
  return new Error('Não foi possível concluir a operação. Tente novamente.');
}

// Banco usa snake_case; o app usa camelCase.
export const toProduct = (r) => ({
  id: r.id,
  name: r.name,
  sku: r.sku,
  category: r.category,
  salePriceCents: r.sale_price_cents,
  quantity: r.quantity,
  minStock: r.min_stock,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toMovement = (r) => ({
  id: r.id,
  productId: r.product_id,
  productName: r.product_name,
  type: r.type,
  quantity: r.quantity,
  delta: r.delta,
  balanceAfter: r.balance_after,
  reason: r.reason,
  createdBy: r.created_by_name,
  createdAt: r.created_at,
});
