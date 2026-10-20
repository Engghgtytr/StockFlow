// Ponto único que as telas usam. Escolhe o modo de acordo com a sessão:
// conta real → Supabase; demonstração → localStorage.
import * as local from './local/products.js';
import * as remote from './remote/products.js';
import { getSession } from './session.js';

const impl = () => (getSession()?.mode === 'cloud' ? remote : local);

export const listProducts = (filters) => impl().listProducts(filters);
export const listCategories = () => impl().listCategories();
export const createProduct = (input) => impl().createProduct(input);
export const updateProduct = (id, input) => impl().updateProduct(id, input);
export const deleteProduct = (id) => impl().deleteProduct(id);
