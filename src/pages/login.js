import { startDemoSession, signIn, signUp } from '../services/session.js';
import { isSupabaseConfigured } from '../services/supabase.js';
import { stockGauge } from '../components/stock-gauge.js';
import { field, submitWith } from '../components/form-helpers.js';
import { ValidationError } from '../utils/validators.js';
import { esc } from '../utils/dom.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const brand = `
  <div class="brand brand--large">
    <svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5" y="19" width="22" height="5" rx="2.5" fill="var(--line)"/><rect x="5" y="19" width="14" height="5" rx="2.5" fill="var(--brand)"/>
      <rect x="5" y="9" width="22" height="5" rx="2.5" fill="var(--line)"/><rect x="5" y="9" width="6" height="5" rx="2.5" fill="var(--warn)"/>
    </svg>
    <span class="brand__name">StockFlow</span>
  </div>`;

const signInFields = `
  ${field({ name: 'email', label: 'E-mail', required: true,
    input: '<input id="f-email" name="email" type="email" autocomplete="email" required>' })}
  ${field({ name: 'password', label: 'Senha', required: true,
    input: '<input id="f-password" name="password" type="password" autocomplete="current-password" required>' })}`;

const signUpFields = `
  ${field({ name: 'fullName', label: 'Seu nome', required: true,
    input: '<input id="f-fullName" name="fullName" maxlength="80" autocomplete="name" required>' })}
  ${field({ name: 'companyName', label: 'Nome da loja', required: true,
    input: '<input id="f-companyName" name="companyName" maxlength="120" autocomplete="organization" required>' })}
  ${field({ name: 'email', label: 'E-mail', required: true,
    input: '<input id="f-email" name="email" type="email" autocomplete="email" required>' })}
  ${field({ name: 'password', label: 'Senha', required: true, hint: 'Pelo menos 6 caracteres.',
    input: '<input id="f-password" name="password" type="password" minlength="6" autocomplete="new-password" required>' })}`;

function validateAuth(data, isSignUp) {
  const errors = {};
  if (isSignUp && !data.fullName?.trim()) errors.fullName = 'Informe seu nome.';
  if (isSignUp && !data.companyName?.trim()) errors.companyName = 'Informe o nome da loja.';
  if (!EMAIL_RE.test(data.email?.trim() ?? '')) errors.email = 'Use um e-mail válido, como voce@loja.com.';
  if (!data.password) errors.password = 'Informe a senha.';
  else if (isSignUp && data.password.length < 6) errors.password = 'Use pelo menos 6 caracteres.';
  if (Object.keys(errors).length) throw new ValidationError(errors);
}

export function renderLogin(app) {
  const sample = [
    { name: 'Ração seca adulto 3 kg', quantity: 14, minStock: 6 },
    { name: 'Petisco de frango 100 g', quantity: 3, minStock: 10 },
    { name: 'Areia higiênica 4 kg', quantity: 0, minStock: 8 },
  ];

  app.innerHTML = `
    <main class="login" id="main">
      <section class="login__panel">
        ${brand}
        <h1 class="login__title">Saiba o que tem na prateleira antes de faltar.</h1>
        <p class="login__lead">Produtos, entradas, saídas e alertas de reposição em um só lugar, feito para pequenos comércios.</p>

        ${isSupabaseConfigured ? `
          <div class="auth">
            <div class="auth__switch" role="group" aria-label="Acesso">
              <button type="button" class="auth__tab" data-mode="signin" aria-pressed="true">Entrar</button>
              <button type="button" class="auth__tab" data-mode="signup" aria-pressed="false">Criar conta</button>
            </div>
            <form class="form" novalidate data-auth></form>
          </div>
          <div class="auth__divider"><span>ou</span></div>` : ''}

        <div class="demo-entry">
          <button type="button" class="btn ${isSupabaseConfigured ? 'btn--ghost' : 'btn--primary'} btn--block" data-demo>Explorar a demonstração</button>
          <p class="login__notice">Sem cadastro: dados fictícios que ficam só neste navegador.${isSupabaseConfigured ? '' : ' Para usar contas reais, configure o Supabase no arquivo .env.'}</p>
        </div>
      </section>
      <aside class="login__aside" aria-label="Exemplo do alerta de reposição">
        <div class="preview-card">
          <p class="preview-card__title">Precisa de reposição</p>
          <ul class="restock-list">
            ${sample.map((p, i) => `<li class="restock-list__item"><span class="restock-list__name">${p.name}</span>${stockGauge(p, { grow: true, index: i })}</li>`).join('')}
          </ul>
          <p class="preview-card__foot">O traço marca o estoque mínimo de cada produto.</p>
        </div>
      </aside>
    </main>`;

  app.querySelector('[data-demo]').addEventListener('click', () => {
    startDemoSession('Visitante');
    location.hash = '#/';
  });

  if (!isSupabaseConfigured) return;

  const form = app.querySelector('[data-auth]');
  const tabs = app.querySelectorAll('.auth__tab');
  let mode = 'signin';

  function renderForm() {
    const isSignUp = mode === 'signup';
    form.innerHTML = `
      ${isSignUp ? signUpFields : signInFields}
      <p class="form__error" role="alert"></p>
      <button type="submit" class="btn btn--primary btn--block">${isSignUp ? 'Criar conta' : 'Entrar'}</button>`;
    tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.mode === mode)));
  }

  tabs.forEach((tab) =>
    tab.addEventListener('click', () => {
      mode = tab.dataset.mode;
      renderForm();
      form.querySelector('input').focus();
    }),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isSignUp = mode === 'signup';
    const result = await submitWith(
      form,
      async (data) => {
        validateAuth(data, isSignUp);
        const email = data.email.trim();
        if (!isSignUp) {
          await signIn(email, data.password);
          return { done: true };
        }
        const res = await signUp({ fullName: data.fullName.trim(), companyName: data.companyName.trim(), email, password: data.password });
        return res.needsConfirmation ? { confirm: email } : { done: true };
      },
      { busyLabel: isSignUp ? 'Criando conta…' : 'Entrando…' },
    );
    if (result?.done) location.hash = '#/';
    if (result?.confirm) {
      form.innerHTML = `
        <div class="auth__sent" role="status">
          <p class="auth__sent-title">Confirme seu e-mail</p>
          <p>Enviamos um link para <strong>${esc(result.confirm)}</strong>. Abra o link e depois entre com sua senha.</p>
        </div>`;
      mode = 'signin';
      tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.mode === mode)));
    }
  });

  renderForm();
  form.querySelector('input').focus();
}
