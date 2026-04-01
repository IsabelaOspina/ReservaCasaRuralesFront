export interface PagoInfoResponse {
  "Total a pagar": number;
  "Anticipo necesario para reservar la casa": number;
  "Saldo restante por pagar": number;
  numeroCuenta: string;
  banco: string;
}
