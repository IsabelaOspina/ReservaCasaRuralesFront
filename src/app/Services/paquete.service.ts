import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

import { PaqueteAlquilerRequest } from '../DTO/paquete-request';
import { PaqueteAlquilerResponse } from '../DTO/paquete-response';

@Injectable({
  providedIn: 'root'
})
export class PaqueteAlquilerService {
  private apiUrl = `${environment.apiUrl}/paquetes`;

  constructor(private http: HttpClient) {}

  /**
   * Crear un paquete de alquiler para una casa específica
   * @param codigoCasa - ID de la casa
   * @param data - Datos del paquete de alquiler
   * @returns Observable con el paquete creado
   */
  crearPaquete(codigoCasa: number, data: PaqueteAlquilerRequest): Observable<PaqueteAlquilerResponse> {
    return this.http.post<PaqueteAlquilerResponse>(
      `${this.apiUrl}/${codigoCasa}/crear`, 
      data
    );
  }

  /**
   * Actualizar un paquete de alquiler existente
   * @param idPaquete - ID del paquete a actualizar
   * @param data - Nuevos datos del paquete
   * @returns Observable con el paquete actualizado
   */
  actualizarPaquete(idPaquete: number, data: PaqueteAlquilerRequest): Observable<PaqueteAlquilerResponse> {
    return this.http.put<PaqueteAlquilerResponse>(
      `${this.apiUrl}/${idPaquete}`, 
      data
    );
  }

  /**
   * Listar todos los paquetes de alquiler de una casa
   * @param codigoCasa - ID de la casa
   * @returns Observable con la lista de paquetes
   */
  listarPaquetesPorCasa(codigoCasa: number): Observable<PaqueteAlquilerResponse[]> {
    return this.http.get<PaqueteAlquilerResponse[]>(
      `${this.apiUrl}/casa/${codigoCasa}`
    );
  }
}