import { listProducts, listCategories, deleteProduct } from '../services/products.js';
import { openProductForm } from '../components/product-form.js';
import { openMovementForm } from '../components/movement-form.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { stockGauge } from '../components/stock-gauge.js';
import { loadingState, emptyState, errorState } from './states.js';
import { esc, debounce } from '../utils/dom.js';
import { formatCents } from '../utils/formatters.js';

export async function renderProducts(main, params) {
  const filters = { search: '', category: '', onlyLow: params.get('baixo') === '1' };
  let products = [];

  main.innerHTML = `
    <header class="page-head">
      <div>
        <h1 class="page-title">Produtos</h1>
        <p class="page-sub">Cadastro, preços e níveis de estoque.</p>
      </div>
      <button type="button" class="btn btn--primary" data-new>Novo produto</button>
    </header>
    <div class="toolbar" role="search">
      <div class="field field--inline">
        <label for="search" class="visually-hidden">Buscar por nome ou SKU</label>
        <input id="search" type="search" placeholder="Buscar por nome ou SKU" autocomplete="off">
      </div>
      <div class="field field--inline">
        <label for="category" class="visually-hidden">Categoria</label>
        <select id="category"><option value="">Todas as categorias</option></select>
      </div>
      <label class="check">
        <input type="checkbox" id="only-low" ${filters.onlyLow ? 'checked' : ''}>
        <span>Só abaixo do mínimo</span>
      </label>
    </div>
    <p class="result-count" data-count aria-live="polite"></p>
    <div data-content>${loadingState('Carregando produtos…', 6)}</div>`;

  const content = main.querySelector('[data-content]');
  const categorySelect = main.querySelector('#category');

  async function loadCategories() {
    const categories = await listCategories().catch(() => []);
    categorySelect.innerHTML = `<option value="">Todas as categorias</option>${categories
      .map((c) => `<option value="${esc(c)}" ${c === filters.category ? 'selected' : ''}>${esc(c)}</option>`)
      .join('')}`;
  }

  let requestId = 0;
  async function load() {
    // Se o usuário digitar rápido, só a resposta da última busca é exibida.
    const current = ++requestId;
    content.setAttribute('aria-busy', 'true');
    try {
      const result = await listProducts(filters);
      if (current !== requestId) return;
      products = result;
      render();
    } catch (err) {
      content.innerHTML = errorState(err.message);
      content.querySelector('[data-retry]').addEventListener('click', load);
    } finally {
      content.removeAttribute('aria-busy');
    }
  }

  const refresh = () => Promise.all([loadCategories(), load()]);

  function render() {
    const filtered = filters.search || filters.category || filters.onlyLow;
    main.querySelector('[data-count]').textContent = products.length
      ? `${products.length} ${products.length === 1 ? 'produto' : 'produtos'}`
      : '';

    if (!products.length) {
      content.innerHTML = filtered
        ? emptyState({ title: 'Nenhum produto encontrado', text: 'Tente outro termo de busca ou limpe os filtros.',
            action: '<button type="button" class="btn btn--ghost" data-clear>Limpar filtros</button>' })
        : emptyState({ title: 'Nenhum produto cadastrado', text: 'Comece cadastrando o primeiro produto da loja.',
            action: '<button type="button" class="btn btn--primary" data-new>Cadastrar produto</button>' });
      content.querySelector('[data-clear]')?.addEventListener('click', clearFilters);
      content.querySelector('[data-new]')?.addEventListener('click', () => openProductForm(null, { onSaved: refresh }));
      return;
    }

    content.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th scope="col">Produto</th><th scope="col">Categoria</th><th scope="col" class="num">Preço</th><th scope="col">Estoque</th><th scope="col"><span class="visually-hidden">Ações</span></th></tr>
          </thead>
          <tbody>
            ${products.map((p) => `
              <tr>
                <td data-label="Produto"><span class="cell-title">${esc(p.name)}</span>${p.sku ? `<span class="cell-sub">${esc(p.sku)}</span>` : ''}</td>
                <td data-label="Categoria">${esc(p.category)}</td>
                <td data-label="Preço" class="num">${formatCents(p.salePriceCents)}</td>
                <td data-label="Estoque">${stockGauge(p)}</td>
                <td class="row-actions">
                  <button type="button" class="btn btn--ghost btn--small" data-move="${esc(p.id)}" aria-label="Movimentar ${esc(p.name)}">Movimentar</button>
                  <button type="button" class="btn btn--ghost btn--small" data-edit="${esc(p.id)}" aria-label="Editar ${esc(p.name)}">Editar</button>
                  <button type="button" class="btn btn--ghost btn--small btn--danger-text" data-delete="${esc(p.id)}" aria-label="Excluir ${esc(p.name)}">Excluir</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // Um único ouvinte para todos os botões da tabela (delegação de eventos).
  content.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const find = (id) => products.find((p) => p.id === id);

    if (btn.dataset.edit) openProductForm(find(btn.dataset.edit), { onSaved: refresh });
    if (btn.dataset.move) openMovementForm({ productId: btn.dataset.move, onSaved: load });
    if (btn.dataset.delete) {
      const product = find(btn.dataset.delete);
      const ok = await confirmDialog({
        title: 'Excluir produto?',
        message: `“${product.name}” será removido da lista. O histórico de movimentações dele continua guardado.`,
        confirmLabel: 'Excluir produto',
      });
      if (!ok) return;
      try {
        await deleteProduct(product.id);
        toast(`“${product.name}” excluído.`);
        refresh();
      } catch (err) {
        toast(err.message, { type: 'error' });
      }
    }
  });

  function clearFilters() {
    Object.assign(filters, { search: '', category: '', onlyLow: false });
    main.querySelector('#search').value = '';
    categorySelect.value = '';
    main.querySelector('#only-low').checked = false;
    load();
  }

  main.querySelector('[data-new]').addEventListener('click', () => openProductForm(null, { onSaved: refresh }));
  main.querySelector('#search').addEventListener('input', debounce((e) => {
    filters.search = e.target.value;
    load();
  }));
  categorySelect.addEventListener('change', (e) => {
    filters.category = e.target.value;
    load();
  });
  main.querySelector('#only-low').addEventListener('change', (e) => {
    filters.onlyLow = e.target.checked;
    load();
  });

  await refresh();
}
