// Modo nuvem: movimentações no Supabase.
import { supabase } from '../supabase.js';
import { getSession } from '../session.js';
import { toAppError, toMovement, toProduct } from './common.js';
import { validateMovement, ValidationError } from '../../utils/validators.js';
import { summarize } from '../../utils/summary.js';

// Limite para não baixar um histórico gigante de uma vez.
const HISTORY_LIMIT = 500;

export async function listMovements({ productId = '', type = '', limit = 0 } = {}) {
  let query = supabase
    .from('inventory_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit || HISTORY_LIMIT);
  if (productId) query = query.eq('product_id', productId);
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) throw toAppError(error);
  return data.map(toMovement);
}

// Toda a regra (saldo, estoque negativo, histórico) roda numa função SQL,
// dentro de uma transação e com a linha do produto travada.
export async function registerMovement({ productId, ...input }) {
  if (!productId) throw new ValidationError({ productId: 'Escolha um produto.' });
  const result = validateMovement(input);
  if (!result.ok) throw new ValidationError(result.errors);

  const { data, error } = await supabase.rpc('register_movement', {
    p_product_id: productId,
    p_type: result.values.type,
    p_quantity: result.values.quantity,
    p_reason: result.values.reason,
  });
  if (error) throw toAppError(error);

  const movement = toMovement(data);
  return { movement, product: { id: productId, name: movement.productName, quantity: movement.balanceAfter } };
}

export async function getDashboardSummary() {
  const [products, recent] = await Promise.all([
    supabase.from('products').select('*'),
    listMovements({ limit: 6 }),
  ]);
  if (products.error) throw toAppError(products.error);
  return summarize({
    companyName: getSession()?.companyName ?? '',
    products: products.data.map(toProduct),
    recent,
  });
}
