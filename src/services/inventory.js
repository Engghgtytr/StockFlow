// Ponto único que as telas usam (veja services/products.js).
import * as local from './local/inventory.js';
import * as remote from './remote/inventory.js';
import { getSession } from './session.js';

const impl = () => (getSession()?.mode === 'cloud' ? remote : local);

export const listMovements = (filters) => impl().listMovements(filters);
export const registerMovement = (input) => impl().registerMovement(input);
export const getDashboardSummary = () => impl().getDashboardSummary();
