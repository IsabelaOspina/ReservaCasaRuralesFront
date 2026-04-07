export const environment = {
  production: true,
  /** Producción: mismo host con proxy inverso o CORS habilitado en el backend. */
  apiUrl: 'http://localhost:8080',
  /** Mismo origen que sirve GET /uploads/** (normalmente igual que apiUrl). */
  apiBaseUrl: 'http://localhost:8080',
};
