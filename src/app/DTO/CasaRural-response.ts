import { FotoResponse } from './Foto-response';
export interface CasaRuralResponse {
    codigoCasa: number;
    poblacion: string;
    descripcion: string;
    numeroDormitorios: number;
    numeroBanos: number;
    numeroCocinas: number;
    numeroComedores: number;
    plazasGaraje: number;
    fotos: FotoResponse[];
}