import { stockStatus } from '../utils/stock.js';
import { formatInt } from '../utils/formatters.js';

// "Medidor de prateleira": a barra mostra o estoque atual e o traço marca o mínimo.
// A escala vai até o dobro do mínimo (ou até a quantidade, se for maior).
// "grow": a barra enche ao aparecer; "index" escalona cada barra da lista.
export function stockGauge(product, { showNumbers = true, grow = false, index = 0 } = {}) {
  const status = stockStatus(product);
  const scale = Math.max(product.minStock * 2, product.quantity, 1);
  const fill = Math.min(100, (product.quantity / scale) * 100);
  const mark = Math.min(100, (product.minStock / scale) * 100);
  const label = `${formatInt(product.quantity)} em estoque, mínimo ${formatInt(product.minStock)}`;

  return `
    <div class="gauge gauge--${status}${grow ? ' gauge--grow' : ''}" style="--i:${index}">
      ${showNumbers ? `<span class="gauge__qty">${formatInt(product.quantity)}</span>` : ''}
      <span class="gauge__track" role="img" aria-label="${label}">
        <span class="gauge__fill" style="width:${fill}%"></span>
        ${product.minStock > 0 ? `<span class="gauge__min" style="left:${mark}%"></span>` : ''}
      </span>
      ${showNumbers ? `<span class="gauge__minlabel">mín. ${formatInt(product.minStock)}</span>` : ''}
    </div>`;
}
