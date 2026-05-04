import { TipoAlquiler } from './paquete-request';

export interface SubPaqueteRequest {
  fechaInicio: string;
  fechaFin: string;
  precio: number;
  tipoAlquiler?: TipoAlquiler;
}

export interface DividirPaqueteRequest {
  subPaquetes: SubPaqueteRequest[];
}
