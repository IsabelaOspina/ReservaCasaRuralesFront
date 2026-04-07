import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PaqueteAlquilerService } from '../../Services/paquete.service';
import { PagoService } from '../../Services/pago.service';
import { ReservaService } from '../../Services/reserva.service';
import { DormitorioService } from '../../Services/dormitorio.service';
import { CasaRuralService } from '../../Services/casarural.service';
import { readApiError } from '../../core/http-error.util';
import { resolveFotoSrc } from '../../core/foto-url.util';
import { CasaRuralResponse } from '../../DTO/CasaRural-response';
import { MetodoPago } from '../../DTO/pago-request';
import { PaqueteAlquilerResponse } from '../../DTO/paquete-response';
import { DormitorioResponse } from '../../DTO/Dormitorio-response';
import { ReservaResponse } from '../../DTO/reserva-response';
import { PagoResponse } from '../../DTO/pago-response';
import {
  PagoInfoResponse,
  transformPagoInfoResponse,
} from '../../DTO/pagoinfo-response';
import { TipoAlquiler } from '../../DTO/paquete-request';

const LS_CODIGO = 'cliente_codigo_casa';
const SS_RESERVA = 'cliente_ultima_reserva';
const LS_CATALOGO = 'cliente_catalogo_casas';
const LS_PROPIETARIO_CASAS = 'propietario_casas';

/** Casas que el cliente ha cargado al menos una vez (sin API de listado global). */
export interface CasaClienteCatalogo {
  codigoCasa: number;
  poblacion: string;
  descripcion?: string;
  previewUrl?: string;
}

