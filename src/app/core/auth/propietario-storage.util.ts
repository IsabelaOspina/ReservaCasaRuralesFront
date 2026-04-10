import { decodeJwtPayload } from './jwt.util';

const LEGACY_KEY = 'propietario_casas';

/**
 * Clave de localStorage para las casas guardadas en el alta del propietario.
 * Debe ser distinta por usuario para no mezclar datos entre cuentas en el mismo navegador.
 */
export function propietarioCasasLocalStorageKey(token: string | null = null): string {
  const t = token ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
  if (!t) return LEGACY_KEY;
  const p = decodeJwtPayload(t);
  if (!p) return LEGACY_KEY;

  const sub = typeof p['sub'] === 'string' ? p['sub'].trim() : '';
  const email =
    (typeof p['email'] === 'string' && p['email'].trim()) ||
    (typeof p['correoElectronico'] === 'string' && p['correoElectronico'].trim()) ||
    '';
  const id =
    p['userId'] != null
      ? String(p['userId']).trim()
      : p['id'] != null
        ? String(p['id']).trim()
        : '';

  const raw = sub || email || id;
  if (!raw) return LEGACY_KEY;

  const safe = raw.replace(/[^a-zA-Z0-9@._-]/g, '_').slice(0, 120);
  return `${LEGACY_KEY}_${safe}`;
}
