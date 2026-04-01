export enum MetodoPago {
  TARJETA = 'TARJETA',
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA'
}

export interface PagoRequest {
  reservaId: number;
  monto: number;
  metodoPago: MetodoPago;
  fechaPago: string;
  confirmado: boolean;
}
