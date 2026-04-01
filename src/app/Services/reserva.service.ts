// reservation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Import your existing DTOs
import { ReservaRequest } from '../DTO/reserva-request';
import { ReservaResponse } from '../DTO/reserva-response';
import { DisponibilidadRequest } from '../DTO/disponibilidad-request';
import { DisponibilidadResponse } from '../DTO/disponibilidad-response';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private apiUrl = `${environment.apiUrl}/reservas`;

  constructor(private http: HttpClient) {}

  crear(request: ReservaRequest): Observable<ReservaResponse> {
    return this.http.post<ReservaResponse>(this.apiUrl, request);
  }

  verificarDisponibilidad(request: DisponibilidadRequest): Observable<DisponibilidadResponse> {
    return this.http.post<DisponibilidadResponse>(`${this.apiUrl}/disponibilidad`, request);
  }
}