/**
 * Caché en navegador del dashboard (no sustituye al servidor).
 * Evita ver casas o reservas que ya no existen en la API.
 */
const LS_CLIENTE_CODIGO = 'cliente_codigo_casa';
const LS_CLIENTE_CATALOGO = 'cliente_catalogo_casas';
const SS_CLIENTE_RESERVA = 'cliente_ultima_reserva';

const PREFIX_PROPIETARIO_CASAS = 'propietario_casas';

export function clearClienteDashboardLocalCache(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LS_CLIENTE_CODIGO);
      localStorage.removeItem(LS_CLIENTE_CATALOGO);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SS_CLIENTE_RESERVA);
    }
  } catch {
    /* ignore */
  }
}

/** Borra claves `propietario_casas*`. No toca el token ni datos de «recordar» en login. */
export function clearPropietarioCasasLocalCache(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === PREFIX_PROPIETARIO_CASAS || k.startsWith(`${PREFIX_PROPIETARIO_CASAS}_`))) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
