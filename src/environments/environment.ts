/**
 * Solo con `ng serve`: el proxy (proxy.conf.json) reenvía /api → http://localhost:8080
 * y evita errores CORS entre :4200 y :8080.
 * Las fotos van en /uploads/** en el servidor Spring; no bajo /api. Para &lt;img src&gt;
 * se usa apiBaseUrl (origen real del backend), no apiUrl.
 */
export const environment = {
  production: false,
  apiUrl: '/api',
  apiBaseUrl: 'http://localhost:8080',
};
