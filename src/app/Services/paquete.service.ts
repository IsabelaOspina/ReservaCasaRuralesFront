import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

import { PaqueteAlquilerRequest } from '../DTO/paquete-request';
import { PaqueteAlquilerResponse } from '../DTO/paquete-response';
import { OcupacionPaqueteResponse } from '../DTO/ocupacion-response';
import { DividirPaqueteRequest } from '../DTO/dividir-paquete-request';

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

  /**
   * Obtener calendario de ocupación de los paquetes de una casa
   * @param codigoCasa - ID de la casa
   * @returns Observable con la lista de paquetes y sus periodos ocupados
   */
  obtenerOcupacionPorCasa(codigoCasa: number): Observable<OcupacionPaqueteResponse[]> {
    return this.http.get<OcupacionPaqueteResponse[]>(
      `${this.apiUrl}/casa/${codigoCasa}/ocupacion`
    );
  }

  /**
   * Dividir un paquete en sub-paquetes más pequeños
   * @param idPaquete - ID del paquete a dividir
   * @param data - Datos con los sub-paquetes
   * @returns Observable con la lista de paquetes creados
   */
  dividirPaquete(idPaquete: number, data: DividirPaqueteRequest): Observable<PaqueteAlquilerResponse[]> {
    return this.http.post<PaqueteAlquilerResponse[]>(
      `${this.apiUrl}/${idPaquete}/dividir`,
      data
    );
  }
}
