// services/dormitorio.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

import { DormitorioRequest } from '../DTO/dormitorio-request';
import { DormitorioResponse } from '../DTO/dormitorio-response';

@Injectable({
  providedIn: 'root'
})
export class DormitorioService {
  private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) {}

  registrarDormitorio(codigoCasa: number, data: DormitorioRequest): Observable<DormitorioResponse> {
    return this.http.post<DormitorioResponse>(`${this.apiUrl}/${codigoCasa}/dormitorios/registrar`, data);
  }

  listarDormitorios(codigoCasa: number): Observable<DormitorioResponse[]> {
    return this.http.get<DormitorioResponse[]>(`${this.apiUrl}/${codigoCasa}/dormitorios/listar`);
  }
}