// Sessão do usuário em dois modos:
//   - "cloud": conta real no Supabase Auth (e-mail e senha);
//   - "demo": demonstração local, sem senha e com dados fictícios.
import { supabase } from './supabase.js';

const DEMO_KEY = 'stockflow:session';

let cloudSession = null;
const endListeners = new Set();

function readDemo() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY));
  } catch {
    return null;
  }
}

export function getSession() {
  return cloudSession ?? readDemo();
}

// Avisa o app quando a sessão acaba sozinha (expirou ou saiu em outra aba).
export function onSessionEnd(listener) {
  endListeners.add(listener);
  return () => endListeners.delete(listener);
}

async function loadProfile(user) {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, role, companies(name)')
    .eq('id', user.id)
    .single();
  if (error) throw new Error('Não foi possível carregar seu perfil. Tente entrar de novo.');
  return {
    mode: 'cloud',
    userId: user.id,
    email: user.email,
    name: data.full_name,
    role: data.role,
    companyName: data.companies?.name ?? '',
  };
}

// Chamado uma vez ao abrir o app: recupera a sessão salva pelo Supabase.
export async function initSession() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    try {
      cloudSession = await loadProfile(data.session.user);
    } catch {
      cloudSession = null;
    }
  }
  // Não chamar o Supabase dentro deste callback (recomendação da documentação).
  supabase.auth.onAuthStateChange((event, session) => {
    if (cloudSession && (event === 'SIGNED_OUT' || !session)) {
      cloudSession = null;
      endListeners.forEach((fn) => fn());
    }
  });
}

const AUTH_MESSAGES = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  user_already_exists: 'Já existe uma conta com este e-mail. Use "Entrar".',
  weak_password: 'Senha fraca. Use pelo menos 6 caracteres, misturando letras e números.',
  over_email_send_rate_limit: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
};

function authError(error) {
  if (error?.message?.includes('fetch')) return new Error('Sem conexão com o servidor. Verifique a internet.');
  return new Error(AUTH_MESSAGES[error?.code] ?? 'Não foi possível concluir. Tente novamente.');
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw authError(error);
  cloudSession = await loadProfile(data.user);
  localStorage.removeItem(DEMO_KEY);
  return cloudSession;
}

// Os metadados viram empresa + perfil no banco (gatilho handle_new_user).
export async function signUp({ fullName, companyName, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, company_name: companyName },
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw authError(error);
  // Com confirmação de e-mail ativada, o Supabase não devolve sessão ainda.
  if (!data.session) return { needsConfirmation: true };
  cloudSession = await loadProfile(data.user);
  return { needsConfirmation: false };
}

export function startDemoSession(name) {
  const session = { mode: 'demo', name, startedAt: new Date().toISOString() };
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(session));
  } catch {
    // ignora: a sessão dura até recarregar
  }
  return session;
}

export async function endSession() {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    // nada a fazer
  }
  if (cloudSession) {
    cloudSession = null;
    await supabase.auth.signOut();
  }
}
