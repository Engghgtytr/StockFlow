import { esc } from '../utils/dom.js';
import { getSession, endSession } from '../services/session.js';
import { resetDemo } from '../services/store.js';
import { confirmDialog } from './modal.js';
import { toast } from './toast.js';

const icons = {
  dashboard: '<path d="M3 3h6v8H3zM11 3h6v5h-6zM11 10h6v7h-6zM3 13h6v4H3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  products: '<path d="M3 6.5 10 3l7 3.5v7L10 17l-7-3.5z M3 6.5 10 10l7-3.5M10 10v7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  movements: '<path d="M4 7h11l-3-3M16 13H5l3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
};

// Vendas fica fora do menu até a versão 2 ser implementada (regra do plano).
const NAV = [
  { path: '/', label: 'Dashboard', icon: 'dashboard' },
  { path: '/produtos', label: 'Produtos', icon: 'products' },
  { path: '/movimentacoes', label: 'Movimentações', icon: 'movements' },
];

// Desenha a moldura do app (menu + área principal) e devolve a área principal.
export function renderShell(app, currentPath) {
  const session = getSession();
  const isDemo = session?.mode !== 'cloud';
  app.innerHTML = `
    <a class="skip-link" href="#main">Pular para o conteúdo</a>
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="#/" aria-label="StockFlow, ir para o dashboard">
          <svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="5" y="19" width="22" height="5" rx="2.5" fill="var(--line)"/><rect x="5" y="19" width="14" height="5" rx="2.5" fill="var(--brand)"/>
            <rect x="5" y="9" width="22" height="5" rx="2.5" fill="var(--line)"/><rect x="5" y="9" width="6" height="5" rx="2.5" fill="var(--warn)"/>
          </svg>
          <span class="brand__name">StockFlow</span>
        </a>
        <nav class="nav" aria-label="Principal">
          ${NAV.map((item) => `
            <a class="nav__link" href="#${item.path}" ${item.path === currentPath ? 'aria-current="page"' : ''}>
              <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">${icons[item.icon]}</svg>
              <span>${item.label}</span>
            </a>`).join('')}
        </nav>
        <div class="sidebar__foot">
          ${isDemo
            ? `<p class="demo-note">Modo demonstração. Os dados são fictícios e ficam só neste navegador.</p>
               <button type="button" class="link-btn" data-reset>Restaurar dados de exemplo</button>`
            : `<p class="demo-note">${esc(session?.companyName ?? '')}</p>`}
          <div class="user">
            <span class="user__avatar" aria-hidden="true">${esc((session?.name ?? '?').trim().charAt(0).toUpperCase())}</span>
            <span class="user__name">${esc(session?.name ?? '')}</span>
            <button type="button" class="btn btn--ghost btn--small" data-logout>Sair</button>
          </div>
        </div>
      </aside>
      <main id="main" class="main" tabindex="-1"></main>
    </div>`;

  app.querySelector('[data-logout]').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    await endSession();
    location.hash = '#/login';
  });

  app.querySelector('[data-reset]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Restaurar dados de exemplo?',
      message: 'Todos os produtos e movimentações deste navegador serão substituídos pelos dados fictícios originais.',
      confirmLabel: 'Restaurar dados',
    });
    if (!ok) return;
    resetDemo();
    toast('Dados de exemplo restaurados.');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  return app.querySelector('#main');
}
