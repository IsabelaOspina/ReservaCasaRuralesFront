import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
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
import { decodeJwtPayload } from '../../core/auth/jwt.util';
import { resolveFotoSrc } from '../../core/foto-url.util';
import { CasaRuralResponse } from '../../DTO/CasaRural-response';
import { MetodoPago } from '../../DTO/pago-request';
import { PaqueteAlquilerResponse } from '../../DTO/paquete-response';
import { DormitorioResponse } from '../../DTO/Dormitorio-response';
import { TipoCama } from '../../DTO/Dormitorio-request';
import { ReservaResponse } from '../../DTO/reserva-response';
import { PagoResponse } from '../../DTO/pago-response';
import { FotoResponse } from '../../DTO/Foto-response';
import {
  PagoInfoResponse,
  transformPagoInfoResponse,
} from '../../DTO/pagoinfo-response';
import { TipoAlquiler } from '../../DTO/paquete-request';

const LS_CODIGO = 'cliente_codigo_casa';
const SS_RESERVA = 'cliente_ultima_reserva';
const LS_CATALOGO = 'cliente_catalogo_casas';
const LS_PROPIETARIO_CASAS = 'propietario_casas';
/** Teléfono guardado al registrar como cliente (misma sesión / dispositivo). */
const LS_CLIENTE_TEL = 'cliente_telefono_registro';

/** Casas que el cliente ha cargado al menos una vez (sin API de listado global). */
export interface CasaClienteCatalogo {
  codigoCasa: number;
  poblacion: string;
  descripcion?: string;
  previewUrl?: string;
  fotos?: FotoResponse[];
  /** Cupos de ficha si vienen de la API o del panel propietario (mismo navegador). */
  numeroDormitorios?: number;
  numeroBanos?: number;
  numeroCocinas?: number;
  numeroComedores?: number;
  plazasGaraje?: number;
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
  /** Avisos solo de la sección Pagos (no se muestran en la barra superior). */
  protected readonly pagoMensaje = signal<{
    tipo: 'error' | 'success';
    texto: string;
  } | null>(null);

  protected readonly modalGaleriaAbierta = signal(false);
  /** Detalle cargado solo para el modal (p. ej. otra casa de la tira sin ser la activa). */
  protected readonly galeriaCasa = signal<CasaRuralResponse | null>(null);
  protected readonly modalFichaAbierta = signal(false);
  protected readonly fichaCasaCatalogo = signal<CasaClienteCatalogo | null>(null);
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

  private readonly telefonoContactoValidators = [
    Validators.required,
    Validators.pattern(/^\+?[0-9\s\-]{7,20}$/),
  ];

  protected readonly reservaForm = this.fb.nonNullable.group({
    fechaInicio: ['', Validators.required],
    noches: [3, [Validators.required, Validators.min(1)]],
    paqueteId: [0, [Validators.required, Validators.min(1)]],
    telefonoContacto: ['', this.telefonoContactoValidators],
  });

