import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

// DTOs
import { ClienteRequest } from '../DTO/cliente-request';
import { PropietarioRequest } from '../DTO/propietario-request';
import { LoginRequest } from '../DTO/login-request';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {

  private apiUrl = `${environment.apiUrl}/usuario`;

  constructor(private http: HttpClient) {
    console.log("API URL FINAL", this.apiUrl);
    }


  // LOGIN — respuesta 200: texto plano "token:<JWT>"
  login(data: LoginRequest): Observable<string> {
    return this.http.post(`${this.apiUrl}/login`, data, { responseType: 'text' }).pipe(
      map((resp) => resp.replace(/^token:\s*/i, '').trim())
    );
  }
  // REGISTRAR CLIENTE
  registrarCliente(data: ClienteRequest): Observable<string> {
    return this.http.post(`${this.apiUrl}/registro-cliente`, data, {
      responseType: 'text'
    });
  }

  // REGISTRAR PROPIETARIO
  registrarPropietario(data: PropietarioRequest): Observable<string> {
    return this.http.post(`${this.apiUrl}/registro-propietario`, data, {
      responseType: 'text'
    });
  }
}
