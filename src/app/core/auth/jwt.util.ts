/** Decodifica payload JWT (sin verificar firma; solo lectura de claims para UX/rutas). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pushRole(out: Set<string>, value: string) {
  const t = value.trim();
  if (t) out.add(t);
}

/**
 * Extrae nombres de rol (ROLE_* o equivalentes) según payloads habituales de Spring Security / OAuth2.
 */
export function getJwtRoles(token: string): string[] {
  const p = decodeJwtPayload(token);
  if (!p) return [];
  const out = new Set<string>();

  const authorities = p['authorities'];
  if (Array.isArray(authorities)) {
    for (const a of authorities) {
      if (typeof a === 'string') pushRole(out, a);
      else if (a && typeof a === 'object' && 'authority' in a) {
        pushRole(out, String((a as { authority: string }).authority));
      }
    }
  } else if (typeof authorities === 'string') {
    const s = authorities.trim();
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s) as unknown;
        if (Array.isArray(arr)) {
          for (const x of arr) pushRole(out, typeof x === 'string' ? x : JSON.stringify(x));
        }
      } catch {
        s.split(',').forEach((x) => pushRole(out, x));
      }
    } else {
      s.split(',').forEach((x) => pushRole(out, x));
    }
  }

  const roles = p['roles'];
  if (Array.isArray(roles)) {
    for (const r of roles) pushRole(out, String(r));
  }

  for (const key of ['scope', 'scp'] as const) {
    const v = p[key];
    if (typeof v === 'string') v.split(/\s+/).forEach((x) => pushRole(out, x));
  }

  const auth = p['auth'];
  if (typeof auth === 'string') pushRole(out, auth);

  return [...out];
}

/** Cuando `authorities` no viene como array (serialización rara), inferimos desde el JSON o el claim `role`. */
function roleHintsFromPayload(token: string): { cliente: boolean; propietario: boolean } {
  const p = decodeJwtPayload(token);
  if (!p) return { cliente: false, propietario: false };

  const roleClaim = p['role'];
  if (typeof roleClaim === 'string') {
    const u = roleClaim.toUpperCase();
    if (u.includes('PROPIETARIO') && !u.includes('CLIENTE')) {
      return { cliente: false, propietario: true };
    }
    if (u.includes('CLIENTE') && !u.includes('PROPIETARIO')) {
      return { cliente: true, propietario: false };
    }
  }

  const blob = JSON.stringify(p);
  if (/\bROLE_PROPIETARIO\b/.test(blob) && !/\bROLE_CLIENTE\b/.test(blob)) {
    return { cliente: false, propietario: true };
  }
  if (/\bROLE_CLIENTE\b/.test(blob) && !/\bROLE_PROPIETARIO\b/.test(blob)) {
    return { cliente: true, propietario: false };
  }
  return { cliente: false, propietario: false };
}

function normalizeRole(r: string): string {
  return r.trim().toUpperCase();
}

export function hasRoleCliente(token: string): boolean {
  const fromList = getJwtRoles(token).some((r) => {
    const n = normalizeRole(r);
    return n === 'ROLE_CLIENTE' || n === 'CLIENTE';
  });
  if (fromList) return true;
  return roleHintsFromPayload(token).cliente;
}

export function hasRolePropietario(token: string): boolean {
  const fromList = getJwtRoles(token).some((r) => {
    const n = normalizeRole(r);
    return n === 'ROLE_PROPIETARIO' || n === 'PROPIETARIO';
  });
  if (fromList) return true;
  return roleHintsFromPayload(token).propietario;
}

/**
 * Ruta tras login. Usa roles en lista + inferencia del payload (misma lógica que los guards).
 */
export function resolvePostLoginRoute(token: string): '/cliente' | '/propietario' {
  const prop = hasRolePropietario(token);
  const cli = hasRoleCliente(token);
  if (prop && !cli) return '/propietario';
  if (cli && !prop) return '/cliente';
  if (cli && prop) return '/cliente';
  return '/cliente';
}
