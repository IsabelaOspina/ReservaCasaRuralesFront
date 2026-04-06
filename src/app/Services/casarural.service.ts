import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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

  /**
   * Detalle de casa por código (fotos, descripción, etc.).
   * Ajusta la ruta si tu controlador usa otro mapping.
   */
  obtenerCasaPorCodigo(codigoCasa: number): Observable<CasaRuralResponse> {
    return this.http
      .get<unknown>(`${this.apiUrl}/${codigoCasa}`)
      .pipe(map((raw) => normalizeCasaRuralResponse(raw)));
  }
}
