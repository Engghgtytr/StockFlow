import { ValidationError } from '../utils/validators.js';

// Mostra as mensagens de erro embaixo de cada campo e liga a mensagem ao campo
// com aria-describedby, para leitores de tela.
export function showFieldErrors(form, errors = {}) {
  form.querySelectorAll('[data-error-for]').forEach((el) => {
    const name = el.dataset.errorFor;
    const field = form.elements[name];
    const message = errors[name] ?? '';
    el.textContent = message;
    const inputs = field instanceof RadioNodeList ? [...field] : field ? [field] : [];
    inputs.forEach((input) => {
      input.toggleAttribute('aria-invalid', Boolean(message));
      if (message) input.setAttribute('aria-describedby', el.id);
    });
  });
  const first = Object.keys(errors)[0];
  const target = first && form.elements[first];
  if (target) (target instanceof RadioNodeList ? target[0] : target).focus();
}

export function setBusy(button, busy, busyLabel) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

// Envia o formulário cuidando de: estado ocupado, erros por campo e erro geral.
export async function submitWith(form, action, { busyLabel = 'Salvando…' } = {}) {
  const button = form.querySelector('button[type="submit"]');
  const general = form.querySelector('.form__error');
  general.textContent = '';
  showFieldErrors(form, {});
  setBusy(button, true, busyLabel);
  try {
    return await action(Object.fromEntries(new FormData(form)));
  } catch (err) {
    if (err instanceof ValidationError) {
      showFieldErrors(form, err.errors);
      general.textContent = err.message;
    } else {
      general.textContent = err?.message || 'Não foi possível salvar. Tente novamente.';
    }
    return undefined;
  } finally {
    if (button.isConnected) setBusy(button, false);
  }
}

export const field = ({ name, label, hint = '', required = false, input }) => `
  <div class="field">
    <label for="f-${name}">${label}${required ? '' : ' <span class="field__optional">(opcional)</span>'}</label>
    ${input}
    ${hint ? `<p class="field__hint">${hint}</p>` : ''}
    <p class="field__error" id="err-${name}" data-error-for="${name}"></p>
  </div>`;
