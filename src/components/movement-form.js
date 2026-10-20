import { openModal } from './modal.js';
import { toast } from './toast.js';
import { field, submitWith } from './form-helpers.js';
import { listProducts } from '../services/products.js';
import { registerMovement } from '../services/inventory.js';
import { esc } from '../utils/dom.js';
import { formatInt, MOVEMENT_LABELS } from '../utils/formatters.js';
import { parseNonNegativeInt } from '../utils/validators.js';

const TYPE_HINTS = {
  entrada: 'Chegou mercadoria: soma ao estoque.',
  saida: 'Saiu mercadoria: subtrai do estoque.',
  ajuste: 'Corrige para a contagem real (ex.: inventário, avaria).',
};

export async function openMovementForm({ productId = '', type = 'entrada', onSaved } = {}) {
  const products = await listProducts();
  if (!products.length) {
    toast('Cadastre um produto antes de registrar movimentações.', { type: 'error' });
    return;
  }

  const form = document.createElement('form');
  form.className = 'form';
  form.noValidate = true;
  form.innerHTML = `
    ${field({ name: 'productId', label: 'Produto', required: true,
      input: `<select id="f-productId" name="productId" required>
        <option value="">Escolha um produto</option>
        ${products.map((p) => `<option value="${esc(p.id)}" ${p.id === productId ? 'selected' : ''}>${esc(p.name)}${p.sku ? ` (${esc(p.sku)})` : ''}</option>`).join('')}
      </select>` })}
    <fieldset class="field segmented">
      <legend>Tipo</legend>
      <div class="segmented__options">
        ${Object.entries(MOVEMENT_LABELS).map(([value, label]) => `
          <label class="segmented__option">
            <input type="radio" name="type" value="${value}" ${value === type ? 'checked' : ''}>
            <span>${label}</span>
          </label>`).join('')}
      </div>
      <p class="field__hint" data-type-hint></p>
      <p class="field__error" id="err-type" data-error-for="type"></p>
    </fieldset>
    ${field({ name: 'quantity', label: '<span data-qty-label>Quantidade</span>', required: true,
      input: '<input id="f-quantity" name="quantity" inputmode="numeric" autocomplete="off" required>' })}
    <p class="preview" data-preview aria-live="polite"></p>
    ${field({ name: 'reason', label: 'Motivo', hint: 'Obrigatório para ajustes.',
      input: '<input id="f-reason" name="reason" maxlength="200" autocomplete="off" placeholder="Ex.: compra do fornecedor, venda no balcão">' })}
    <p class="form__error" role="alert"></p>
    <div class="form__actions">
      <button type="button" class="btn btn--ghost" data-cancel>Cancelar</button>
      <button type="submit" class="btn btn--primary">Registrar movimentação</button>
    </div>`;

  // Prévia do saldo: mostra antes de salvar como o estoque vai ficar.
  const preview = form.querySelector('[data-preview]');
  function updatePreview() {
    const current = form.elements.type.value;
    form.querySelector('[data-type-hint]').textContent = TYPE_HINTS[current];
    form.querySelector('[data-qty-label]').textContent =
      current === 'ajuste' ? 'Nova contagem (unidades)' : 'Quantidade (unidades)';

    const product = products.find((p) => p.id === form.elements.productId.value);
    const qty = parseNonNegativeInt(form.elements.quantity.value);
    if (!product) {
      preview.textContent = '';
      return;
    }
    if (qty === null) {
      preview.innerHTML = `Estoque atual: <strong>${formatInt(product.quantity)}</strong>`;
      return;
    }
    const after = current === 'entrada' ? product.quantity + qty : current === 'saida' ? product.quantity - qty : qty;
    preview.classList.toggle('preview--invalid', after < 0);
    preview.innerHTML = after < 0
      ? `Estoque atual: <strong>${formatInt(product.quantity)}</strong>. Não dá para retirar ${formatInt(qty)}.`
      : `Estoque: <strong>${formatInt(product.quantity)}</strong> → <strong>${formatInt(after)}</strong>`;
  }
  form.addEventListener('input', updatePreview);
  updatePreview();

  const dialog = openModal({ title: 'Registrar movimentação', content: form });
  form.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
  (productId ? form.elements.quantity : form.elements.productId).focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const result = await submitWith(form, registerMovement, { busyLabel: 'Registrando…' });
    if (!result) return;
    dialog.close();
    const { movement, product } = result;
    toast(`${MOVEMENT_LABELS[movement.type]} registrada: ${product.name} agora tem ${formatInt(product.quantity)}.`);
    onSaved?.(result);
  });
}
