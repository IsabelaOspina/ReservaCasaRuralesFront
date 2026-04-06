import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CasaRuralService } from '../../Services/casarural.service';
import { PaqueteAlquilerService } from '../../Services/paquete.service';
import { DormitorioService } from '../../Services/dormitorio.service';
import { CocinaService } from '../../Services/cocina.service';
import { readApiError } from '../../core/http-error.util';
import { CasaRuralRequestDTO } from '../../DTO/CasaRural-request';
import { CasaRuralResponse } from '../../DTO/CasaRural-response';
import { PaqueteAlquilerResponse } from '../../DTO/paquete-response';
import { TipoAlquiler } from '../../DTO/paquete-request';
import { DormitorioResponse } from '../../DTO/Dormitorio-response';
import { CocinaResponse } from '../../DTO/Cocina-response';
import { TipoCama } from '../../DTO/Dormitorio-request';

const LS_CASAS = 'propietario_casas';

function rangoFechasPaquete(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const ini = group.get('fechaInicio')?.value;
    const fin = group.get('fechaFin')?.value;
    if (!ini || !fin) return null;
    return new Date(fin) >= new Date(ini) ? null : { fechas: true };
  };
}

/** Cupos declarados en el alta; necesarios si el GET de detalle de casa no está disponible. */
export interface CasaRegistradaLocal {
  codigoCasa: number;
  poblacion: string;
  descripcion?: string;
  /** Tope de registros POST dormitorio; se guarda tras alta o detalle GET. */
  numeroDormitorios?: number;
  /** Tope de registros POST cocina. */
  numeroCocinas?: number;
}

