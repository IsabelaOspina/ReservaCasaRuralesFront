import { HttpErrorResponse } from '@angular/common/http';

export function readApiError(err: HttpErrorResponse): string {
  const body = err.error;
  if (typeof body === 'object' && body !== null) {
    if ('error' in body && typeof (body as { error: unknown }).error === 'string') {
      return (body as { error: string }).error;
    }
    if ('detalle' in body && typeof (body as { detalle: unknown }).detalle === 'string') {
      return (body as { detalle: string }).detalle;
    }
  }
  if (typeof body === 'string' && body.trim()) return body;
  return err.message || 'Error de red o servidor';
}
