import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

import { ReservaRequest } from '../DTO/reserva-request';
import { ReservaResponse } from '../DTO/reserva-response';
import { DisponibilidadRequest } from '../DTO/disponibilidad-request';
import { DisponibilidadResponse } from '../DTO/disponibilidad-response';

@Injectable({
  providedIn: 'root'
})
export class ReservaService {
  private apiUrl = `${environment.apiUrl}/reservas`;

  constructor(private http: HttpClient) {}

  /**
   * Crear una nueva reserva (solo para usuarios con rol CLIENTE)
   * @param data - Datos de la reserva
   * @returns Observable con la reserva creada
   */
  crearReserva(data: ReservaRequest): Observable<ReservaResponse> {
    return this.http.post<ReservaResponse>(this.apiUrl, data);
  }

  /**
   * Verificar disponibilidad de fechas para una casa
   * @param data - Datos de disponibilidad (código de casa y fechas)
   * @returns Observable con información de disponibilidad
   */
  verificarDisponibilidad(data: DisponibilidadRequest): Observable<DisponibilidadResponse> {
    return this.http.post<DisponibilidadResponse>(`${this.apiUrl}/disponibilidad`, data);
  }
}