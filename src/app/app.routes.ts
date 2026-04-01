import { Routes } from '@angular/router';
import { LoginComponent } from './Components/Login/login.component';
import { RegistroComponent } from './Components/Login/registro.component';
import { RecuperarContrasenaPlaceholderComponent } from './Components/Login/recuperar-contrasena-placeholder.component';

export const routes: Routes = [
  { path: 'registro', component: RegistroComponent },
  { path: 'recuperar-contrasena', component: RecuperarContrasenaPlaceholderComponent },
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
];
