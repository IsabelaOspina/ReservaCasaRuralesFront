export enum MetodoPago {
  TARJETA = 'TARJETA',
  EFECTIVO = 'EFECTIVO',
  TRANSFERENCIA = 'TRANSFERENCIA'
}

export interface PagoRequest {
  reservaId: number;
  monto: number;
  metodoPago: MetodoPago;
  /** Si se omite, el backend puede usar la fecha actual. */
  fechaPago?: string;
  /**
   * Alta por cliente: debe ser `false` hasta que el propietario confirme la recepción.
   * Si el backend lo ignora, hay que alinear la API con este flujo.
   */
  confirmado?: boolean;
}
