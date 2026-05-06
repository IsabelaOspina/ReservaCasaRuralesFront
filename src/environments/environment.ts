export const environment = {
  production: true,
  /** Producción: mismo host con proxy inverso o CORS habilitado en el backend. */
  apiUrl: 'https://reservacasarurales-production.up.railway.app',
  /** Mismo origen que sirve GET /uploads/** (normalmente igual que apiUrl). */
  apiBaseUrl: 'https://reservacasarurales-production.up.railway.app',
};
