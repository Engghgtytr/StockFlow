import { esc } from '../utils/dom.js';

// Estados reutilizáveis: carregando, vazio e erro.
export const loadingState = (label = 'Carregando…', rows = 4) => `
  <div class="loading" role="status">
    <span class="visually-hidden">${esc(label)}</span>
    ${Array.from({ length: rows }, () => '<span class="skeleton"></span>').join('')}
  </div>`;

export const emptyState = ({ title, text, action = '' }) => `
  <div class="empty">
    <p class="empty__title">${esc(title)}</p>
    <p class="empty__text">${esc(text)}</p>
    ${action}
  </div>`;

export const errorState = (message) => `
  <div class="error-box" role="alert">
    <p><strong>Não foi possível carregar os dados.</strong> ${esc(message)}</p>
    <button type="button" class="btn btn--ghost btn--small" data-retry>Tentar de novo</button>
  </div>`;
