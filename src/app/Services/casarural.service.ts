// services/casa-rural.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

import { CasaRuralRequest } from '../DTO/casarural-request';
import { CasaRuralResponse } from '../DTO/casarural-response';

@Injectable({
  providedIn: 'root'
})
export class CasaRuralService {
  private apiUrl = `${environment.apiUrl}/casa_rural`;

  constructor(private http: HttpClient) {}

  registrarCasa(propietarioId: number, data: CasaRuralRequest): Observable<CasaRuralResponse> {
    return this.http.post<CasaRuralResponse>(`${this.apiUrl}/registrar/${propietarioId}`, data);
  }
}