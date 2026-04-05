import { FotoRequest } from './Foto-request';
export class CasaRuralRequestDTO {
  poblacion: string;
  descripcion: string;
  numeroDormitorios: number;
  numeroBanos: number;
  numeroCocinas: number;
  numeroComedores: number;
  plazasGaraje: number;
  fotos: File[];
  descripcionesFotos: string[];

  constructor(data: Partial<CasaRuralRequestDTO> = {}) {
    this.poblacion = data.poblacion || '';
    this.descripcion = data.descripcion || '';
    this.numeroDormitorios = data.numeroDormitorios || 0;
    this.numeroBanos = data.numeroBanos || 0;
    this.numeroCocinas = data.numeroCocinas || 0;
    this.numeroComedores = data.numeroComedores || 0;
    this.plazasGaraje = data.plazasGaraje || 0;
    this.fotos = data.fotos || [];
    this.descripcionesFotos = data.descripcionesFotos || [];
  }
}