  protected readonly pagoForm = this.fb.nonNullable.group({
    reservaId: [1, [Validators.required, Validators.min(1)]],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    metodoPago: [MetodoPago.TRANSFERENCIA as MetodoPago, Validators.required],
    fechaPago: ['', Validators.required],
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

    let telPref = localStorage.getItem(LS_CLIENTE_TEL) ?? '';
    if (!telPref) {
      const tok = localStorage.getItem('token');
      if (tok) {
        const pl = decodeJwtPayload(tok);
        const raw = pl?.['telefonoContacto'] ?? pl?.['telefono'];
        if (typeof raw === 'string' && raw.trim()) {
          telPref = raw.replace(/\s/g, '');
        }
      }
    }
    if (telPref) {
      this.reservaForm.patchValue({ telefonoContacto: telPref });
    }

    this.reservaForm.get('paqueteId')?.valueChanges.subscribe((pid) => {
      const p = this.paquetes().find((x) => x.idPaquete === pid);
      if (p?.tipoAlquiler !== TipoAlquiler.POR_HABITACIONES) {
        this.selectedDormIds.set([]);
      }
    });

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
    const defined = Object.fromEntries(
      Object.entries(entry).filter(([, v]) => v !== undefined)
    ) as CasaClienteCatalogo;
    if (i >= 0) list[i] = { ...list[i], ...defined };
    else list.push(defined);
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
        previewUrl?: string;
        fotos?: FotoResponse[];
        numeroDormitorios?: number;
        numeroBanos?: number;
        numeroCocinas?: number;
        numeroComedores?: number;
        plazasGaraje?: number;
      }[];
      if (!Array.isArray(arr)) return [];
      return arr.map((x) => ({
        codigoCasa: x.codigoCasa,
        poblacion: (x.poblacion ?? '').trim() || `Casa ${x.codigoCasa}`,
        descripcion: x.descripcion,
        previewUrl: x.previewUrl,
        fotos: x.fotos,
        numeroDormitorios: x.numeroDormitorios,
        numeroBanos: x.numeroBanos,
        numeroCocinas: x.numeroCocinas,
        numeroComedores: x.numeroComedores,
        plazasGaraje: x.plazasGaraje,
      }));
    } catch {
      return [];
    }
  }

  private coalesceNumCat(a?: number, b?: number): number | undefined {
    if (a != null && Number.isFinite(a)) return a;
    if (b != null && Number.isFinite(b)) return b;
    return undefined;
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
        fotos: (c.fotos?.length ?? 0) > 0 ? c.fotos : prev.fotos,
        numeroDormitorios: this.coalesceNumCat(c.numeroDormitorios, prev.numeroDormitorios),
        numeroBanos: this.coalesceNumCat(c.numeroBanos, prev.numeroBanos),
        numeroCocinas: this.coalesceNumCat(c.numeroCocinas, prev.numeroCocinas),
        numeroComedores: this.coalesceNumCat(c.numeroComedores, prev.numeroComedores),
        plazasGaraje: this.coalesceNumCat(c.plazasGaraje, prev.plazasGaraje),
      });
    };
    for (const r of api) {
      if (!r?.codigoCasa) continue;
      add({
        codigoCasa: r.codigoCasa,
        poblacion: r.poblacion?.trim() || `Casa ${r.codigoCasa}`,
        descripcion: r.descripcion,
        previewUrl: r.fotos?.[0]?.url,
        fotos: r.fotos,
        numeroDormitorios: r.numeroDormitorios,
        numeroBanos: r.numeroBanos,
        numeroCocinas: r.numeroCocinas,
        numeroComedores: r.numeroComedores,
        plazasGaraje: r.plazasGaraje,
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
      },
      error: () => {
        this.loadingListadoCasas.set(false);
        this.casasListado.set(this.mergeCasasFuente([]));
      },
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
    const fotos = (c.fotos?.length ?? 0) > 0
      ? c.fotos!
      : (c.previewUrl ?? '').trim()
        ? [{ idFoto: 0, url: (c.previewUrl ?? '').trim(), descripcion: 'Vista previa (datos en este navegador)' }]
        : [];
    if (fotos.length === 0) return null;
    return {
      codigoCasa: c.codigoCasa,
      poblacion: c.poblacion,
      descripcion: c.descripcion ?? '',
      numeroDormitorios: c.numeroDormitorios ?? 0,
      numeroBanos: c.numeroBanos ?? 0,
      numeroCocinas: c.numeroCocinas ?? 0,
      numeroComedores: c.numeroComedores ?? 0,
      plazasGaraje: c.plazasGaraje ?? 0,
      fotos,
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

    // Backend confirmado: no existe GET /casa_rural/{codigo} actualmente.
    if (desdeCatalogo) {
      this.galeriaCasa.set(desdeCatalogo);
      this.modalGaleriaAbierta.set(true);
      return;
    }
    this.error.set('No hay fotos para esta casa en este dispositivo.');
  }

  protected cerrarGaleria() {
    this.modalGaleriaAbierta.set(false);
    this.galeriaCasa.set(null);
  }

  protected abrirFichaCasa(c: CasaClienteCatalogo) {
    this.fichaCasaCatalogo.set(c);
    this.modalFichaAbierta.set(true);
  }

  protected cerrarFichaCasa() {
    this.modalFichaAbierta.set(false);
    this.fichaCasaCatalogo.set(null);
  }

  protected fichaDescripcionTexto(): string {
    const f = this.fichaCasaCatalogo();
    if (!f) return '';
    const det = this.casaDetalle();
    if (det?.codigoCasa === f.codigoCasa && det.descripcion?.trim()) {
      return det.descripcion.trim();
    }
    return (f.descripcion ?? '').trim() || 'Sin descripción en este dispositivo.';
  }

  protected fichaCupos(
    campo:
      | 'numeroDormitorios'
      | 'numeroBanos'
      | 'numeroCocinas'
      | 'numeroComedores'
      | 'plazasGaraje'
  ): string {
    const f = this.fichaCasaCatalogo();
    if (!f) return '—';
    const det = this.casaDetalle();
    if (det?.codigoCasa === f.codigoCasa) {
      const v = det[campo];
      return String(v ?? '—');
    }
    const v = f[campo];
    return v != null && Number.isFinite(v) ? String(v) : '—';
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

  protected etiquetaMetodoPago(m: MetodoPago): string {
    const map: Record<MetodoPago, string> = {
      [MetodoPago.TRANSFERENCIA]: 'Transferencia',
      [MetodoPago.TARJETA]: 'Tarjeta',
      [MetodoPago.EFECTIVO]: 'Efectivo',
    };
    return map[m] ?? String(m);
  }

  /** Solo el paquete «por habitaciones» permite elegir dormitorios en la reserva. */
  protected mostrarSeleccionDormitoriosReserva(): boolean {
    const id = this.reservaForm.getRawValue().paqueteId;
    if (!id) return false;
    const p = this.paquetes().find((x) => x.idPaquete === id);
    return p?.tipoAlquiler === TipoAlquiler.POR_HABITACIONES;
  }

  private paqueteSeleccionado(): PaqueteAlquilerResponse | null {
    const id = this.reservaForm.getRawValue().paqueteId;
    if (!id) return null;
    return this.paquetes().find((x) => x.idPaquete === id) ?? null;
  }

  private dormitoriosSeleccionados(): DormitorioResponse[] {
    const ids = new Set(this.selectedDormIds());
    if (ids.size === 0) return [];
    return this.dormitorios().filter((d) => ids.has(d.idDormitorio));
  }

  /**
   * Precio por noche de una habitación según tipo de cama.
   * - SENCILLA: 1x
   * - DOBLE: 1.25x (un poco más)
   */
  protected factorDormitorio(d: DormitorioResponse): number {
    return d.tipoCama === TipoCama.DOBLE ? 1.25 : 1;
  }

  protected totalHabitacionesFactor(): number {
    const sel = this.dormitoriosSeleccionados();
    if (sel.length === 0) return 0;
    return sel.reduce((acc, d) => acc + this.factorDormitorio(d), 0);
  }

  /** Estimación de precio (UI): para «por habitaciones» escala según habitaciones y tipo de cama. */
  protected precioReservaEstimado(): { porNoche: number; total: number } | null {
    const p = this.paqueteSeleccionado();
    if (!p) return null;
    const noches = Number(this.reservaForm.getRawValue().noches) || 0;
    if (noches <= 0) return null;

    let porNoche = Number(p.precio) || 0;
    if (p.tipoAlquiler === TipoAlquiler.POR_HABITACIONES) {
      const f = this.totalHabitacionesFactor();
      porNoche = porNoche * (f > 0 ? f : 0);
    }
    const total = porNoche * noches;
    return { porNoche, total };
  }

  private setPagoFeedback(tipo: 'error' | 'success', texto: string) {
    this.pagoMensaje.set({ tipo, texto });
    setTimeout(() =>
      document
        .getElementById('pago-feedback')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    );
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
    const tel = this.reservaForm.get('telefonoContacto');
    if (!tel?.valid) return false;
    if (this.mostrarSeleccionDormitoriosReserva() && this.selectedDormIds().length === 0) {
      return false;
    }
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
    }).subscribe({
      next: ({ paquetes, dormitorios }) => {
        this.paquetes.set(paquetes);
        const first = paquetes[0]?.idPaquete;
        if (first) {
          this.reservaForm.patchValue({ paqueteId: first });
        }
        this.dormitorios.set(dormitorios);
        this.selectedDormIds.set([]);
        this.loadingPaquetes.set(false);
        const local = this.casasListado().find((x) => x.codigoCasa === v);
        const casaLocal = local ? this.casaDesdeCatalogoSoloPreview(local) : null;
        this.casaDetalle.set(casaLocal);
        const nombre = casaLocal?.poblacion?.trim() ?? `Casa ${v}`;
        this.upsertCatalogo({
          codigoCasa: v,
          poblacion: nombre,
          descripcion: local?.descripcion ?? casaLocal?.descripcion,
          previewUrl: casaLocal?.fotos?.[0]?.url,
          fotos: casaLocal?.fotos,
          numeroDormitorios: local?.numeroDormitorios,
          numeroBanos: local?.numeroBanos,
          numeroCocinas: local?.numeroCocinas,
          numeroComedores: local?.numeroComedores,
          plazasGaraje: local?.plazasGaraje,
        });
        this.success.set(`Datos cargados para ${nombre}.`);
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
    if (this.mostrarSeleccionDormitoriosReserva() && this.selectedDormIds().length === 0) {
      this.error.set('Selecciona al menos 1 dormitorio para el paquete por habitaciones.');
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
    if (
      ids.length > 0 &&
      this.mostrarSeleccionDormitoriosReserva()
    ) {
      body.dormitoriosIds = ids;
    }
    body.telefonoContacto = r.telefonoContacto.trim();

    this.reservaService.crearReserva(body).subscribe({
      next: (res) => {
        this.loadingReserva.set(false);
        this.ultimaReserva.set(res);
        sessionStorage.setItem(SS_RESERVA, JSON.stringify(res));
        this.pagoForm.patchValue({ reservaId: res.id });
        this.success.set(
          `Reserva creada con ID ${res.id}. Fecha límite de pago: ${res.fechaLimitePago}`
        );
        this.selectedDormIds.set([]);
        this.reservaForm.patchValue({ fechaInicio: '', noches: 3 });
      },
      error: (err: HttpErrorResponse) => {
        this.loadingReserva.set(false);
        this.error.set(readApiError(err));
      },
    });
  }

  protected cargarInfoPago(opts?: { preserveBanner?: boolean }) {
    if (!opts?.preserveBanner) this.pagoMensaje.set(null);
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
        this.setPagoFeedback('error', readApiError(err));
      },
    });
  }

  protected listarPagosReserva(opts?: { preserveBanner?: boolean }) {
    if (!opts?.preserveBanner) this.pagoMensaje.set(null);
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
        this.setPagoFeedback('error', readApiError(err));
      },
    });
  }

  protected registrarPago() {
    this.pagoMensaje.set(null);
    if (this.pagoForm.invalid) {
      this.pagoForm.markAllAsTouched();
      return;
    }
    const p = this.pagoForm.getRawValue();
    const info = this.pagoInfo();
    if (info && Number.isFinite(info.totalAPagar) && p.monto > info.totalAPagar) {
      this.setPagoFeedback('error', 'El pago excede el total de la reserva');
      return;
    }
    this.loadingPagos.set(true);
    this.pagoService
      .registrarPago({
        reservaId: p.reservaId,
        monto: p.monto,
        metodoPago: p.metodoPago,
        fechaPago: p.fechaPago,
        confirmado: true,
      })
      .subscribe({
        next: () => {
          this.loadingPagos.set(false);
          this.setPagoFeedback('success', 'Pago registrado correctamente.');
          const hoy = new Date().toISOString().slice(0, 10);
          this.pagoForm.patchValue({
            monto: 0,
            metodoPago: MetodoPago.TRANSFERENCIA,
            fechaPago: hoy,
          });
          this.listarPagosReserva({ preserveBanner: true });
          this.cargarInfoPago({ preserveBanner: true });
        },
        error: (err: HttpErrorResponse) => {
          this.loadingPagos.set(false);
          this.setPagoFeedback('error', readApiError(err));
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
    this.pagoMensaje.set(null);
  }
}
