import { needsRestock } from './stock.js';

// "Ração" e "racao" viram a mesma coisa: sem acentos e em minúsculas.
export const normalize = (s) =>
  String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// Busca e filtros da lista de produtos, iguais nos dois modos (local e nuvem).
// Filtrar no navegador é simples e suficiente para o catálogo de uma loja pequena;
// com milhares de produtos, o ideal seria filtrar no banco.
export function filterProducts(products, { search = '', category = '', onlyLow = false } = {}) {
  const q = normalize(search.trim());
  return products
    .filter((p) => !category || p.category === category)
    .filter((p) => !q || normalize(p.name).includes(q) || normalize(p.sku).includes(q))
    .filter((p) => !onlyLow || needsRestock(p))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export const uniqueCategories = (products) =>
  [...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
