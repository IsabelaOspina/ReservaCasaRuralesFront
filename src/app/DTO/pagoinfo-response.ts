// tipo original del backend 
export interface PagoInfoResponse {
    "Total a pagar": number;
    "Anticipo necesario para reservar la casa": number;
    "Saldo restante por pagar": number;
    numeroCuenta: string;
    banco: string;
}

// tipo amigable
export interface PagoInfoResponseAmigable {
    totalAPagar: number;
    anticipoReserva: number;
    saldoRestante: number;
    numeroCuenta: string;
    banco: string;
}

// Función de transformación
export function transformPagoInfoResponse(response: PagoInfoResponse): PagoInfoResponseAmigable {
    return {
        totalAPagar: response["Total a pagar"],
        anticipoReserva: response["Anticipo necesario para reservar la casa"],
        saldoRestante: response["Saldo restante por pagar"],
        numeroCuenta: response.numeroCuenta,
        banco: response.banco
    };
}