import { getDashboardSummary } from '../services/inventory.js';
import { getSession } from '../services/session.js';
import { openMovementForm } from '../components/movement-form.js';
import { stockGauge } from '../components/stock-gauge.js';
import { loadingState, emptyState, errorState } from './states.js';
import { esc } from '../utils/dom.js';
import { formatCents, formatInt, formatDateTime, formatDelta, MOVEMENT_LABELS } from '../utils/formatters.js';
import { STATUS_LABELS, stockStatus } from '../utils/stock.js';

export async function renderDashboard(main) {
  const firstName = esc(getSession()?.name.split(' ')[0] ?? '');
  main.innerHTML = `
    <header class="page-head">
      <div>
        <h1 class="page-title">Olá, ${firstName}</h1>
        <p class="page-sub" data-company></p>
      </div>
      <button type="button" class="btn btn--primary" data-new-movement>Registrar movimentação</button>
    </header>
    <div data-content>${loadingState('Carregando o resumo do estoque…')}</div>`;

  main.querySelector('[data-new-movement]').addEventListener('click', () =>
    openMovementForm({ onSaved: () => load() }),
  );

  const content = main.querySelector('[data-content]');

  // As barras enchem só na primeira carga; depois de uma movimentação,
  // a lista é redesenhada sem repetir a animação.
  let firstLoad = true;
  async function load() {
    try {
      const s = await getDashboardSummary();
      main.querySelector('[data-company]').textContent = s.companyName;
      content.innerHTML = template(s, { grow: firstLoad });
      firstLoad = false;
      content.querySelectorAll('[data-restock]').forEach((btn) =>
        btn.addEventListener('click', () =>
          openMovementForm({ productId: btn.dataset.restock, type: 'entrada', onSaved: () => load() }),
        ),
      );
    } catch (err) {
      content.innerHTML = errorState(err.message);
      content.querySelector('[data-retry]').addEventListener('click', load);
    }
  }
  await load();
}

function template(s, { grow = false } = {}) {
  if (s.totalProducts === 0) {
    return emptyState({
      title: 'Nenhum produto cadastrado',
      text: 'Cadastre os produtos da loja para acompanhar o estoque por aqui.',
      action: '<a class="btn btn--primary" href="#/produtos">Ir para produtos</a>',
    });
  }

  return `
    <dl class="stats">
      <div class="stat"><dt>Produtos</dt><dd>${formatInt(s.totalProducts)}</dd></div>
      <div class="stat ${s.lowStockCount ? 'stat--warn' : ''}"><dt>Precisam de reposição</dt><dd>${formatInt(s.lowStockCount)}</dd></div>
      <div class="stat ${s.outOfStockCount ? 'stat--danger' : ''}"><dt>Sem estoque</dt><dd>${formatInt(s.outOfStockCount)}</dd></div>
      <div class="stat"><dt>Valor em estoque (preço de venda)</dt><dd>${formatCents(s.stockValueCents)}</dd></div>
    </dl>

    <div class="dash-grid">
      <section class="panel" aria-labelledby="restock-title">
        <header class="panel__head">
          <h2 id="restock-title" class="panel__title">Precisa de reposição</h2>
          <a class="panel__link" href="#/produtos?baixo=1">Ver na lista</a>
        </header>
        ${s.lowStock.length
          ? `<ul class="restock-list">${s.lowStock.map((p, i) => `
              <li class="restock-list__item">
                <div class="restock-list__info">
                  <span class="restock-list__name">${esc(p.name)}</span>
                  <span class="badge badge--${stockStatus(p)}">${STATUS_LABELS[stockStatus(p)]}</span>
                </div>
                ${stockGauge(p, { grow, index: i })}
                <button type="button" class="btn btn--ghost btn--small" data-restock="${esc(p.id)}" aria-label="Registrar entrada de ${esc(p.name)}">Registrar entrada</button>
              </li>`).join('')}</ul>`
          : emptyState({ title: 'Tudo em dia', text: 'Nenhum produto está abaixo do estoque mínimo.' })}
      </section>

      <section class="panel" aria-labelledby="recent-title">
        <header class="panel__head">
          <h2 id="recent-title" class="panel__title">Movimentações recentes</h2>
          <a class="panel__link" href="#/movimentacoes">Ver histórico</a>
        </header>
        ${s.recent.length
          ? `<ol class="feed">${s.recent.map((m) => `
              <li class="feed__item">
                <span class="delta delta--${m.type}">${formatDelta(m.delta)}</span>
                <div class="feed__body">
                  <span class="feed__name">${esc(m.productName)}</span>
                  <span class="feed__meta">${MOVEMENT_LABELS[m.type]}${m.reason ? `, ${esc(m.reason)}` : ''}</span>
                </div>
                <time class="feed__time" datetime="${esc(m.createdAt)}">${formatDateTime(m.createdAt)}</time>
              </li>`).join('')}</ol>`
          : emptyState({ title: 'Sem movimentações ainda', text: 'Entradas e saídas registradas aparecem aqui.' })}
      </section>
    </div>`;
}
