import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import {
  getJwtRoles,
  hasRoleCliente,
  hasRolePropietario,
} from './jwt.util';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('token');
  if (!token) {
    router.navigate(['/login']);
    return false;
  }
  return true;
};

/** Si el JWT no trae roles parseables, se permite el acceso (el backend valida). */
export const clienteGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('token');
  if (!token) {
    router.navigate(['/login']);
    return false;
  }
  const roles = getJwtRoles(token);
  if (roles.length === 0) return true;
  if (hasRolePropietario(token) && !hasRoleCliente(token)) {
    router.navigate(['/propietario']);
    return false;
  }
  if (!hasRoleCliente(token)) {
    router.navigate(['/login']);
    return false;
  }
  return true;
};

export const propietarioGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('token');
  if (!token) {
    router.navigate(['/login']);
    return false;
  }
  const roles = getJwtRoles(token);
  if (roles.length === 0) return true;
  if (hasRoleCliente(token) && !hasRolePropietario(token)) {
    router.navigate(['/cliente']);
    return false;
  }
  if (!hasRolePropietario(token)) {
    router.navigate(['/login']);
    return false;
  }
  return true;
};
