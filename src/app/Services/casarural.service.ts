import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { normalizeCasaRuralResponse } from '../core/foto-url.util';

import { CasaRuralRequestDTO } from '../DTO/CasaRural-request';
import { CasaRuralResponse } from '../DTO/CasaRural-response';

@Injectable({
  providedIn: 'root',
})
export class CasaRuralService {
  private apiUrl = `${environment.apiUrl}/casa_rural`;

  constructor(private http: HttpClient) {}

  // HU003 - Registrar una nueva casa rural
  registrarCasa(data: CasaRuralRequestDTO): Observable<CasaRuralResponse> {
    const formData = new FormData();

    formData.append('poblacion', data.poblacion);
    formData.append('descripcion', data.descripcion);
    formData.append('numeroDormitorios', data.numeroDormitorios.toString());
    formData.append('numeroBanos', data.numeroBanos.toString());
    formData.append('numeroCocinas', data.numeroCocinas.toString());
    formData.append('numeroComedores', data.numeroComedores.toString());
    formData.append('plazasGaraje', data.plazasGaraje.toString());

    data.fotos.forEach((foto: File, index: number) => {
      formData.append('fotos', foto);
      formData.append('descripcionesFotos', data.descripcionesFotos[index]);
    });

    return this.http
      .post<unknown>(`${this.apiUrl}/registrar`, formData)
      .pipe(map((raw) => normalizeCasaRuralResponse(raw)));
  }

  /** GET /casa_rural/{codigo} — uso genérico si el backend lo expone. */
  obtenerCasaPorCodigo(codigoCasa: number): Observable<CasaRuralResponse> {
    return this.http
      .get<unknown>(`${this.apiUrl}/${codigoCasa}`)
      .pipe(map((raw) => normalizeCasaRuralResponse(raw)));
  }

  eliminarCasa(codigoCasa: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(
      `${this.apiUrl}/${codigoCasa}`
    );
  }

  /**
   * Ficha completa por código numérico — área cliente (JWT rol CLIENTE).
   * GET /casa_rural/cliente/codigo/{codigoCasa}
   */
  obtenerCasaClientePorCodigo(codigoCasa: number): Observable<CasaRuralResponse> {
    return this.http
      .get<unknown>(`${this.apiUrl}/cliente/codigo/${codigoCasa}`)
      .pipe(map((raw) => normalizeCasaRuralResponse(raw)));
  }

  /**
   * Listado público de casas (ajusta la ruta si tu controlador usa otro mapping).
   * Ej. GET /casa_rural/listar
   */
  listarCasasDisponibles(): Observable<CasaRuralResponse[]> {
    return this.http.get<unknown>(`${this.apiUrl}/listar`).pipe(
      map((raw) => this.parseListadoCasas(raw)),
      catchError(() => of([]))
    );
  }

  /** Alias por compatibilidad con implementaciones anteriores. */
  listarCasas(): Observable<CasaRuralResponse[]> {
    return this.listarCasasDisponibles();
  }

  /**
   * Búsqueda por población (subcadena, sin distinguir mayúsculas en el servidor).
   * GET /casa_rural/buscar?poblacion=… — rol CLIENTE.
   */
  buscarPorPoblacion(poblacion: string): Observable<CasaRuralResponse[]> {
    const q = poblacion.trim();
    const params = new HttpParams().set('poblacion', q);
    return this.http
      .get<unknown>(`${this.apiUrl}/buscar`, { params })
      .pipe(map((raw) => this.parseListadoCasas(raw)));
  }

  private parseListadoCasas(raw: unknown): CasaRuralResponse[] {
    if (Array.isArray(raw)) {
      return raw.map((x) => normalizeCasaRuralResponse(x));
    }
    if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      const inner =
        o['content'] ??
        o['data'] ??
        o['casas'] ??
        (o['_embedded'] as Record<string, unknown> | undefined)?.['casaRurals'];
      if (Array.isArray(inner)) {
        return inner.map((x) => normalizeCasaRuralResponse(x));
      }
    }
    return [];
  }
}
