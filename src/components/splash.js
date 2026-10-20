// Abertura com o logo: as "prateleiras" se enchem e o nome é revelado.
// Toca uma vez por sessão do navegador e cobre o carregamento real do app.
const SEEN_KEY = 'stockflow:intro-seen';
const MAX_DURATION = 3000; // limite de segurança (ms)
const MIN_REDUCED = 300;

function alreadySeen() {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return true;
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // sessionStorage indisponível: mostra a abertura normalmente
  }
  return false;
}

export function showSplash() {
  if (alreadySeen()) return { done: async () => {} };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div');
  el.className = 'splash';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'Carregando o StockFlow');
  el.innerHTML = `
    <div class="splash__inner" aria-hidden="true">
      <svg class="splash__mark" viewBox="0 0 32 32">
        <rect class="splash__track" x="5" y="9" width="22" height="5" rx="2.5"/>
        <rect class="splash__fill splash__fill--warn" x="5" y="9" width="6" height="5" rx="2.5"/>
        <rect class="splash__track splash__track--2" x="5" y="19" width="22" height="5" rx="2.5"/>
        <rect class="splash__fill splash__fill--brand" x="5" y="19" width="14" height="5" rx="2.5"/>
      </svg>
      <p class="splash__name">StockFlow</p>
      <p class="splash__by">por Penchel.Dev</p>
    </div>`;
  document.body.append(el);
  document.body.classList.add('splash-active');

  // Clique ou tecla pulam a abertura.
  let skip;
  const skipped = new Promise((resolve) => (skip = resolve));
  const onSkip = () => skip();
  el.addEventListener('pointerdown', onSkip);
  window.addEventListener('keydown', onSkip, { once: true });

  // Espera a ÚLTIMA animação terminar (e não um tempo fixo): a animação só começa
  // quando a página é pintada, que pode demorar em aparelhos lentos.
  // O tempo máximo é uma garantia caso o evento não dispare.
  const minTime = reduced
    ? new Promise((r) => setTimeout(r, MIN_REDUCED))
    : new Promise((r) => {
        el.querySelector('.splash__by').addEventListener('animationend', () => setTimeout(r, 150), { once: true });
        setTimeout(r, MAX_DURATION);
      });

  return {
    // Chame quando o app estiver pronto; a abertura sai assim que a animação terminar.
    async done() {
      await Promise.race([minTime, skipped]);
      window.removeEventListener('keydown', onSkip);
      el.classList.add('splash--out');
      document.body.classList.remove('splash-active');
      await new Promise((resolve) => {
        el.addEventListener('transitionend', resolve, { once: true });
        setTimeout(resolve, 400); // garantia se a transição não disparar
      });
      el.remove();
    },
  };
}
