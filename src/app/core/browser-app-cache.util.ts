/**
 * Datos que el front guarda en el navegador para UX (siguen ahí aunque borres la BD del servidor).
 * Al cerrar sesión conviene vaciarlos para no mezclar entornos de prueba con datos viejos.
 */
export function clearClienteAreaBrowserCache(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem('cliente_codigo_casa');
  localStorage.removeItem('cliente_catalogo_casas');
  localStorage.removeItem('cliente_telefono_registro');
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('cliente_ultima_reserva');
  }
}

/** Casas del propietario guardadas tras el alta (clave `propietario_casas` o `propietario_casas_<usuario>`). */
export function clearPropietarioCasasBrowserCache(): void {
  if (typeof localStorage === 'undefined') return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('propietario_casas')) toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);
}

export function clearDashboardBrowserCacheOnLogout(): void {
  clearClienteAreaBrowserCache();
  clearPropietarioCasasBrowserCache();
}
