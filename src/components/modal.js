import { esc } from '../utils/dom.js';

let counter = 0;

// Usa o elemento nativo <dialog>: ele já prende o foco dentro do modal,
// fecha com Esc e devolve o foco ao botão que o abriu.
export function openModal({ title, description = '', content, size = '' }) {
  const id = `modal-title-${++counter}`;
  const dialog = document.createElement('dialog');
  dialog.className = `modal ${size ? `modal--${size}` : ''}`;
  dialog.setAttribute('aria-labelledby', id);
  dialog.innerHTML = `
    <header class="modal__head">
      <div>
        <h2 id="${id}" class="modal__title">${esc(title)}</h2>
        ${description ? `<p class="modal__desc">${esc(description)}</p>` : ''}
      </div>
      <button type="button" class="icon-btn" data-close aria-label="Fechar">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
    </header>
    <div class="modal__body"></div>`;
  dialog.querySelector('.modal__body').append(content);

  // Fechar com animação: toca a saída e só depois fecha de verdade.
  // Substitui dialog.close() para valer em todos os jeitos de fechar
  // (botão X, Esc, clique fora, salvar e cancelar).
  const nativeClose = HTMLDialogElement.prototype.close.bind(dialog);
  let closing = false;
  dialog.close = (value) => {
    if (closing || !dialog.open) return;
    closing = true;
    dialog.classList.add('modal--closing');
    const finish = () => nativeClose(value); // chamar duas vezes não tem efeito
    dialog.addEventListener('animationend', (e) => {
      if (e.target === dialog) finish(); // ignora animações de elementos internos
    });
    setTimeout(finish, 250); // garantia se a animação não disparar
  };
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault(); // Esc: em vez de sumir de uma vez, usa a saída animada
    dialog.close();
  });

  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close(); // clique no fundo escurecido
  });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

// Confirmação para ações destrutivas. Resolve true/false.
export function confirmDialog({ title, message, confirmLabel, danger = true }) {
  return new Promise((resolve) => {
    const content = document.createElement('div');
    content.innerHTML = `
      <p class="confirm__msg">${esc(message)}</p>
      <div class="form__actions">
        <button type="button" class="btn btn--ghost" data-cancel>Cancelar</button>
        <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-ok>${esc(confirmLabel)}</button>
      </div>`;
    let answer = false;
    const dialog = openModal({ title, content, size: 'small' });
    content.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
    content.querySelector('[data-ok]').addEventListener('click', () => {
      answer = true;
      dialog.close();
    });
    content.querySelector('[data-cancel]').focus();
    dialog.addEventListener('close', () => resolve(answer));
  });
}
