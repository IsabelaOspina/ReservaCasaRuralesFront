export enum TipoCama {
    DOBLE = 'DOBLE',
    SENCILLA = 'SENCILLA',
}
export interface DormitorioRequest {
    numeroCamas: number;
    nombre: string;
    tipoCama: TipoCama;
    tieneBano: boolean;
}