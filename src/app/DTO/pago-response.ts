import { PagoRequest } from './pago-response';
export interface PagoResponse {
  idPago: number;
  monto: number;
  metodoPago: MetodoPago;
  fechaPago: string;
  confirmado: boolean;
}
