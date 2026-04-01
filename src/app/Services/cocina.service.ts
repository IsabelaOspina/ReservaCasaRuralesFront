import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

import { CocinaRequest } from '../DTO/Cocina-request';
import { CocinaResponse } from '../DTO/Cocina-response';

@Injectable({
  providedIn: 'root'
})
export class CocinaService {
  private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) {}

  registrarCocina(codigoCasa: number, data: CocinaRequest): Observable<CocinaResponse> {
    return this.http.post<CocinaResponse>(`${this.apiUrl}/${codigoCasa}/cocinas/registrar`, data);
  }

  listarCocinas(codigoCasa: number): Observable<CocinaResponse[]> {
    return this.http.get<CocinaResponse[]>(`${this.apiUrl}/${codigoCasa}/cocinas/listar`);
  }
}