/**
 * Solo con `ng serve`: el proxy (proxy.conf.json) reenvía /api → http://localhost:8080
 * y evita errores CORS entre :4200 y :8080.
 */
export const environment = {
  production: false,
  apiUrl: '/api',
};
