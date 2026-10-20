import { createClient } from '@supabase/supabase-js';

// Só variáveis PÚBLICAS (prefixo VITE_) chegam ao navegador.
// A chave anon/publishable pode ficar no frontend porque quem protege os dados é o RLS.
// NUNCA use aqui a chave service_role: ela ignora o RLS.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

// Sem .env, o app funciona só no modo demonstração.
export const supabase = isSupabaseConfigured ? createClient(url, key) : null;
