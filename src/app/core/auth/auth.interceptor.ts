import { HttpInterceptorFn } from '@angular/common/http';

const PUBLIC_USER_PATHS = ['/usuario/login', '/usuario/registro-cliente', '/usuario/registro-propietario'];

function isPublicUsuarioUrl(url: string): boolean {
  return PUBLIC_USER_PATHS.some((p) => url.includes(p));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (isPublicUsuarioUrl(req.url)) {
    return next(req);
  }
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) {
    return next(req);
  }
  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    })
  );
};
