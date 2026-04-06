import { environment } from '../../environments/environment';
import { FotoResponse } from '../DTO/Foto-response';
import { CasaRuralResponse } from '../DTO/CasaRural-response';

/**
 * URL usable en &lt;img src&gt; a partir de lo que devuelve el backend.
 * - http(s) absolutas: se devuelven tal cual.
 * - Rutas relativas tipo /uploads/... : en desarrollo (apiUrl /api) se usa la misma
 *   origen con proxy /uploads → backend (ver proxy.conf.json).
 * - Cualquier otra ruta relativa: se antepone la base del API (p. ej. /api).
 */
export function resolveFotoSrc(url: string | undefined | null): string | null {
  let u = (url ?? '').trim();
  if (!u) return null;
  u = u.replace(/\\/g, '/');
  const lower = u.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (!u.startsWith('/')) u = `/${u}`;

  const apiBase = environment.apiUrl.replace(/\/$/, '');
  if (apiBase.startsWith('/')) {
    if (u.startsWith('/uploads')) {
      return u;
    }
    return `${apiBase}${u}`;
  }
  return `${apiBase}${u}`;
}

function normalizeOneFoto(raw: unknown, index: number): FotoResponse {
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const url = String(
      o['url'] ?? o['URL'] ?? o['ruta'] ?? o['path'] ?? ''
    ).trim();
    const id = Number(o['idFoto'] ?? o['id'] ?? index);
    const descripcion = String(
      o['descripcion'] ?? o['descripción'] ?? o['description'] ?? ''
    ).trim();
    return {
      idFoto: Number.isFinite(id) ? id : index,
      url,
      descripcion,
    };
  }
  return { idFoto: index, url: '', descripcion: '' };
}

/** Alinea claves JSON del backend (mayúsculas, sin acentos en TS, etc.). */
export function normalizeCasaRuralResponse(raw: unknown): CasaRuralResponse {
  const fallback: CasaRuralResponse = {
    codigoCasa: 0,
    poblacion: '',
    descripcion: '',
    numeroDormitorios: 0,
    numeroBanos: 0,
    numeroCocinas: 0,
    numeroComedores: 0,
    plazasGaraje: 0,
    fotos: [],
  };
  if (!raw || typeof raw !== 'object') return fallback;
  const o = raw as Record<string, unknown>;
  const fotosIn = o['fotos'];
  const fotos = Array.isArray(fotosIn)
    ? fotosIn.map((f, i) => normalizeOneFoto(f, i))
    : [];

  return {
    codigoCasa: Number(o['codigoCasa'] ?? o['codigo_casa'] ?? 0),
    poblacion: String(o['poblacion'] ?? ''),
    descripcion: String(o['descripcion'] ?? ''),
    numeroDormitorios: Number(o['numeroDormitorios'] ?? 0),
    numeroBanos: Number(o['numeroBanos'] ?? 0),
    numeroCocinas: Number(o['numeroCocinas'] ?? 0),
    numeroComedores: Number(o['numeroComedores'] ?? 0),
    plazasGaraje: Number(o['plazasGaraje'] ?? 0),
    fotos,
  };
}
