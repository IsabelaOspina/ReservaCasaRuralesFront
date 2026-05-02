import { HttpErrorResponse } from '@angular/common/http';

/** Textos genéricos de Spring Security / servlet en 403; el mensaje útil va en español al usuario. */
function es403MensajeGenericoIngles(s: string): boolean {
  const t = s.trim().toLowerCase();
  return (
    t === 'access denied' ||
    t === 'forbidden' ||
    t === 'access is denied' ||
    /^access denied\b/i.test(s.trim()) ||
    t.includes('access is denied')
  );
}

function mensaje403ParaUsuario(textoBackend: string | null | undefined): string {
  const porDefecto =
    'No tienes permiso para esta acción. Comprueba que iniciaste sesión como propietario (no como cliente) y que la reserva es de una de tus casas rurales. Si usas la cuenta correcta y sigue fallando, el bloqueo lo aplica el servidor (403).';
  if (!textoBackend?.trim()) return porDefecto;
  if (es403MensajeGenericoIngles(textoBackend)) return porDefecto;
  return textoBackend.trim();
}

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
 * Los 403 con "Access Denied" (Spring Security) se sustituyen por un texto claro en español.
 */
export function readApiError(err: HttpErrorResponse): string {
  let body = coerceErrorBody(err.error);

  let msgDesdeCuerpo: string | null = null;

  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return null;
    };
    msgDesdeCuerpo =
      pick('message', 'detail', 'detalle', 'error', 'mensaje') ??
      (typeof o['error'] === 'object' &&
      o['error'] !== null &&
      'message' in (o['error'] as object) &&
      typeof (o['error'] as { message: unknown }).message === 'string'
        ? String((o['error'] as { message: string }).message).trim()
        : null);
  }

  if (msgDesdeCuerpo == null && typeof body === 'string' && body.trim()) {
    msgDesdeCuerpo = body.trim();
  }

  if (err.status === 403) {
    return mensaje403ParaUsuario(msgDesdeCuerpo);
  }

  if (msgDesdeCuerpo) return msgDesdeCuerpo;

  if (typeof body === 'string' && body.trim()) return body.trim();
  if (err.status === 0) return 'No hay conexión. Comprueba tu red e inténtalo de nuevo.';
  return err.message || 'No se pudo completar la operación. Inténtalo de nuevo.';
}
