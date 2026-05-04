import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

import { ReservaRequest } from '../DTO/reserva-request';
import { ReservaResponse } from '../DTO/reserva-response';
import { DisponibilidadRequest } from '../DTO/disponibilidad-request';
import { DisponibilidadResponse } from '../DTO/disponibilidad-response';
import { NotificacionResponse } from '../DTO/notificacion-response';

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
  /**
   * Obtener todas las reservas del cliente autenticado
   * @returns Observable con la lista de reservas del cliente
   */
  obtenerMisReservas(): Observable<ReservaResponse[]> {
    return this.http.get<ReservaResponse[]>(`${this.apiUrl}/mis-reservas`);
  }

  /**
   * Obtener reservas pendientes del propietario autenticado
   * @returns Observable con la lista de reservas pendientes
   */
  obtenerReservasPendientes(): Observable<ReservaResponse[]> {
    return this.http.get<ReservaResponse[]>(`${this.apiUrl}/pendientes`);
  }

  /**
   * Cancelar una reserva (solo si no se ha pagado el 20%)
   * @param id - ID de la reserva a cancelar
   * @returns Observable con la reserva cancelada
   */
  cancelarReserva(id: number): Observable<ReservaResponse> {
    return this.http.put<ReservaResponse>(`${this.apiUrl}/${id}/cancelar`, {});
  }

  /**
   * Obtener notificaciones de reservas expiradas del propietario
   * @returns Observable con la lista de notificaciones
   */
  obtenerNotificaciones(): Observable<NotificacionResponse[]> {
    return this.http.get<NotificacionResponse[]>(`${this.apiUrl}/notificaciones`);
  }
}
