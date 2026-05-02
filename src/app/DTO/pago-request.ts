export enum MetodoPago {
  TARJETA = 'TARJETA',
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA'
}

export interface PagoRequest {
  reservaId: number;
  monto: number;
  metodoPago: MetodoPago;
  /** Si se omite, el backend puede usar la fecha actual (p. ej. POST /pagos/registro-propietario). */
  fechaPago?: string;
  /** Si se omite, el backend aplica su propia política de confirmación. */
  confirmado?: boolean;
}
