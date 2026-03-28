import { FotoRequest } from './foto-request';
export interface CasaRuralRequest {
    poblacion: string;
    descripcion: string;
    numeroDormitorios: number;
    numeroBanos: number;
    numeroCocinas:number;
    numeroComedores:number;
    plazasGaraje: number;
    fotos: FotoRequest[];
}