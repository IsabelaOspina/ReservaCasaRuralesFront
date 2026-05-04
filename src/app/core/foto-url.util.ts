import { environment } from '../../environments/environment';
import { FotoResponse } from '../DTO/Foto-response';
import { CasaRuralResponse } from '../DTO/CasaRural-response';

type EnvWithBase = typeof environment & { apiBaseUrl?: string };

/**
 * URL usable en &lt;img src&gt; a partir de lo que devuelve el backend.
 * - http(s) absolutas: se devuelven tal cual.
 * - Rutas relativas (p. ej. /uploads/...): se antepone el origen del servidor Spring
 *   (environment.apiBaseUrl), p. ej. http://localhost:8080 + /uploads/... .
 *   No usar apiUrl (/api) para imágenes: en dev las fotos no van bajo /api.
 */
export function resolveFotoSrc(url: string | undefined | null): string | null {
  let u = (url ?? '').trim();
  if (!u) return null;
  u = u.replace(/\\/g, '/');
  const lower = u.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (!u.startsWith('/')) u = `/${u}`;

  const e = environment as EnvWithBase;
  const base = (e.apiBaseUrl ?? e.apiUrl).replace(/\/$/, '');
  /** Evita duplicar prefijo si la URL ya viene absoluta respecto a ese origen. */
  if (base.startsWith('http') && u.startsWith(base)) {
    return u;
  }
  if (base.startsWith('/') && (u === base || u.startsWith(`${base}/`))) {
    return u;
  }
  return `${base}${u}`;
}

function normalizeOneFoto(raw: unknown, index: number): FotoResponse {
  if (typeof raw === 'string') {
    const url = raw.trim();
    return { idFoto: index, url, descripcion: '' };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const url = String(
      o['url'] ??
        o['URL'] ??
        o['ruta'] ??
        o['rutaFoto'] ??
        o['path'] ??
        o['nombreArchivo'] ??
        ''
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

function fotoUrlSueltaEnCasa(o: Record<string, unknown>): string {
  const keys = [
    'fotoPrincipal',
    'imagenPrincipal',
    'urlFoto',
    'imagen',
    'fotoUrl',
    'portada',
    'urlImagen',
  ] as const;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
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
  const fotosIn =
    o['fotos'] ?? o['listaFotos'] ?? o['imagenes'] ?? o['fotosCasa'];
  let fotos = Array.isArray(fotosIn)
    ? fotosIn.map((f, i) => normalizeOneFoto(f, i))
    : [];
  const suelta = fotoUrlSueltaEnCasa(o);
  if (suelta && !fotos.some((f) => (f.url ?? '').trim())) {
    fotos = [{ idFoto: 0, url: suelta, descripcion: '' }];
  }

  const propietarioRaw = o['propietarioId'] ?? o['propietario_id'];
  const propietarioIdNum = Number(propietarioRaw);
  const propietarioId =
    propietarioRaw != null &&
    Number.isFinite(propietarioIdNum) &&
    propietarioIdNum > 0
      ? propietarioIdNum
      : undefined;

  return {
    codigoCasa: Number(o['codigoCasa'] ?? o['codigo_casa'] ?? 0),
    poblacion: String(
      o['nombre'] ??
        o['nombreCasa'] ??
        o['nombre_casa'] ??
        o['poblacion'] ??
        ''
    ),
    descripcion: String(o['descripcion'] ?? ''),
    numeroDormitorios: Number(
      o['numeroDormitorios'] ?? o['numDormitorios'] ?? o['num_dormitorios'] ?? 0
    ),
    numeroBanos: Number(o['numeroBanos'] ?? o['numBanos'] ?? o['num_banos'] ?? 0),
    numeroCocinas: Number(o['numeroCocinas'] ?? o['numCocinas'] ?? o['num_cocinas'] ?? 0),
    numeroComedores: Number(
      o['numeroComedores'] ?? o['numComedores'] ?? o['num_comedores'] ?? 0
    ),
    plazasGaraje: Number(o['plazasGaraje'] ?? o['plazas_garaje'] ?? 0),
    fotos,
    ...(propietarioId != null ? { propietarioId } : {}),
  };
}
