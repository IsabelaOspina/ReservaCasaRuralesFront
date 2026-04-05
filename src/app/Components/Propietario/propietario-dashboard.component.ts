import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CasaRuralService } from '../../Services/casarural.service';
import { PaqueteAlquilerService } from '../../Services/paquete.service';
import { DormitorioService } from '../../Services/dormitorio.service';
import { CocinaService } from '../../Services/cocina.service';
import { readApiError } from '../../core/http-error.util';
import { FotoRequest } from '../../DTO/Foto-request';
import { CasaRuralResponse } from '../../DTO/CasaRural-response';
import { PaqueteAlquilerResponse } from '../../DTO/paquete-response';
import { TipoAlquiler } from '../../DTO/paquete-request';
import { DormitorioResponse } from '../../DTO/Dormitorio-response';
import { CocinaResponse } from '../../DTO/Cocina-response';
import { TipoCama } from '../../DTO/Dormitorio-request';

const LS_CASAS = 'propietario_casas';

export interface CasaRegistradaLocal {
  codigoCasa: number;
  poblacion: string;
  descripcion?: string;
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

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  /** Valor decorativo: el backend ignora el id en la URL. */
  protected readonly propietarioUrlForm = this.fb.nonNullable.group({
    propietarioId: [0, [Validators.min(0)]],
  });

  protected readonly casaForm = this.fb.nonNullable.group({
    poblacion: ['', Validators.required],
    descripcion: ['', Validators.required],
    numeroDormitorios: [3, [Validators.required, Validators.min(3)]],
    numeroBanos: [2, [Validators.required, Validators.min(2)]],
    numeroCocinas: [1, [Validators.required, Validators.min(1)]],
    numeroComedores: [1, [Validators.required, Validators.min(0)]],
    plazasGaraje: [0, [Validators.required, Validators.min(0)]],
  });

  protected readonly fotosRows = this.fb.nonNullable.array([
    this.fb.nonNullable.group({
      url: [
        'https://ejemplo.com/fachada.jpg',
        [Validators.required, Validators.minLength(8)],
      ],
      descripcion: ['Fachada principal', Validators.required],
    }),
  ]);

  protected readonly paqueteForm = this.fb.nonNullable.group({
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required],
    precio: [100, [Validators.required, Validators.min(0.01)]],
    tipoAlquiler: [TipoAlquiler.CASA_COMPLETA, Validators.required],
  });

  protected readonly paqueteEditForm = this.fb.nonNullable.group({
    idPaquete: [0, [Validators.required, Validators.min(1)]],
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required],
    precio: [100, [Validators.required, Validators.min(0.01)]],
    tipoAlquiler: [TipoAlquiler.CASA_COMPLETA, Validators.required],
  });

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

  protected readonly tiposAlquiler = [
    TipoAlquiler.CASA_COMPLETA,
    TipoAlquiler.POR_HABITACIONES,
    TipoAlquiler.CASA_COMPLETA_Y_HABITACIONES,
  ];
  protected readonly tiposCama = [TipoCama.DOBLE, TipoCama.SENCILLA];

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

  protected setTab(
    t: 'casa' | 'paquetes' | 'dormitorios' | 'cocinas'
  ) {
    this.clearMessages();
    this.tab.set(t);
  }

  protected addFotoRow() {
    this.fotosRows.push(
      this.fb.nonNullable.group({
        url: [
          'https://ejemplo.com/foto.jpg',
          [Validators.required, Validators.minLength(8)],
        ],
        descripcion: ['', Validators.required],
      })
    );
  }

  protected removeFotoRow(index: number) {
    if (this.fotosRows.length <= 1) return;
    this.fotosRows.removeAt(index);
  }

  protected registrarCasa() {
    this.clearMessages();
    if (this.casaForm.invalid || this.fotosRows.invalid) {
      this.casaForm.markAllAsTouched();
      this.fotosRows.controls.forEach((c) => c.markAllAsTouched());
      this.error.set(
        'Completa población, descripción y, en cada foto, una URL válida y una descripción. ' +
          'Sustituye las URLs de ejemplo por las reales de tus imágenes.'
      );
      return;
    }
    const pid = this.propietarioUrlForm.getRawValue().propietarioId;
    const c = this.casaForm.getRawValue();
    const fotos: FotoRequest[] = this.fotosRows.getRawValue().map((row) => ({
      url: row.url.trim(),
      descripcion: row.descripcion.trim(),
    }));

    this.loading.set(true);
    this.casaService
      .registrarCasa(pid, {
        poblacion: c.poblacion.trim(),
        descripcion: c.descripcion.trim(),
        numeroDormitorios: c.numeroDormitorios,
        numeroBanos: c.numeroBanos,
        numeroCocinas: c.numeroCocinas,
        numeroComedores: c.numeroComedores,
        plazasGaraje: c.plazasGaraje,
        fotos,
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.ultimaAlta.set(res);
          const list = [...this.readCasasLs()];
          list.push({
            codigoCasa: res.codigoCasa,
            poblacion: res.poblacion,
            descripcion: res.descripcion,
          });
          this.persistCasas(list);
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
    this.paqueteService.listarPaquetesPorCasa(codigo).subscribe({
      next: (p) => {
        this.paquetes.set(p);
        this.dormitorioService.listarDormitorios(codigo).subscribe({
          next: (d) => {
            this.dormitorios.set(d);
            this.cocinaService.listarCocinas(codigo).subscribe({
              next: (c) => {
                this.cocinas.set(c);
                this.loading.set(false);
              },
              error: (err: HttpErrorResponse) => {
                this.loading.set(false);
                this.error.set(readApiError(err));
              },
            });
          },
          error: (err: HttpErrorResponse) => {
            this.loading.set(false);
            this.error.set(readApiError(err));
          },
        });
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
