import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

import { LoginRequest } from '../DTO/login-request';
import { LoginResponse } from '../DTO/login-response';
import { RegistroRequest } from '../DTO/registro-request';
import { RegistroResponse } from '../DTO/registro-response';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, data);
  }

  registrar(data: RegistroRequest): Observable<RegistroResponse> {
    return this.http.post<RegistroResponse>(`${this.apiUrl}/registro`, data);
  }
}