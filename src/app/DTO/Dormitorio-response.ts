import { TipoCama } from './Dormitorio-request';

export interface DormitorioResponse {
    idDormitorio: number;
    numeroCamas: number;
    nombre: string;
    tipoCama: TipoCama;
    tieneBano: boolean;
    codigoCasa: number;
}