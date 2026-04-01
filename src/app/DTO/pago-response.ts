import { MetodoPago } from './pago-request';

export interface PagoResponse {
  idPago: number;
  monto: number;
  metodoPago: MetodoPago;
  fechaPago: string;
  confirmado: boolean;
}