@Component({
  selector: 'app-propietario-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './propietario-dashboard.component.html',
  styleUrl: './propietario-dashboard.component.css',
})
export class PropietarioDashboardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly casaService = inject(CasaRuralService);
  private readonly paqueteService = inject(PaqueteAlquilerService);
  private readonly dormitorioService = inject(DormitorioService);
  private readonly cocinaService = inject(CocinaService);
  private readonly router = inject(Router);

  protected readonly tab = signal<'casa' | 'paquetes' | 'dormitorios' | 'cocinas'>('casa');

  protected readonly casasLocales = signal<CasaRegistradaLocal[]>([]);
  protected readonly codigoActivo = signal<number | null>(null);
  protected readonly ultimaAlta = signal<CasaRuralResponse | null>(null);

  protected readonly paquetes = signal<PaqueteAlquilerResponse[]>([]);
  protected readonly dormitorios = signal<DormitorioResponse[]>([]);
  protected readonly cocinas = signal<CocinaResponse[]>([]);
  /** Detalle de la casa activa (cupos); null hasta cargar API o reconstruir desde local. */
  protected readonly casaActivaDetalle = signal<CasaRuralResponse | null>(null);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly casaForm = this.fb.nonNullable.group({
    poblacion: ['', Validators.required],
    descripcion: ['', Validators.required],
    numeroDormitorios: [3, [Validators.required, Validators.min(3)]],
    numeroBanos: [2, [Validators.required, Validators.min(2)]],
    numeroCocinas: [1, [Validators.required, Validators.min(1)]],
    numeroComedores: [1, [Validators.required, Validators.min(0)]],
    plazasGaraje: [0, [Validators.required, Validators.min(0)]],
  });

  /** Una fila por foto: archivo (en `fotoFiles`) + descripción. El API usa multipart con File[]. */
  protected readonly fotosRows = this.fb.nonNullable.array([
    this.fb.nonNullable.group({
      descripcion: ['Fachada principal', Validators.required],
    }),
  ]);
  protected fotoFiles: (File | null)[] = [null];

  protected readonly paqueteForm = this.fb.nonNullable.group(
    {
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required],
      precio: [100, [Validators.required, Validators.min(0.01)]],
      tipoAlquiler: [TipoAlquiler.CASA_COMPLETA, Validators.required],
    },
    { validators: [rangoFechasPaquete()] }
  );

  protected readonly paqueteEditForm = this.fb.nonNullable.group(
    {
      idPaquete: [0, [Validators.required, Validators.min(1)]],
      fechaInicio: ['', Validators.required],
      fechaFin: ['', Validators.required],
      precio: [100, [Validators.required, Validators.min(0.01)]],
      tipoAlquiler: [TipoAlquiler.CASA_COMPLETA, Validators.required],
    },
    { validators: [rangoFechasPaquete()] }
  );

  protected readonly dormForm = this.fb.nonNullable.group({
    numeroCamas: [2, [Validators.required, Validators.min(1)]],
    nombre: ['', Validators.required],
    tipoCama: [TipoCama.DOBLE, Validators.required],
    tieneBano: [true],
  });

  protected readonly cocinaForm = this.fb.nonNullable.group({
    tieneLavavajillas: [false],
    tieneLavadora: [false],
  });

  protected tituloCasaActiva(): string {
    const id = this.codigoActivo();
    if (id == null) return '';
    const c = this.casasLocales().find((x) => x.codigoCasa === id);
    const nom = c?.poblacion?.trim();
    return nom ? `Casa Rural ${nom}` : `Casa código ${id}`;
  }

  /** Máximo de dormitorios registrables (alta de casa); null si aún no hay dato. */
  protected maxDormitoriosPermitidos(): number | null {
    const d = this.casaActivaDetalle();
    if (d != null && Number.isFinite(d.numeroDormitorios)) return d.numeroDormitorios;
    const loc = this.casasLocales().find(
      (x) => x.codigoCasa === this.codigoActivo()
    );
    return loc?.numeroDormitorios ?? null;
  }

  /** Máximo de cocinas registrables. */
  protected maxCocinasPermitidas(): number | null {
    const d = this.casaActivaDetalle();
    if (d != null && Number.isFinite(d.numeroCocinas)) return d.numeroCocinas;
    const loc = this.casasLocales().find(
      (x) => x.codigoCasa === this.codigoActivo()
    );
    return loc?.numeroCocinas ?? null;
  }

  protected cupoDormitoriosLleno(): boolean {
    const max = this.maxDormitoriosPermitidos();
    if (max == null) return false;
    return this.dormitorios().length >= max;
  }

  protected cupoCocinasLleno(): boolean {
    const max = this.maxCocinasPermitidas();
    if (max == null) return false;
    return this.cocinas().length >= max;
  }

  protected etiquetaTipoAlquiler(t: TipoAlquiler): string {
    const map: Record<TipoAlquiler, string> = {
      [TipoAlquiler.CASA_COMPLETA]: 'Casa completa',
      [TipoAlquiler.POR_HABITACIONES]: 'Por habitaciones',
      [TipoAlquiler.CASA_COMPLETA_Y_HABITACIONES]: 'Casa completa y habitaciones',
    };
    return map[t] ?? t;
  }

  protected etiquetaTipoCama(t: TipoCama): string {
    const map: Record<TipoCama, string> = {
      [TipoCama.DOBLE]: 'Doble',
      [TipoCama.SENCILLA]: 'Individual',
    };
    return map[t] ?? t;
  }

  protected fieldStateCasa(
    name:
      | 'poblacion'
      | 'descripcion'
      | 'numeroDormitorios'
      | 'numeroBanos'
      | 'numeroCocinas'
      | 'numeroComedores'
      | 'plazasGaraje'
  ): '' | 'invalid' | 'valid' {
    const c = this.casaForm.get(name);
    if (!c) return '';
    if (!(c.dirty || c.touched)) return '';
    return c.invalid ? 'invalid' : 'valid';
  }

  protected fieldStateFotoDesc(index: number): '' | 'invalid' | 'valid' {
    const g = this.fotosRows.at(index);
    const c = g?.get('descripcion');
    if (!c) return '';
    if (!(c.dirty || c.touched)) return '';
    return c.invalid ? 'invalid' : 'valid';
  }

  protected fieldStatePaquete(
    name: 'fechaInicio' | 'fechaFin' | 'precio' | 'tipoAlquiler',
    form: 'nuevo' | 'edit' = 'nuevo'
  ): '' | 'invalid' | 'valid' {
    const fg: FormGroup =
      form === 'nuevo' ? this.paqueteForm : this.paqueteEditForm;
    const c = fg.get(name);
    if (!c) return '';
    if (!(c.dirty || c.touched)) return '';
    return c.invalid ? 'invalid' : 'valid';
  }

  protected fieldStateDorm(
    name: 'nombre' | 'numeroCamas' | 'tipoCama'
  ): '' | 'invalid' | 'valid' {
    const c = this.dormForm.get(name);
    if (!c) return '';
    if (!(c.dirty || c.touched)) return '';
    return c.invalid ? 'invalid' : 'valid';
  }

  protected paqueteFechasInvalidas(form: 'nuevo' | 'edit'): boolean {
    const fg: FormGroup =
      form === 'nuevo' ? this.paqueteForm : this.paqueteEditForm;
    if (!fg.hasError('fechas')) return false;
    const ini = fg.get('fechaInicio');
    const fin = fg.get('fechaFin');
    return !!(ini?.dirty || ini?.touched || fin?.dirty || fin?.touched);
  }

  protected canRegistrarCasa(): boolean {
    if (this.loading()) return false;
    if (this.casaForm.invalid || this.fotosRows.invalid) return false;
    if (this.fotoFiles.some((f) => f == null)) return false;
    return true;
  }

  protected canCrearPaquete(): boolean {
    return (
      this.paqueteForm.valid &&
      !this.paqueteForm.hasError('fechas') &&
      this.codigoActivo() != null &&
      !this.loading()
    );
  }

  protected canActualizarPaquete(): boolean {
    return (
      this.paqueteEditForm.valid &&
      !this.paqueteEditForm.hasError('fechas') &&
      !this.loading()
    );
  }

  protected canRegistrarDormitorio(): boolean {
    if (
      !this.dormForm.valid ||
      this.codigoActivo() == null ||
      this.loading()
    ) {
      return false;
    }
    if (this.cupoDormitoriosLleno()) return false;
    return true;
  }

  protected canRegistrarCocina(): boolean {
    if (this.codigoActivo() == null || this.loading()) return false;
    if (this.cupoCocinasLleno()) return false;
    return true;
  }

  protected irVistaPrevia(): void {
    void this.router.navigate(['/cliente']);
  }

  protected readonly tiposAlquiler = [
    TipoAlquiler.CASA_COMPLETA,
    TipoAlquiler.POR_HABITACIONES,
    TipoAlquiler.CASA_COMPLETA_Y_HABITACIONES,
  ];
  /** Etiquetas UX; el API solo acepta valores del enum del backend. */
  protected readonly opcionesCama: { value: TipoCama; label: string }[] = [
    { value: TipoCama.DOBLE, label: 'Doble' },
    { value: TipoCama.SENCILLA, label: 'Individual (sencilla)' },
  ];

  constructor() {
    this.casasLocales.set(this.readCasasLs());
    const last = this.casasLocales()[0]?.codigoCasa;
    if (last) {
      this.codigoActivo.set(last);
      this.refrescarListas(last);
    }
  }

  private readCasasLs(): CasaRegistradaLocal[] {
    try {
      const raw = localStorage.getItem(LS_CASAS);
      return raw ? (JSON.parse(raw) as CasaRegistradaLocal[]) : [];
    } catch {
      return [];
    }
  }

  private persistCasas(list: CasaRegistradaLocal[]) {
    localStorage.setItem(LS_CASAS, JSON.stringify(list));
    this.casasLocales.set(list);
  }

  /** Si existe GET detalle, persiste cupos en LS para sesiones sin detalle. */
  private actualizarCuposEnLocal(codigo: number, casa: CasaRuralResponse) {
    const list = this.readCasasLs().map((c) =>
      c.codigoCasa === codigo
        ? {
            ...c,
            numeroDormitorios: casa.numeroDormitorios,
            numeroCocinas: casa.numeroCocinas,
            poblacion: casa.poblacion || c.poblacion,
            descripcion: casa.descripcion ?? c.descripcion,
          }
        : c
    );
    this.persistCasas(list);
  }

  /** Cupos conocidos sin GET completo (solo para límites UI). */
  private construirCasaDetalleDesdeLocal(codigo: number): CasaRuralResponse | null {
    const c = this.casasLocales().find((x) => x.codigoCasa === codigo);
    if (!c) return null;
    if (
      c.numeroDormitorios == null ||
      c.numeroCocinas == null ||
      !Number.isFinite(c.numeroDormitorios) ||
      !Number.isFinite(c.numeroCocinas)
    ) {
      return null;
    }
    return {
      codigoCasa: c.codigoCasa,
      poblacion: c.poblacion,
      descripcion: c.descripcion ?? '',
      numeroDormitorios: c.numeroDormitorios,
      numeroBanos: 0,
      numeroCocinas: c.numeroCocinas,
      numeroComedores: 0,
      plazasGaraje: 0,
      fotos: [],
    };
  }

  protected setTab(
    t: 'casa' | 'paquetes' | 'dormitorios' | 'cocinas'
  ) {
    this.clearMessages();
    this.tab.set(t);
  }

  protected addFotoRow() {
    this.fotosRows.push(
      this.fb.nonNullable.group({
        descripcion: ['', Validators.required],
      })
    );
    this.fotoFiles.push(null);
  }

  protected removeFotoRow(index: number) {
    if (this.fotosRows.length <= 1) return;
    this.fotosRows.removeAt(index);
    this.fotoFiles.splice(index, 1);
  }

  protected onFotoSeleccionada(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    this.fotoFiles[index] = input.files?.[0] ?? null;
  }

  protected nombreArchivoFoto(index: number): string {
    const f = this.fotoFiles[index];
    return f ? f.name : 'Ningún archivo seleccionado';
  }

  protected registrarCasa() {
    this.clearMessages();
    for (let i = 0; i < this.fotosRows.length; i++) {
      if (!this.fotoFiles[i]) {
        this.casaForm.markAllAsTouched();
        this.fotosRows.controls.forEach((c) => c.markAllAsTouched());
        this.error.set(
          'Selecciona un archivo de imagen en cada fila de fotos (el backend espera archivos, no URLs).'
        );
        return;
      }
    }
    if (this.casaForm.invalid || this.fotosRows.invalid) {
      this.casaForm.markAllAsTouched();
      this.fotosRows.controls.forEach((c) => c.markAllAsTouched());
      this.error.set('Completa población, descripción y la descripción de cada foto.');
      return;
    }
    const c = this.casaForm.getRawValue();
    const descripcionesFotos = this.fotosRows.controls.map((ctrl) =>
      String(ctrl.get('descripcion')?.value ?? '').trim()
    );
    const fotos: File[] = [];
    for (let i = 0; i < this.fotosRows.length; i++) {
      fotos.push(this.fotoFiles[i]!);
    }
    const dto = new CasaRuralRequestDTO({
      poblacion: c.poblacion.trim(),
      descripcion: c.descripcion.trim(),
      numeroDormitorios: c.numeroDormitorios,
      numeroBanos: c.numeroBanos,
      numeroCocinas: c.numeroCocinas,
      numeroComedores: c.numeroComedores,
      plazasGaraje: c.plazasGaraje,
      fotos,
      descripcionesFotos,
    });

    this.loading.set(true);
    this.casaService
      .registrarCasa(dto)
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.ultimaAlta.set(res);
          const list = [...this.readCasasLs()];
          list.push({
            codigoCasa: res.codigoCasa,
            poblacion: res.poblacion,
            descripcion: res.descripcion,
            numeroDormitorios: res.numeroDormitorios,
            numeroCocinas: res.numeroCocinas,
          });
          this.persistCasas(list);
          this.casaActivaDetalle.set(res);
          this.codigoActivo.set(res.codigoCasa);
          this.success.set(`Casa registrada. Código casa: ${res.codigoCasa}`);
          void this.refrescarListas(res.codigoCasa);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(readApiError(err));
        },
      });
  }

  protected seleccionarCasa(codigo: number) {
    this.clearMessages();
    this.codigoActivo.set(codigo);
    void this.refrescarListas(codigo);
  }

  private refrescarListas(codigo: number) {
    this.loading.set(true);
    const pre = this.construirCasaDetalleDesdeLocal(codigo);
    if (pre) this.casaActivaDetalle.set(pre);

    forkJoin({
      paquetes: this.paqueteService.listarPaquetesPorCasa(codigo),
      dormitorios: this.dormitorioService.listarDormitorios(codigo),
      cocinas: this.cocinaService.listarCocinas(codigo),
      casa: this.casaService
        .obtenerCasaPorCodigo(codigo)
        .pipe(catchError(() => of(null))),
    }).subscribe({
      next: (res) => {
        this.paquetes.set(res.paquetes);
        this.dormitorios.set(res.dormitorios);
        this.cocinas.set(res.cocinas);
        if (res.casa) {
          this.casaActivaDetalle.set(res.casa);
          this.actualizarCuposEnLocal(codigo, res.casa);
        } else {
          const fallback = this.construirCasaDetalleDesdeLocal(codigo);
          this.casaActivaDetalle.set(fallback);
        }
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(readApiError(err));
      },
    });
  }

  protected crearPaquete() {
    this.clearMessages();
    const codigo = this.codigoActivo();
    if (codigo == null) {
      this.error.set('Selecciona o registra una casa primero');
      return;
    }
    if (this.paqueteForm.invalid) {
      this.paqueteForm.markAllAsTouched();
      return;
    }
    const v = this.paqueteForm.getRawValue();
    this.loading.set(true);
    this.paqueteService
      .crearPaquete(codigo, {
        fechaInicio: v.fechaInicio,
        fechaFin: v.fechaFin,
        precio: v.precio,
        tipoAlquiler: v.tipoAlquiler,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set('Paquete creado');
          void this.refrescarListas(codigo);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(readApiError(err));
        },
      });
  }

  protected actualizarPaquete() {
    this.clearMessages();
    if (this.paqueteEditForm.invalid) {
      this.paqueteEditForm.markAllAsTouched();
      return;
    }
    const v = this.paqueteEditForm.getRawValue();
    this.loading.set(true);
    this.paqueteService
      .actualizarPaquete(v.idPaquete, {
        fechaInicio: v.fechaInicio,
        fechaFin: v.fechaFin,
        precio: v.precio,
        tipoAlquiler: v.tipoAlquiler,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set('Paquete actualizado');
          const c = this.codigoActivo();
          if (c != null) void this.refrescarListas(c);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(readApiError(err));
        },
      });
  }

  protected rellenarEdicionPaquete(p: PaqueteAlquilerResponse) {
    this.paqueteEditForm.patchValue({
      idPaquete: p.idPaquete,
      fechaInicio: p.fechaInicio,
      fechaFin: p.fechaFin,
      precio: p.precio,
      tipoAlquiler: p.tipoAlquiler,
    });
  }

  protected registrarDormitorio() {
    this.clearMessages();
    const codigo = this.codigoActivo();
    if (codigo == null) {
      this.error.set('Sin casa activa');
      return;
    }
    if (this.cupoDormitoriosLleno()) {
      const max = this.maxDormitoriosPermitidos();
      this.error.set(
        max != null
          ? `No se pueden registrar más dormitorios de los permitidos (${max}).`
          : 'No se pueden registrar más dormitorios de los permitidos.'
      );
      return;
    }
    if (this.dormForm.invalid) {
      this.dormForm.markAllAsTouched();
      return;
    }
    const v = this.dormForm.getRawValue();
    this.loading.set(true);
    this.dormitorioService
      .registrarDormitorio(codigo, {
        numeroCamas: v.numeroCamas,
        nombre: v.nombre.trim(),
        tipoCama: v.tipoCama,
        tieneBano: v.tieneBano,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set('Dormitorio registrado');
          void this.refrescarListas(codigo);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(readApiError(err));
        },
      });
  }

  protected registrarCocina() {
    this.clearMessages();
    const codigo = this.codigoActivo();
    if (codigo == null) {
      this.error.set('Sin casa activa');
      return;
    }
    if (this.cupoCocinasLleno()) {
      const max = this.maxCocinasPermitidas();
      this.error.set(
        max != null
          ? `No se pueden registrar más cocinas de las permitidas (${max}).`
          : 'No se pueden registrar más cocinas de las permitidas.'
      );
      return;
    }
    const v = this.cocinaForm.getRawValue();
    this.loading.set(true);
    this.cocinaService
      .registrarCocina(codigo, {
        tieneLavavajillas: v.tieneLavavajillas,
        tieneLavadora: v.tieneLavadora,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set('Cocina registrada');
          void this.refrescarListas(codigo);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(readApiError(err));
        },
      });
  }

  protected logout() {
    localStorage.removeItem('token');
    void this.router.navigateByUrl('/login');
  }

  protected clearMessages() {
    this.error.set(null);
    this.success.set(null);
  }
}
