import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

import { getSession, initSession, onSessionEnd } from './services/session.js';
import { toast } from './components/toast.js';
import { showSplash } from './components/splash.js';
import { renderShell } from './components/sidebar.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderProducts } from './pages/products.js';
import { renderMovements } from './pages/movements.js';
import { emptyState } from './pages/states.js';

const app = document.getElementById('app');

// Roteamento por hash (#/produtos). Simples e funciona em qualquer hospedagem
// estática, sem configurar o servidor.
const routes = {
  '/': { title: 'Dashboard', render: renderDashboard },
  '/produtos': { title: 'Produtos', render: renderProducts },
  '/movimentacoes': { title: 'Movimentações', render: renderMovements },
};

function parseHash() {
  const [path, query = ''] = (location.hash.slice(1) || '/').split('?');
  return { path, params: new URLSearchParams(query) };
}

// Ordem do menu: define a direção da animação ao trocar de página.
const ORDER = ['/login', '/', '/produtos', '/movimentacoes'];
let currentPath = null;

// Desenha a página. As páginas montam o "esqueleto" de forma síncrona e só depois
// buscam os dados; por isso a animação pode começar sem esperar o banco.
function render(path, params) {
  const session = getSession();

  if (path === '/login') {
    if (session) return void (location.hash = '#/');
    document.title = 'Entrar · StockFlow';
    return renderLogin(app);
  }

  // Área privada: sem sessão, volta para o login.
  if (!session) return void (location.hash = '#/login');

  const route = routes[path];
  const main = renderShell(app, route ? path : null);
  if (!route) {
    document.title = 'Página não encontrada · StockFlow';
    main.innerHTML = emptyState({
      title: 'Página não encontrada',
      text: 'O endereço não existe. Use o menu para voltar.',
      action: '<a class="btn btn--primary" href="#/">Ir para o dashboard</a>',
    });
    return;
  }
  document.title = `${route.title} · StockFlow`;
  main.focus({ preventScroll: true });
  return route.render(main, params);
}

async function router() {
  const { path, params } = parseHash();
  const previous = currentPath;
  currentPath = path;

  // Sem animação: primeira carga (fica atrás da abertura), mesma página
  // ou navegador sem suporte à View Transitions API (aí a troca é direta).
  if (!previous || previous === path || !document.startViewTransition) {
    return render(path, params);
  }

  // Avançar no menu → conteúdo entra pela direita; voltar → pela esquerda.
  const back = ORDER.indexOf(path) < ORDER.indexOf(previous);
  document.documentElement.dataset.nav = back ? 'back' : 'forward';

  let rendering;
  const transition = document.startViewTransition(() => {
    rendering = render(path, params);
  });
  await transition.finished.catch(() => {});
  await rendering;
}

// Sessão expirou ou saiu em outra aba: volta para o login.
onSessionEnd(() => {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  toast('Sua sessão terminou. Entre novamente.', { type: 'error' });
  location.hash = '#/login';
});

async function start() {
  const splash = showSplash();
  app.innerHTML = '<p class="boot" role="status">Carregando…</p>';
  try {
    await initSession();
  } catch {
    // Sem conexão: o app ainda abre (o modo demonstração funciona offline).
  }
  window.addEventListener('hashchange', router);
  // A página é montada por baixo da abertura, para já estar pronta quando ela sair.
  // Se a rede estiver lenta, não segura a abertura por mais de 2,5 s:
  // a própria página mostra o estado de carregamento.
  await Promise.race([router(), new Promise((r) => setTimeout(r, 2500))]);
  await splash.done();
}

start();
