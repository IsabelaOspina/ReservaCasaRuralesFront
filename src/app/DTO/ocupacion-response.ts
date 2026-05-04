import { TipoAlquiler } from './paquete-request';

export interface PeriodoOcupadoResponse {
  fechaInicio: string;
  fechaFin: string;
  estado: string;
}

export interface OcupacionPaqueteResponse {
  idPaquete: number;
  fechaInicio: string;
  fechaFin: string;
  precio: number;
  tipoAlquiler: TipoAlquiler;
  periodosOcupados: PeriodoOcupadoResponse[];
}
