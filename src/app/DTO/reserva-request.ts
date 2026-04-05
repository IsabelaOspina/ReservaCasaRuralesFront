/** Campos opcionales según backend: dormitorios vacíos; teléfono omitible (usa el del cliente). */
export interface ReservaRequest {
  fechaInicio: string;
  noches: number;
  casaId: number;
  paqueteId: number;
  dormitoriosIds?: number[];
  telefonoContacto?: string;
}
