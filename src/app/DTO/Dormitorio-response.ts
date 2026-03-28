
import { TipoCama } from './dormitorio-request';

export interface DormitorioResponse {
    idDormitorio: number;
    numeroCamas: number;
    tipoCama: TipoCama;
    tieneBano: boolean;
    codigoCasa: number;
}