export enum TipoCama {
    DOBLE = 'DOBLE',
    SENCILLA = 'SENCILLA',
}
export interface DormitorioRequest {
    numeroCamas: number;
    tipoCama: TipoCama;
    tieneBano: boolean;
}