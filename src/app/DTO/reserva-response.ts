export interface ReservaResponse {
  id: number;
  fechaInicio: string; 
  fechaFin: string; 
  noches: number;
  confirmada: boolean;
  fechaLimitePago: string; 
  fechaCreacion: string; 
  casaId: number;
  paqueteId: number;
}