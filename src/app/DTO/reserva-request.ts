export interface ReservaRequest {
  fechaInicio: string;
  noches: number;
  casaId: number;
  paqueteId: number;
  dormitoriosIds: number[];
}
