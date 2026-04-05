import { Routes } from '@angular/router';
import { LoginComponent } from './Components/Login/login.component';
import { RegistroComponent } from './Components/Login/registro.component';
import { ClienteDashboardComponent } from './Components/Cliente/cliente-dashboard.component';
import { PropietarioDashboardComponent } from './Components/Propietario/propietario-dashboard.component';
import { clienteGuard, propietarioGuard } from './core/auth/auth.guards';

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
  {
    path: 'cliente',
    component: ClienteDashboardComponent,
    canActivate: [clienteGuard],
  },
  {
    path: 'propietario',
    component: PropietarioDashboardComponent,
    canActivate: [propietarioGuard],
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
];
