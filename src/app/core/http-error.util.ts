import { HttpErrorResponse } from '@angular/common/http';

export function readApiError(err: HttpErrorResponse): string {
  const body = err.error;
  if (typeof body === 'object' && body !== null) {
    if ('message' in body && typeof (body as { message: unknown }).message === 'string') {
      const m = (body as { message: string }).message;
      if (m.trim()) return m;
    }
    if ('detail' in body && typeof (body as { detail: unknown }).detail === 'string') {
      const d = (body as { detail: string }).detail;
      if (d.trim()) return d;
    }
    if ('detalle' in body && typeof (body as { detalle: unknown }).detalle === 'string') {
      return (body as { detalle: string }).detalle;
    }
    if ('error' in body && typeof (body as { error: unknown }).error === 'string') {
      return (body as { error: string }).error;
    }
  }
  if (typeof body === 'string' && body.trim()) return body;
  return err.message || 'Error de red o servidor';
}
