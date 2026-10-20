// Armazenamento LOCAL temporário (etapas 1–2).
// Guarda os dados no localStorage deste navegador. Na etapa 3 os serviços
// products.js e inventory.js passam a chamar o Supabase, mantendo as mesmas
// funções assíncronas — por isso as páginas não precisarão mudar.
import { createDemoData } from './demo-data.js';

const KEY = 'stockflow:demo:v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // localStorage bloqueado ou JSON corrompido: recomeça com os dados de demonstração.
  }
  const data = createDemoData();
  persist(data);
  return data;
}

function persist(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Sem armazenamento disponível (ex.: janela anônima restrita); os dados ficam só em memória.
  }
}

let state = load();

export const read = () => state;

// Aplica a alteração numa CÓPIA. Se o "mutator" lançar erro, nada é salvo:
// é a versão local de uma transação (tudo ou nada).
export function write(mutator) {
  const draft = structuredClone(state);
  const result = mutator(draft);
  state = draft;
  persist(state);
  return result;
}

export function resetDemo() {
  state = createDemoData();
  persist(state);
}

// Latência artificial curta para que os estados de carregamento apareçam,
// como acontecerá com o banco real.
export function simulate(fn, ms = 220) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (err) {
        reject(err);
      }
    }, ms);
  });
}

export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
