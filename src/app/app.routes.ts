import { Routes } from '@angular/router';
import { LoginComponent } from './Components/Login/login.component';
import { RegistroComponent } from './Components/Login/registro.component';

export const routes: Routes = [
  { path: 'registro', redirectTo: 'registro/cliente', pathMatch: 'full' },
  {
    path: 'registro/cliente',
    component: RegistroComponent,
    data: { rol: 'cliente' as const },
  },
  {
    path: 'registro/propietario',
    component: RegistroComponent,
    data: { rol: 'propietario' as const },
  },
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
];
