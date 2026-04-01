// payment.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Import your existing DTOs
import { PagoRequest } from '../DTO/pago-request';
import { PagoResponse } from '../DTO/pago-response';
import { PagoInfoResponse } from '../DTO/pagoinfo-response';

@Injectable({
  providedIn: 'root'
})
export class PagoService {
  private apiUrl = `${environment.apiUrl}/pagos`;

  constructor(private http: HttpClient) {}

  registrarPago(request: PagoRequest): Observable<PagoResponse> {
    return this.http.post<PagoResponse>(this.apiUrl, request);
  }

  obtenerInfoPago(reservaId: number): Observable<PagoInfoResponse> {
    return this.http.get<PagoInfoResponse>(`${this.apiUrl}/info/${reservaId}`);
  }

  obtenerPagosPorReserva(reservaId: number): Observable<PagoResponse[]> {
    return this.http.get<PagoResponse[]>(`${this.apiUrl}/${reservaId}`);
  }
}