@Component({
  selector: 'app-cliente-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './cliente-dashboard.component.html',
  styleUrl: './cliente-dashboard.component.css',
})
export class ClienteDashboardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly reservaService = inject(ReservaService);
  private readonly pagoService = inject(PagoService);
  private readonly paqueteService = inject(PaqueteAlquilerService);
  private readonly dormitorioService = inject(DormitorioService);
  private readonly casaRuralService = inject(CasaRuralService);
  private readonly router = inject(Router);

  protected readonly codigoCasa = signal<number | null>(null);
  protected readonly casaDetalle = signal<CasaRuralResponse | null>(null);
  /** Casas mostradas en «Nuestras casas»: API + catálogo cliente + casas del panel propietario (mismo navegador). */
  protected readonly casasListado = signal<CasaClienteCatalogo[]>([]);
  protected readonly loadingListadoCasas = signal(false);
  protected readonly paquetes = signal<PaqueteAlquilerResponse[]>([]);
  protected readonly dormitorios = signal<DormitorioResponse[]>([]);
  protected readonly selectedDormIds = signal<number[]>([]);

  protected readonly loadingPaquetes = signal(false);
  protected readonly disponibilidadResult = signal<{ ok: boolean; msg: string } | null>(
    null
  );
  protected readonly loadingDisp = signal(false);

  protected readonly ultimaReserva = signal<ReservaResponse | null>(null);
  protected readonly loadingReserva = signal(false);

  protected readonly pagoInfo = signal(
    null as ReturnType<typeof transformPagoInfoResponse> | null
  );
  protected readonly pagosLista = signal<PagoResponse[]>([]);
  protected readonly loadingPagos = signal(false);

  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly modalGaleriaAbierta = signal(false);
  /** Detalle cargado solo para el modal (p. ej. otra casa de la tira sin ser la activa). */
  protected readonly galeriaCasa = signal<CasaRuralResponse | null>(null);
  protected readonly loadingGaleriaCasa = signal(false);
  protected readonly navActiva = signal<
    'flujo' | 'reservas' | 'disponibilidad' | 'pagos'
  >('flujo');

  protected readonly codigoForm = this.fb.nonNullable.group({
    codigo: [1, [Validators.required, Validators.min(1)]],
  });

  protected readonly dispForm = this.fb.nonNullable.group({
    fechaInicio: ['', Validators.required],
    noches: [3, [Validators.required, Validators.min(1)]],
  });

  private readonly telefonoOpcional = [
    Validators.pattern(/^$|^\+?[0-9\s\-]{7,20}$/),
  ];

  protected readonly reservaForm = this.fb.nonNullable.group({
    fechaInicio: ['', Validators.required],
    noches: [3, [Validators.required, Validators.min(1)]],
    paqueteId: [0, [Validators.required, Validators.min(1)]],
    telefonoContacto: ['', this.telefonoOpcional],
  });

  protected readonly pagoForm = this.fb.nonNullable.group({
    reservaId: [1, [Validators.required, Validators.min(1)]],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    metodoPago: [MetodoPago.TRANSFERENCIA as MetodoPago, Validators.required],
    fechaPago: ['', Validators.required],
    confirmado: [true],
  });

  protected readonly metodosPago = [
    MetodoPago.TRANSFERENCIA,
    MetodoPago.TARJETA,
    MetodoPago.EFECTIVO,
  ];

  constructor() {
    this.refrescarListadoCompleto();
    const saved = localStorage.getItem(LS_CODIGO);
    if (saved) {
      const n = parseInt(saved, 10);
      if (!Number.isNaN(n)) {
        this.codigoForm.patchValue({ codigo: n });
        this.cargarDatosCasa(n);
      }
    }
    const r = sessionStorage.getItem(SS_RESERVA);
    if (r) {
      try {
        this.ultimaReserva.set(JSON.parse(r) as ReservaResponse);
        if (this.ultimaReserva()?.id) {
          this.pagoForm.patchValue({ reservaId: this.ultimaReserva()!.id });
        }
      } catch {
        /* ignore */
      }
    }
    const hoy = new Date().toISOString().slice(0, 10);
    this.pagoForm.patchValue({ fechaPago: hoy });

    this.dispForm.valueChanges.subscribe(() => {
      const d = this.dispForm.getRawValue();
      this.reservaForm.patchValue(
        {
          fechaInicio: d.fechaInicio,
          noches: d.noches,
        },
        { emitEvent: false }
      );
    });
  }

  private readCatalogo(): CasaClienteCatalogo[] {
    try {
      const raw = localStorage.getItem(LS_CATALOGO);
      return raw ? (JSON.parse(raw) as CasaClienteCatalogo[]) : [];
    } catch {
      return [];
    }
  }

  private persistCatalogo(list: CasaClienteCatalogo[]) {
    localStorage.setItem(LS_CATALOGO, JSON.stringify(list));
  }

  private upsertCatalogo(entry: CasaClienteCatalogo) {
    const list = [...this.readCatalogo()];
    const i = list.findIndex((x) => x.codigoCasa === entry.codigoCasa);
    if (i >= 0) list[i] = { ...list[i], ...entry };
    else list.push(entry);
    this.persistCatalogo(list);
    this.refrescarListadoCompleto();
  }

  private readPropietarioCasasLs(): CasaClienteCatalogo[] {
    try {
      const raw = localStorage.getItem(LS_PROPIETARIO_CASAS);
      if (!raw) return [];
      const arr = JSON.parse(raw) as {
        codigoCasa: number;
        poblacion: string;
        descripcion?: string;
      }[];
      if (!Array.isArray(arr)) return [];
      return arr.map((x) => ({
        codigoCasa: x.codigoCasa,
        poblacion: (x.poblacion ?? '').trim() || `Casa ${x.codigoCasa}`,
        descripcion: x.descripcion,
      }));
    } catch {
      return [];
    }
  }

  private mergeCasasFuente(api: CasaRuralResponse[]): CasaClienteCatalogo[] {
    const map = new Map<number, CasaClienteCatalogo>();
    const add = (c: CasaClienteCatalogo) => {
      const prev = map.get(c.codigoCasa);
      if (!prev) {
        map.set(c.codigoCasa, { ...c });
        return;
      }
      const pv = (c.previewUrl ?? '').trim();
      const prevPv = (prev.previewUrl ?? '').trim();
      map.set(c.codigoCasa, {
        codigoCasa: c.codigoCasa,
        poblacion: (c.poblacion ?? '').trim() || prev.poblacion,
        descripcion: c.descripcion ?? prev.descripcion,
        previewUrl: pv || prevPv || undefined,
      });
    };
    for (const r of api) {
      if (!r?.codigoCasa) continue;
      add({
        codigoCasa: r.codigoCasa,
        poblacion: r.poblacion?.trim() || `Casa ${r.codigoCasa}`,
        descripcion: r.descripcion,
        previewUrl: r.fotos?.[0]?.url,
      });
    }
    for (const c of this.readCatalogo()) add(c);
    for (const c of this.readPropietarioCasasLs()) add(c);
    return Array.from(map.values()).sort((a, b) => a.codigoCasa - b.codigoCasa);
  }

  private refrescarListadoCompleto() {
    this.loadingListadoCasas.set(true);
    this.casaRuralService.listarCasasDisponibles().subscribe({
      next: (api) => {
        const merged = this.mergeCasasFuente(api);
        this.casasListado.set(merged);
        this.loadingListadoCasas.set(false);
        this.enriquecerPreviewsFaltantes(merged);
      },
      error: () => {
        this.loadingListadoCasas.set(false);
        this.casasListado.set(this.mergeCasasFuente([]));
      },
    });
  }

  /** Si el listado no trae fotos, pide el detalle por código (máx. 20) para rellenar miniatura. */
  private enriquecerPreviewsFaltantes(list: CasaClienteCatalogo[]) {
    const sin = list.filter((x) => !(x.previewUrl ?? '').trim()).slice(0, 20);
    if (sin.length === 0) return;
    forkJoin(
      sin.map((c) =>
        this.casaRuralService.obtenerCasaPorCodigo(c.codigoCasa).pipe(
          catchError(() => of(null))
        )
      )
    ).subscribe((detalles) => {
      const mapa = new Map(list.map((x) => [x.codigoCasa, { ...x }]));
      detalles.forEach((det, i) => {
        const c = sin[i];
        const url = det?.fotos?.[0]?.url;
        if (url && c) {
          const cur = mapa.get(c.codigoCasa);
          if (cur && !(cur.previewUrl ?? '').trim()) {
            cur.previewUrl = url;
            mapa.set(c.codigoCasa, cur);
          }
        }
      });
      this.casasListado.set(
        Array.from(mapa.values()).sort((a, b) => a.codigoCasa - b.codigoCasa)
      );
    });
  }

  protected idPublicoCasa(codigo: number): string {
    return `RUR-${String(codigo).padStart(3, '0')}`;
  }

  protected nombreCasaMostrar(): string {
    const d = this.casaDetalle();
    if (d?.poblacion?.trim()) return d.poblacion.trim();
    const c = this.codigoCasa();
    return c != null ? `Casa ${c}` : '';
  }

  protected hayDatosCasaCargados(): boolean {
    return this.codigoCasa() != null && !this.loadingPaquetes();
  }

  protected seleccionarCasaCatalogo(c: CasaClienteCatalogo) {
    this.codigoForm.patchValue({ codigo: c.codigoCasa });
    this.cargarDatosCasa(c.codigoCasa);
  }

  protected irNav(dest: 'flujo' | 'reservas' | 'disponibilidad' | 'pagos') {
    this.navActiva.set(dest);
    const map: Record<typeof dest, string> = {
      flujo: 'sec-casas',
      reservas: 'sec-reserva',
      disponibilidad: 'sec-disponibilidad',
      pagos: 'sec-pagos',
    };
    const id = map[dest];
    queueMicrotask(() =>
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  }

  protected casaGaleriaModal(): CasaRuralResponse | null {
    return this.galeriaCasa() ?? this.casaDetalle();
  }

  protected tituloGaleria(): string {
    const g = this.galeriaCasa();
    if (g?.poblacion?.trim()) return g.poblacion.trim();
    return this.nombreCasaMostrar();
  }

  protected abrirGaleria() {
    this.galeriaCasa.set(null);
    if ((this.casaDetalle()?.fotos?.length ?? 0) > 0) {
      this.modalGaleriaAbierta.set(true);
    }
  }

  /**
   * Construye un detalle mínimo solo con la URL de vista previa guardada en catálogo (mismo navegador).
   * Sirve mientras no exista GET /casa_rural/{codigo} en el servidor.
   */
  private casaDesdeCatalogoSoloPreview(c: CasaClienteCatalogo): CasaRuralResponse | null {
    const url = (c.previewUrl ?? '').trim();
    if (!url) return null;
    return {
      codigoCasa: c.codigoCasa,
      poblacion: c.poblacion,
      descripcion: c.descripcion ?? '',
      numeroDormitorios: 0,
      numeroBanos: 0,
      numeroCocinas: 0,
      numeroComedores: 0,
      plazasGaraje: 0,
      fotos: [
        {
          idFoto: 0,
          url,
          descripcion: 'Vista previa (datos en este navegador)',
        },
      ],
    };
  }

  /**
   * Galería desde tarjeta: detalle en memoria → GET (cuando exista) → miniatura del catálogo local.
   */
  protected abrirGaleriaCasa(c: CasaClienteCatalogo) {
    this.error.set(null);
    const detalle = this.casaDetalle();
    if (
      this.codigoCasa() === c.codigoCasa &&
      detalle &&
      detalle.codigoCasa === c.codigoCasa &&
      (detalle.fotos?.length ?? 0) > 0
    ) {
      this.galeriaCasa.set(null);
      this.modalGaleriaAbierta.set(true);
      return;
    }

    const desdeCatalogo = this.casaDesdeCatalogoSoloPreview(c);

    this.loadingGaleriaCasa.set(true);
    this.casaRuralService.obtenerCasaPorCodigo(c.codigoCasa).subscribe({
      next: (casa) => {
        this.loadingGaleriaCasa.set(false);
        if (casa && (casa.fotos?.length ?? 0) > 0) {
          this.galeriaCasa.set(casa);
          this.modalGaleriaAbierta.set(true);
          return;
        }
        if (desdeCatalogo) {
          this.galeriaCasa.set(desdeCatalogo);
          this.modalGaleriaAbierta.set(true);
          return;
        }
        this.error.set(
          'No hay fotos para esta casa. Tras registrar la casa con archivos, vuelve a cargarla por código para guardar la vista previa, o espera a que el backend publique GET de detalle por código.'
        );
      },
      error: () => {
        this.loadingGaleriaCasa.set(false);
        if (desdeCatalogo) {
          this.galeriaCasa.set(desdeCatalogo);
          this.modalGaleriaAbierta.set(true);
          return;
        }
        this.error.set(
          'El backend aún no publica GET de detalle por código (404 es esperable). Para ver fotos, carga la casa con «Cargar / actualizar» tras un registro con imágenes, o cuando exista ese GET en el servidor.'
        );
      },
    });
  }

  protected cerrarGaleria() {
    this.modalGaleriaAbierta.set(false);
    this.galeriaCasa.set(null);
  }

  protected etiquetaPaquete(p: PaqueteAlquilerResponse): string {
    const tipo =
      p.tipoAlquiler === TipoAlquiler.CASA_COMPLETA
        ? 'Casa completa'
        : p.tipoAlquiler === TipoAlquiler.POR_HABITACIONES
          ? 'Por habitaciones'
          : 'Casa y habitaciones';
    return `${tipo} · ${p.fechaInicio} → ${p.fechaFin}`;
  }

  protected nombrePaqueteCorto(p: PaqueteAlquilerResponse): string {
    return `Paquete #${p.idPaquete}`;
  }

  protected seleccionarPaquete(id: number) {
    this.reservaForm.patchValue({ paqueteId: id });
  }

  protected urlFotoSegura(url: string | undefined | null): string | null {
    return resolveFotoSrc(url);
  }

  protected fieldState(
    form: 'disp' | 'reserva' | 'pago',
    name: string
  ): '' | 'invalid' | 'valid' {
    let ctrl: AbstractControl | null = null;
    if (form === 'disp') ctrl = this.dispForm.get(name);
    else if (form === 'reserva') ctrl = this.reservaForm.get(name);
    else ctrl = this.pagoForm.get(name);
    if (!ctrl) return '';
    if (!(ctrl.dirty || ctrl.touched)) return '';
    return ctrl.invalid ? 'invalid' : 'valid';
  }

  protected canCrearReserva(): boolean {
    if (this.loadingReserva()) return false;
    if (this.codigoCasa() == null) return false;
    if (this.paquetes().length === 0) return false;
    return this.reservaForm.valid;
  }

  protected canRegistrarPago(): boolean {
    if (this.loadingPagos()) return false;
    return this.pagoForm.valid;
  }

  protected canComprobarDisponibilidad(): boolean {
    if (this.loadingDisp()) return false;
    if (this.codigoCasa() == null) return false;
    return this.dispForm.valid;
  }

  protected cargarDatosCasa(raw?: number) {
    this.error.set(null);
    this.success.set(null);
    const v = raw ?? this.codigoForm.getRawValue().codigo;
    if (v < 1) {
      this.error.set('Introduce un código de casa válido');
      return;
    }
    this.loadingPaquetes.set(true);
    this.codigoCasa.set(v);
    this.casaDetalle.set(null);
    localStorage.setItem(LS_CODIGO, String(v));

    forkJoin({
      paquetes: this.paqueteService.listarPaquetesPorCasa(v),
      dormitorios: this.dormitorioService.listarDormitorios(v),
      casa: this.casaRuralService.obtenerCasaPorCodigo(v).pipe(
        catchError(() => of(null))
      ),
    }).subscribe({
      next: ({ paquetes, dormitorios, casa }) => {
        this.paquetes.set(paquetes);
        const first = paquetes[0]?.idPaquete;
        if (first) {
          this.reservaForm.patchValue({ paqueteId: first });
        }
        this.dormitorios.set(dormitorios);
        this.selectedDormIds.set([]);
        this.casaDetalle.set(casa);
        this.loadingPaquetes.set(false);
        const nombre =
          casa?.poblacion?.trim() ?? `Casa ${v}`;
        this.upsertCatalogo({
          codigoCasa: v,
          poblacion: nombre,
          descripcion: casa?.descripcion,
          previewUrl: casa?.fotos?.[0]?.url,
        });
        this.success.set(`Datos cargados para ${nombre}`);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingPaquetes.set(false);
        this.error.set(readApiError(err));
      },
    });
  }

  protected toggleDorm(id: number) {
    this.selectedDormIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  }

  protected isDormSelected(id: number): boolean {
    return this.selectedDormIds().includes(id);
  }

  protected verificarDisponibilidad() {
    this.clearMessages();
    const casa = this.codigoCasa();
    if (casa == null) {
      this.error.set('Selecciona o carga una casa primero');
      return;
    }
    if (this.dispForm.invalid) {
      this.dispForm.markAllAsTouched();
      return;
    }
    this.loadingDisp.set(true);
    this.disponibilidadResult.set(null);
    const d = this.dispForm.getRawValue();
    const paqueteId =
      Number(this.reservaForm.getRawValue().paqueteId) > 0
        ? Number(this.reservaForm.getRawValue().paqueteId)
        : 0;
    this.reservaService
      .verificarDisponibilidad({
        casaId: casa,
        paqueteId,
        fechaInicio: d.fechaInicio,
        noches: d.noches,
      })
      .subscribe({
        next: (res) => {
          this.loadingDisp.set(false);
          this.disponibilidadResult.set({
            ok: res.disponible,
            msg: res.mensaje,
          });
        },
        error: (err: HttpErrorResponse) => {
          this.loadingDisp.set(false);
          this.error.set(readApiError(err));
        },
      });
  }

  protected crearReserva() {
    this.clearMessages();
    const casa = this.codigoCasa();
    if (casa == null) {
      this.error.set('Selecciona una casa primero');
      return;
    }
    if (this.reservaForm.invalid) {
      this.reservaForm.markAllAsTouched();
      return;
    }
    this.loadingReserva.set(true);
    const r = this.reservaForm.getRawValue();
    const body: {
      fechaInicio: string;
      noches: number;
      casaId: number;
      paqueteId: number;
      dormitoriosIds?: number[];
      telefonoContacto?: string;
    } = {
      fechaInicio: r.fechaInicio,
      noches: r.noches,
      casaId: casa,
      paqueteId: r.paqueteId,
    };
    const ids = this.selectedDormIds();
    if (ids.length > 0) body.dormitoriosIds = ids;
    const tel = r.telefonoContacto?.trim();
    if (tel) body.telefonoContacto = tel;

    this.reservaService.crearReserva(body).subscribe({
      next: (res) => {
        this.loadingReserva.set(false);
        this.ultimaReserva.set(res);
        sessionStorage.setItem(SS_RESERVA, JSON.stringify(res));
        this.pagoForm.patchValue({ reservaId: res.id });
        this.success.set(
          `Reserva creada con ID ${res.id}. Fecha límite de pago: ${res.fechaLimitePago}`
        );
      },
      error: (err: HttpErrorResponse) => {
        this.loadingReserva.set(false);
        this.error.set(readApiError(err));
      },
    });
  }

  protected cargarInfoPago() {
    this.clearMessages();
    const id = this.pagoForm.getRawValue().reservaId;
    if (id < 1) return;
    this.loadingPagos.set(true);
    this.pagoService.obtenerInfoPago(id).subscribe({
      next: (raw: PagoInfoResponse) => {
        this.loadingPagos.set(false);
        this.pagoInfo.set(transformPagoInfoResponse(raw));
      },
      error: (err: HttpErrorResponse) => {
        this.loadingPagos.set(false);
        this.pagoInfo.set(null);
        this.error.set(readApiError(err));
      },
    });
  }

  protected listarPagosReserva() {
    this.clearMessages();
    const id = this.pagoForm.getRawValue().reservaId;
    if (id < 1) return;
    this.loadingPagos.set(true);
    this.pagoService.obtenerPagosPorReserva(id).subscribe({
      next: (list) => {
        this.loadingPagos.set(false);
        this.pagosLista.set(list);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingPagos.set(false);
        this.pagosLista.set([]);
        this.error.set(readApiError(err));
      },
    });
  }

  protected registrarPago() {
    this.clearMessages();
    if (this.pagoForm.invalid) {
      this.pagoForm.markAllAsTouched();
      return;
    }
    const p = this.pagoForm.getRawValue();
    this.loadingPagos.set(true);
    this.pagoService
      .registrarPago({
        reservaId: p.reservaId,
        monto: p.monto,
        metodoPago: p.metodoPago,
        fechaPago: p.fechaPago,
        confirmado: p.confirmado,
      })
      .subscribe({
        next: () => {
          this.loadingPagos.set(false);
          this.success.set('Pago registrado correctamente');
          this.listarPagosReserva();
          this.cargarInfoPago();
        },
        error: (err: HttpErrorResponse) => {
          this.loadingPagos.set(false);
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
