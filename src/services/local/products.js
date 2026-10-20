// Modo demonstração: produtos guardados no localStorage.
import { read, write, simulate, uid, now } from '../store.js';
import { getSession } from '../session.js';
import { validateProduct, ValidationError } from '../../utils/validators.js';
import { filterProducts, uniqueCategories } from '../../utils/search.js';

export function listProducts(filters) {
  return simulate(() => filterProducts(read().products, filters));
}

export function listCategories() {
  return simulate(() => uniqueCategories(read().products));
}

export function createProduct(input) {
  return simulate(() =>
    write((db) => {
      const result = validateProduct(input, { products: db.products, isNew: true });
      if (!result.ok) throw new ValidationError(result.errors);

      const t = now();
      const product = { id: uid(), ...result.values, createdAt: t, updatedAt: t };
      db.products.push(product);

      // Estoque inicial também vira movimentação: nenhuma unidade "aparece do nada".
      if (product.quantity > 0) {
        db.movements.push({
          id: uid(), productId: product.id, productName: product.name,
          type: 'entrada', quantity: product.quantity, delta: product.quantity,
          balanceAfter: product.quantity, reason: 'Estoque inicial no cadastro',
          createdBy: getSession()?.name ?? null, createdAt: t,
        });
      }
      return product;
    }),
  );
}

export function updateProduct(id, input) {
  return simulate(() =>
    write((db) => {
      const product = db.products.find((p) => p.id === id);
      if (!product) throw new Error('Este produto não existe mais. Atualize a lista.');
      const result = validateProduct(input, { products: db.products, id, isNew: false });
      if (!result.ok) throw new ValidationError(result.errors);
      Object.assign(product, result.values, { updatedAt: now() });
      return { ...product };
    }),
  );
}

// O histórico de movimentações é mantido (com o nome salvo no momento da movimentação).
export function deleteProduct(id) {
  return simulate(() =>
    write((db) => {
      const index = db.products.findIndex((p) => p.id === id);
      if (index === -1) throw new Error('Este produto já foi excluído.');
      db.products.splice(index, 1);
    }),
  );
}
