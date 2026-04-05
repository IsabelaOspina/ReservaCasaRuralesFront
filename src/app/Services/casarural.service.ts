import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

import { CasaRuralRequest } from '../DTO/CasaRural-request';
import { CasaRuralResponse } from '../DTO/CasaRural-response';

@Injectable({
  providedIn: 'root'
})
export class CasaRuralService {
  private apiUrl = `${environment.apiUrl}/casa_rural`;

  constructor(private http: HttpClient) {}

  registrarCasa(propietarioId: number, data: CasaRuralRequest): Observable<CasaRuralResponse> {
    return this.http.post<CasaRuralResponse>(`${this.apiUrl}/registrar/${propietarioId}`, data);
  }

  /**
   * Detalle de casa por código (fotos, descripción, etc.).
   * Ajusta la ruta si tu controlador usa otro mapping (ej. `/casa_rural/obtener/{id}`).
   */
  obtenerCasaPorCodigo(codigoCasa: number): Observable<CasaRuralResponse> {
    return this.http.get<CasaRuralResponse>(`${this.apiUrl}/${codigoCasa}`);
  }
}