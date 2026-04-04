export enum TipoAlquiler {
    CASA_COMPLETA = "CASA_COMPLETA",
    POR_HABITACIONES = "POR_HABITACIONES",
    CASA_COMPLETA_Y_HABITACIONES = "CASA_COMPLETA_Y_HABITACIONES"
}

export interface PaqueteAlquilerRequest {
    fechaInicio: string;     
    fechaFin: string;        
    precio: number;
    tipoAlquiler: TipoAlquiler;
}


