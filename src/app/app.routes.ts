import { Routes } from '@angular/router';
import { LoginComponent } from './Components/Login/login.component';
import { RegistroComponent } from './Components/Login/registro.component';

export const routes: Routes = [
  { path: 'registro', component: RegistroComponent },
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: '/login', pathMatch: 'full' }
];
