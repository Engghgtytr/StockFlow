import { openModal } from './modal.js';
import { toast } from './toast.js';
import { field, submitWith } from './form-helpers.js';
import { createProduct, updateProduct, listCategories } from '../services/products.js';
import { esc } from '../utils/dom.js';
import { centsToInput } from '../utils/formatters.js';

// Abre o formulário de cadastro (sem produto) ou edição (com produto).
export async function openProductForm(product = null, { onSaved } = {}) {
  const isNew = !product;
  const categories = await listCategories().catch(() => []);
  const v = (key, fallback = '') => esc(product?.[key] ?? fallback);

  const form = document.createElement('form');
  form.className = 'form';
  form.noValidate = true;
  form.innerHTML = `
    ${field({ name: 'name', label: 'Nome', required: true,
      input: `<input id="f-name" name="name" maxlength="120" autocomplete="off" value="${v('name')}" required>` })}
    <div class="form__row">
      ${field({ name: 'sku', label: 'SKU / código', hint: 'Único na loja.',
        input: `<input id="f-sku" name="sku" maxlength="40" autocomplete="off" value="${v('sku')}">` })}
      ${field({ name: 'category', label: 'Categoria', required: true,
        input: `<input id="f-category" name="category" list="category-options" maxlength="60" autocomplete="off" value="${v('category')}" required>
          <datalist id="category-options">${categories.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>` })}
    </div>
    <div class="form__row">
      ${field({ name: 'salePrice', label: 'Preço de venda (R$)', required: true,
        input: `<input id="f-salePrice" name="salePrice" inputmode="decimal" placeholder="0,00" value="${product ? centsToInput(product.salePriceCents) : ''}" required>` })}
      ${field({ name: 'minStock', label: 'Estoque mínimo', required: true, hint: 'Abaixo disso, o produto entra em alerta.',
        input: `<input id="f-minStock" name="minStock" inputmode="numeric" value="${v('minStock', '0')}" required>` })}
    </div>
    ${isNew
      ? field({ name: 'quantity', label: 'Quantidade inicial', required: true, hint: 'Será registrada como a primeira entrada no histórico.',
          input: '<input id="f-quantity" name="quantity" inputmode="numeric" value="0" required>' })
      : `<p class="form__note">Estoque atual: <strong>${product.quantity}</strong>. Para alterar a quantidade, registre uma movimentação. Assim o histórico mostra de onde veio cada mudança.</p>`}
    <p class="form__error" role="alert"></p>
    <div class="form__actions">
      <button type="button" class="btn btn--ghost" data-cancel>Cancelar</button>
      <button type="submit" class="btn btn--primary">${isNew ? 'Cadastrar produto' : 'Salvar alterações'}</button>
    </div>`;

  const dialog = openModal({ title: isNew ? 'Novo produto' : 'Editar produto', content: form });
  form.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
  form.elements.name.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saved = await submitWith(form, (data) =>
      isNew ? createProduct(data) : updateProduct(product.id, data),
    );
    if (!saved) return;
    dialog.close();
    toast(isNew ? `“${saved.name}” cadastrado.` : 'Alterações salvas.');
    onSaved?.(saved);
  });
}
