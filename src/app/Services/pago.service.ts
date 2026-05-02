import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

import { PagoRequest } from '../DTO/pago-request';
import { PagoResponse } from '../DTO/pago-response';
import { PagoInfoResponse } from '../DTO/pagoinfo-response';

@Injectable({
  providedIn: 'root'
})
export class PagoService {
  private apiUrl = `${environment.apiUrl}/pagos`;

  constructor(private http: HttpClient) {}

  /**
   * Registrar un nuevo pago
   * @param request - Datos del pago a registrar
   * @returns Observable con la respuesta del pago registrado
   */
  registrarPago(request: PagoRequest): Observable<PagoResponse> {
    return this.http.post<PagoResponse>(this.apiUrl, request);
  }

  /**
   * Registro de cobro por propietario (mismo cuerpo que {@link registrarPago}).
   * Requiere JWT con rol PROPIETARIO; mismo contrato de negocio que el alta del cliente.
   */
  registrarPagoPropietario(request: PagoRequest): Observable<PagoResponse> {
    return this.http.post<PagoResponse>(`${this.apiUrl}/registro-propietario`, request);
  }

  /**
   * Obtener información de pago para una reserva específica
   * @param reservaId - ID de la reserva
   * @returns Observable con la información de pago (total, anticipo, restante, datos bancarios)
   */
  obtenerInfoPago(reservaId: number): Observable<PagoInfoResponse> {
    return this.http.get<PagoInfoResponse>(`${this.apiUrl}/info/${reservaId}`);
  }

  /**
   * Obtener todos los pagos realizados para una reserva
   * @param reservaId - ID de la reserva
   * @returns Observable con la lista de pagos de la reserva
   */
  obtenerPagosPorReserva(reservaId: number): Observable<PagoResponse[]> {
    return this.http.get<PagoResponse[]>(`${this.apiUrl}/${reservaId}`);
  }
}