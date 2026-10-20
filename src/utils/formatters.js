// Valores monetários são guardados em CENTAVOS (inteiros) para evitar erros de
// ponto flutuante como 0.1 + 0.2 = 0.30000000000000004. Só dividimos por 100 na hora de exibir.
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const integer = new Intl.NumberFormat('pt-BR');

export const formatCents = (cents) => brl.format(cents / 100);

export const centsToInput = (cents) =>
  `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;

export const formatInt = (n) => integer.format(n);

export const formatDateTime = (iso) => dateTime.format(new Date(iso));

export const MOVEMENT_LABELS = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' };

export function formatDelta(delta) {
  if (delta > 0) return `+${formatInt(delta)}`;
  if (delta < 0) return `−${formatInt(Math.abs(delta))}`;
  return '0';
}
