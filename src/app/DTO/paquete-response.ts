import { TipoAlquiler } from './paquete-request';

export interface PaqueteAlquilerResponse {
    idPaquete: number;       
    fechaInicio: string;      
    fechaFin: string;      
    precio: number;              
    tipoAlquiler: TipoAlquiler;  
}