import { listMovements } from '../services/inventory.js';
import { listProducts } from '../services/products.js';
import { openMovementForm } from '../components/movement-form.js';
import { loadingState, emptyState, errorState } from './states.js';
import { esc } from '../utils/dom.js';
import { formatDateTime, formatDelta, formatInt, MOVEMENT_LABELS } from '../utils/formatters.js';

export async function renderMovements(main) {
  const filters = { type: '', productId: '' };

  main.innerHTML = `
    <header class="page-head">
      <div>
        <h1 class="page-title">Movimentações</h1>
        <p class="page-sub">Toda mudança de estoque, com quem fez e por quê.</p>
      </div>
      <button type="button" class="btn btn--primary" data-new>Registrar movimentação</button>
    </header>
    <div class="toolbar">
      <div class="field field--inline">
        <label for="type" class="visually-hidden">Tipo</label>
        <select id="type">
          <option value="">Todos os tipos</option>
          ${Object.entries(MOVEMENT_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="field field--inline">
        <label for="product" class="visually-hidden">Produto</label>
        <select id="product"><option value="">Todos os produtos</option></select>
      </div>
    </div>
    <div data-content>${loadingState('Carregando histórico…', 6)}</div>`;

  const content = main.querySelector('[data-content]');

  listProducts().then((products) => {
    main.querySelector('#product').insertAdjacentHTML(
      'beforeend',
      products.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join(''),
    );
  }).catch(() => {});

  let requestId = 0;
  async function load() {
    const current = ++requestId;
    content.setAttribute('aria-busy', 'true');
    try {
      const rows = await listMovements(filters);
      if (current !== requestId) return;
      content.innerHTML = rows.length ? table(rows) : emptyState(
        filters.type || filters.productId
          ? { title: 'Nada com esses filtros', text: 'Mude o tipo ou o produto para ver outras movimentações.' }
          : { title: 'Nenhuma movimentação registrada', text: 'Registre uma entrada ou saída para começar o histórico.' },
      );
    } catch (err) {
      content.innerHTML = errorState(err.message);
      content.querySelector('[data-retry]').addEventListener('click', load);
    } finally {
      content.removeAttribute('aria-busy');
    }
  }

  main.querySelector('[data-new]').addEventListener('click', () => openMovementForm({ onSaved: load }));
  main.querySelector('#type').addEventListener('change', (e) => {
    filters.type = e.target.value;
    load();
  });
  main.querySelector('#product').addEventListener('change', (e) => {
    filters.productId = e.target.value;
    load();
  });

  await load();
}

function table(rows) {
  return `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr><th scope="col">Data</th><th scope="col">Produto</th><th scope="col">Tipo</th><th scope="col" class="num">Variação</th><th scope="col" class="num">Saldo</th><th scope="col">Motivo</th><th scope="col">Autor</th></tr>
        </thead>
        <tbody>
          ${rows.map((m) => `
            <tr>
              <td data-label="Data"><time datetime="${esc(m.createdAt)}">${formatDateTime(m.createdAt)}</time></td>
              <td data-label="Produto"><span class="cell-title">${esc(m.productName)}</span></td>
              <td data-label="Tipo"><span class="badge badge--${m.type}">${MOVEMENT_LABELS[m.type]}</span></td>
              <td data-label="Variação" class="num"><span class="delta delta--${m.type}">${formatDelta(m.delta)}</span></td>
              <td data-label="Saldo" class="num">${formatInt(m.balanceAfter)}</td>
              <td data-label="Motivo">${m.reason ? esc(m.reason) : '<span class="muted">Sem motivo</span>'}</td>
              <td data-label="Autor">${m.createdBy ? esc(m.createdBy) : '<span class="muted">Desconhecido</span>'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
