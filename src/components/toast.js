// Avisos curtos. O contêiner tem aria-live, então leitores de tela anunciam a mensagem.
export function toast(message, { type = 'success', duration = 3800 } = {}) {
  const region = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  region.append(el);
  setTimeout(() => {
    el.classList.add('toast--leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    // Garantia caso a animação esteja desativada (prefers-reduced-motion)
    setTimeout(() => el.remove(), 400);
  }, duration);
}
