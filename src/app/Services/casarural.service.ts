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

  registrarCasa(data: CasaRuralRequest): Observable<CasaRuralResponse> {
  
    const formData = new FormData();
    
    // Añadir campos simples
    formData.append('poblacion', data.poblacion);
    formData.append('descripcion', data.descripcion);
    formData.append('numeroDormitorios', data.numeroDormitorios.toString());
    formData.append('numeroBanos', data.numeroBanos.toString());
    formData.append('numeroCocinas', data.numeroCocinas.toString());
    formData.append('numeroComedores', data.numeroComedores.toString());
    formData.append('plazasGaraje', data.plazasGaraje.toString());
    
    // Añadir fotos y descripciones
    data.fotos.forEach((foto, index) => {
      formData.append('fotos', foto);
      formData.append('descripcionesFotos', data.descripcionesFotos[index]);
    });
    
    return this.http.post<CasaRuralResponse>(`${this.apiUrl}/registrar`, formData);
  }
}