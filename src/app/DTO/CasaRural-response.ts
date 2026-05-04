import { FotoResponse } from './Foto-response';
export interface CasaRuralResponse {
  codigoCasa: number;
  /** Si el API lo envía, permite filtrar «solo mis casas» en el panel del propietario. */
  propietarioId?: number;
  poblacion: string;
  descripcion: string;
  numeroDormitorios: number;
  numeroBanos: number;
  numeroCocinas: number;
  numeroComedores: number;
  plazasGaraje: number;
  fotos: FotoResponse[];
}