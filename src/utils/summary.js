import { stockStatus } from './stock.js';

// Números do dashboard, calculados a partir dos dados (nunca fixos no código).
export function summarize({ companyName, products, recent }) {
  const lowStock = products
    .filter((p) => stockStatus(p) !== 'ok')
    .sort((a, b) => a.quantity / (a.minStock || 1) - b.quantity / (b.minStock || 1));
  return {
    companyName,
    totalProducts: products.length,
    totalUnits: products.reduce((sum, p) => sum + p.quantity, 0),
    stockValueCents: products.reduce((sum, p) => sum + p.salePriceCents * p.quantity, 0),
    lowStockCount: lowStock.length,
    outOfStockCount: products.filter((p) => p.quantity === 0).length,
    lowStock,
    recent,
  };
}
