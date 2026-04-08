import { HttpErrorResponse } from '@angular/common/http';

function coerceErrorBody(body: unknown): unknown {
  if (typeof body !== 'string') return body;
  const s = body.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return body;
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return body;
  }
}

/**
 * Mensaje legible para el usuario (nunca devuelve JSON crudo si el backend manda string JSON).
 */
export function readApiError(err: HttpErrorResponse): string {
  let body = coerceErrorBody(err.error);

  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return null;
    };
    const msg =
      pick('message', 'detail', 'detalle', 'error', 'mensaje') ??
      (typeof o['error'] === 'object' &&
      o['error'] !== null &&
      'message' in (o['error'] as object) &&
      typeof (o['error'] as { message: unknown }).message === 'string'
        ? String((o['error'] as { message: string }).message).trim()
        : null);
    if (msg) return msg;
  }

  if (typeof body === 'string' && body.trim()) return body.trim();
  if (err.status === 0) return 'No hay conexión. Comprueba tu red e inténtalo de nuevo.';
  return err.message || 'No se pudo completar la operación. Inténtalo de nuevo.';
}
