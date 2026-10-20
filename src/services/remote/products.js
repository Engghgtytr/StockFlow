// Modo nuvem: produtos no Supabase. O RLS garante que só vêm os da empresa do usuário.
import { supabase } from '../supabase.js';
import { toAppError, toProduct } from './common.js';
import { validateProduct, ValidationError } from '../../utils/validators.js';
import { filterProducts, uniqueCategories } from '../../utils/search.js';

async function fetchAll() {
  const { data, error } = await supabase.from('products').select('*').order('name');
  if (error) throw toAppError(error);
  return data.map(toProduct);
}

export async function listProducts(filters) {
  return filterProducts(await fetchAll(), filters);
}

export async function listCategories() {
  return uniqueCategories(await fetchAll());
}

// A validação aqui é para a experiência; a regra que vale é a do banco
// (incluindo SKU único, que só o banco consegue garantir).
function validate(input, isNew) {
  const result = validateProduct(input, { products: [], isNew });
  if (!result.ok) throw new ValidationError(result.errors);
  return result.values;
}

export async function createProduct(input) {
  const v = validate(input, true);
  const { data, error } = await supabase.rpc('create_product', {
    p_name: v.name,
    p_sku: v.sku,
    p_category: v.category,
    p_sale_price_cents: v.salePriceCents,
    p_min_stock: v.minStock,
    p_quantity: v.quantity,
  });
  if (error) throw toAppError(error);
  return toProduct(data);
}

export async function updateProduct(id, input) {
  const v = validate(input, false);
  const { data, error } = await supabase
    .from('products')
    .update({ name: v.name, sku: v.sku, category: v.category, sale_price_cents: v.salePriceCents, min_stock: v.minStock })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!data) throw new Error('Este produto não existe mais. Atualize a lista.');
  return toProduct(data);
}

// O histórico continua guardado (product_id vira nulo, o nome fica salvo).
export async function deleteProduct(id) {
  const { data, error } = await supabase.from('products').delete().eq('id', id).select('id');
  if (error) throw toAppError(error);
  if (!data.length) throw new Error('Este produto já foi excluído.');
}
