export interface ReservaResponse {
  id: number;
  fechaInicio: string; 
  fechaFin: string; 
  noches: number;
  estado: string;
  fechaLimitePago: string; 
  fechaCreacion: string; 
  casaId: number;
  paqueteId: number;
}