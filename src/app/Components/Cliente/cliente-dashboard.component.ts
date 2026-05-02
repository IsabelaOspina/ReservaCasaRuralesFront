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
import { decodeJwtPayload } from '../../core/auth/jwt.util';
import { resolveFotoSrc } from '../../core/foto-url.util';
import { CasaRuralResponse } from '../../DTO/CasaRural-response';
import { MetodoPago } from '../../DTO/pago-request';
import { PaqueteAlquilerResponse } from '../../DTO/paquete-response';
import { DormitorioResponse } from '../../DTO/Dormitorio-response';
import { ReservaResponse } from '../../DTO/reserva-response';
import { PagoResponse } from '../../DTO/pago-response';
import { FotoResponse } from '../../DTO/Foto-response';
import { PagoInfoResponse, PagoInfoResponseAmigable, transformPagoInfoResponse } from '../../DTO/pagoinfo-response';
import { TipoAlquiler } from '../../DTO/paquete-request';

function hoyLocalISODate(): string {
  const h = new Date();
  const y = h.getFullYear();
  const m = String(h.getMonth() + 1).padStart(2, '0');
  const d = String(h.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fechaPagoNoPasada(control: AbstractControl): { fechaPagoPasada: true } | null {
  const v = control.value;
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string') return { fechaPagoPasada: true };
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { fechaPagoPasada: true };
  if (s < hoyLocalISODate()) return { fechaPagoPasada: true };
  return null;
}

const LS_CODIGO = 'cliente_codigo_casa';
const SS_RESERVA = 'cliente_ultima_reserva';
const LS_CATALOGO = 'cliente_catalogo_casas';
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
  /** Una sola habitación para paquete «por habitaciones». */
  protected readonly selectedDormId = signal<number | null>(null);

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

  /** Mensajes junto a la sección que dispara la acción (no en la cabecera global). */
  protected readonly msgCasas = signal<{ tipo: 'ok' | 'err'; texto: string } | null>(
    null
  );
  protected readonly msgDisp = signal<{ tipo: 'ok' | 'err'; texto: string } | null>(
    null
  );
  protected readonly msgReserva = signal<{ tipo: 'ok' | 'err'; texto: string } | null>(
    null
  );
  /** Avisos solo de la sección Pagos. */
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

  protected readonly buscarPoblacionForm = this.fb.nonNullable.group({
    poblacion: [''],
  });

  protected readonly loadingBusquedaPoblacion = signal(false);
  protected readonly modoListadoCasas = signal<'general' | 'busqueda'>('general');

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

  protected readonly pagoForm = this.fb.group({
    reservaId: [null as number | null, [Validators.required, Validators.min(1)]],
    monto: [0, [Validators.required, Validators.min(0.01)]],
    metodoPago: [MetodoPago.TRANSFERENCIA as MetodoPago, Validators.required],
    fechaPago: ['', [Validators.required, fechaPagoNoPasada]],
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
        const rid = this.ultimaReserva()?.id;
        if (rid != null && rid >= 1) {
          this.pagoForm.patchValue({ reservaId: rid });
        }
      } catch {
        /* ignore */
      }
    }
    this.pagoForm.patchValue({ fechaPago: hoyLocalISODate() });

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
        this.selectedDormId.set(null);
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

  /**
   * Casas guardadas localmente por cualquier sesión de propietario en este navegador
   * (clave `propietario_casas` o `propietario_casas_<usuario>`). Solo afecta al catálogo cliente;
   * el panel propietario usa solo la clave de su perfil.
   */
  private readPropietarioCasasLs(): CasaClienteCatalogo[] {
    const byCodigo = new Map<number, CasaClienteCatalogo>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('propietario_casas')) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
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
        if (!Array.isArray(arr)) continue;
        for (const x of arr) {
          if (x?.codigoCasa == null || !Number.isFinite(x.codigoCasa)) continue;
          byCodigo.set(x.codigoCasa, {
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
          });
        }
      }
    } catch {
      return [];
    }
    return Array.from(byCodigo.values()).sort((a, b) => a.codigoCasa - b.codigoCasa);
  }

  private coalesceNumCat(a?: number, b?: number): number | undefined {
    if (a != null && Number.isFinite(a)) return a;
    if (b != null && Number.isFinite(b)) return b;
    return undefined;
  }

  /** Convierte la respuesta de `/casa_rural/buscar` al mismo formato de tarjetas que el listado. */
  private apiRespuestasACatalogo(api: CasaRuralResponse[]): CasaClienteCatalogo[] {
    const out: CasaClienteCatalogo[] = [];
    for (const r of api) {
      if (!r?.codigoCasa) continue;
      out.push({
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
    return out.sort((a, b) => a.codigoCasa - b.codigoCasa);
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
    this.modoListadoCasas.set('general');
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

  protected buscarCasasPorPoblacion(): void {
    this.msgCasas.set(null);
    const q = this.buscarPoblacionForm.getRawValue().poblacion.trim();
    if (!q) {
      this.setMsgCasas('err', 'Indica una población para buscar.');
      this.buscarPoblacionForm.get('poblacion')?.markAsTouched();
      return;
    }
    this.loadingBusquedaPoblacion.set(true);
    this.casaRuralService.buscarPorPoblacion(q).subscribe({
      next: (api) => {
        this.loadingBusquedaPoblacion.set(false);
        this.modoListadoCasas.set('busqueda');
        this.casasListado.set(this.apiRespuestasACatalogo(api));
        if (api.length === 0) {
          this.setMsgCasas('ok', 'No hay casas que coincidan con esa población.');
        } else {
          this.setMsgCasas('ok', `${api.length} casa(s) encontrada(s).`);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loadingBusquedaPoblacion.set(false);
        this.setMsgCasas('err', readApiError(err));
      },
    });
  }

  protected verListadoGeneralCasas(): void {
    this.buscarPoblacionForm.patchValue({ poblacion: '' });
    this.refrescarListadoCompleto();
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
    this.msgCasas.set(null);
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
    this.setMsgCasas('err', 'No hay fotos para esta casa en este dispositivo.');
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

  /**
   * `precioPaquetePorNoche`: tarifa del paquete (€/noche).
   * `total`: precio del paquete × noches (una habitación; el tipo de cama no altera el importe).
   */
  protected precioReservaEstimado(): {
    precioPaquetePorNoche: number;
    total: number;
  } | null {
    const p = this.paqueteSeleccionado();
    if (!p) return null;
    const noches = Number(this.reservaForm.getRawValue().noches) || 0;
    if (noches <= 0) return null;
    const precioPaquetePorNoche = Number(p.precio) || 0;
    const total = precioPaquetePorNoche * noches;
    return { precioPaquetePorNoche, total };
  }

  private scrollToFeedback(id: string) {
    setTimeout(
      () =>
        document
          .getElementById(id)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
      0
    );
  }

  private setMsgCasas(tipo: 'ok' | 'err', texto: string) {
    this.msgCasas.set({ tipo, texto });
    this.scrollToFeedback('cli-feedback-casas');
  }

  private setMsgDisp(tipo: 'ok' | 'err', texto: string) {
    this.msgDisp.set({ tipo, texto });
    this.scrollToFeedback('cli-feedback-disp');
  }

  private setMsgReserva(tipo: 'ok' | 'err', texto: string) {
    this.msgReserva.set({ tipo, texto });
    this.scrollToFeedback('cli-feedback-reserva');
  }

  /**
   * Tras crear reserva: limpia dormitorios/disponibilidad y alinea fechas, noches y paquete con la reserva guardada
   * para que el «Total estimado» coincida con GET/POST pagos (mismos noches y paquete que en BD).
   */
  private resetFormularioTrasReservaExitosa(res?: ReservaResponse): void {
    this.selectedDormId.set(null);
    this.disponibilidadResult.set(null);
    if (res) {
      this.reservaForm.patchValue({
        fechaInicio: res.fechaInicio,
        noches: res.noches,
        paqueteId: res.paqueteId,
      });
      this.dispForm.patchValue({
        fechaInicio: res.fechaInicio,
        noches: res.noches,
      });
    } else {
      this.reservaForm.patchValue({ fechaInicio: '', noches: 3 });
      this.dispForm.patchValue({ fechaInicio: '', noches: 3 });
    }
    this.reservaForm.markAsPristine();
    this.reservaForm.markAsUntouched();
    this.dispForm.markAsPristine();
    this.dispForm.markAsUntouched();
  }

  private setPagoFeedback(tipo: 'error' | 'success', texto: string) {
    this.pagoMensaje.set({ tipo, texto });
    this.scrollToFeedback('pago-feedback');
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
    if (this.mostrarSeleccionDormitoriosReserva() && this.selectedDormId() == null) {
      return false;
    }
    return this.reservaForm.valid;
  }

  protected canRegistrarPago(): boolean {
    if (this.loadingPagos()) return false;
    return this.pagoForm.valid;
  }

  /** Fecha mínima (hoy local) para el input de fecha de pago. */
  protected fechaMinimaPago(): string {
    return hoyLocalISODate();
  }

  private normalizarListaPagos(list: PagoResponse[]): PagoResponse[] {
    const map = new Map<number, PagoResponse>();
    for (const p of list ?? []) {
      if (!p) continue;
      const ext = p as unknown as { id?: number };
      const id = Number(p.idPago ?? ext.id);
      if (!Number.isFinite(id)) continue;
      map.set(id, { ...p, idPago: id });
    }
    return [...map.values()].sort((a, b) => a.idPago - b.idPago);
  }

  /** Suma montos de la lista cargada. */
  protected totalPagadoReserva(): number {
    return this.pagosLista().reduce((s, p) => {
      const m = Number(p.monto);
      return s + (Number.isFinite(m) ? m : 0);
    }, 0);
  }

  /**
   * Saldo coherente con el total mostrado y los pagos ya registrados (evita desajustes al escalar importes).
   */
  protected saldoRestanteMostrado(info: PagoInfoResponseAmigable): number {
    const t = Number(info.totalAPagar);
    const total = Number.isFinite(t) && t > 0 ? t : 0;
    const pagado = this.totalPagadoReserva();
    return Math.round(Math.max(0, total - pagado) * 100) / 100;
  }

  private parseReservaIdDesdePagoForm(): number | null {
    const v = this.pagoForm.getRawValue().reservaId;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n < 1) return null;
    return n;
  }

  /**
   * Si el listado de pagos falla (p. ej. 404 sin movimientos), aún mostramos datos de transferencia.
   */
  private fetchPagoInfoYPagos(reservaId: number) {
    return forkJoin({
      raw: this.pagoService.obtenerInfoPago(reservaId),
      pagos: this.pagoService
        .obtenerPagosPorReserva(reservaId)
        .pipe(catchError(() => of([] as PagoResponse[]))),
    });
  }

  private aplicarRespuestaPagoCargado(
    _reservaId: number,
    raw: PagoInfoResponse,
    pagos: PagoResponse[]
  ): void {
    void _reservaId;
    this.pagoInfo.set(transformPagoInfoResponse(raw));
    this.pagosLista.set(this.normalizarListaPagos(pagos));
  }

  protected canComprobarDisponibilidad(): boolean {
    if (this.loadingDisp()) return false;
    if (this.codigoCasa() == null) return false;
    return this.dispForm.valid;
  }

  protected cargarDatosCasa(raw?: number) {
    this.msgCasas.set(null);
    const v = raw ?? this.codigoForm.getRawValue().codigo;
    if (v < 1) {
      this.setMsgCasas('err', 'Introduce un código de casa válido');
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
        this.selectedDormId.set(null);
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
        this.setMsgCasas('ok', `Datos cargados para ${nombre}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingPaquetes.set(false);
        this.setMsgCasas('err', readApiError(err));
      },
    });
  }

  protected seleccionarDormitorioReserva(id: number): void {
    this.selectedDormId.set(id);
  }

  protected isDormitorioReservaSeleccionado(id: number): boolean {
    return this.selectedDormId() === id;
  }

  protected verificarDisponibilidad() {
    this.clearMessages();
    const casa = this.codigoCasa();
    if (casa == null) {
      this.setMsgCasas('err', 'Selecciona o carga una casa primero');
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
          this.setMsgDisp('err', readApiError(err));
        },
      });
  }

  protected crearReserva() {
    this.clearMessages();
    const casa = this.codigoCasa();
    if (casa == null) {
      this.setMsgReserva('err', 'Selecciona una casa primero');
      return;
    }
    if (this.reservaForm.invalid) {
      this.reservaForm.markAllAsTouched();
      return;
    }
    if (this.mostrarSeleccionDormitoriosReserva() && this.selectedDormId() == null) {
      this.setMsgReserva('err', 'Selecciona una habitación para el paquete por habitaciones.');
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
    const dormId = this.selectedDormId();
    if (dormId != null && this.mostrarSeleccionDormitoriosReserva()) {
      body.dormitoriosIds = [dormId];
    }
    body.telefonoContacto = r.telefonoContacto.trim();

    this.reservaService.crearReserva(body).subscribe({
      next: (res) => {
        this.loadingReserva.set(false);
        this.ultimaReserva.set(res);
        sessionStorage.setItem(SS_RESERVA, JSON.stringify(res));
        this.pagoForm.patchValue({ reservaId: res.id });
        this.resetFormularioTrasReservaExitosa(res);
        this.setMsgReserva(
          'ok',
          `Reserva creada con ID ${res.id}. Fecha límite de pago: ${res.fechaLimitePago}`
        );
        this.irNav('pagos');
        this.cargarInfoPago({ preserveBanner: true });
      },
      error: (err: HttpErrorResponse) => {
        this.loadingReserva.set(false);
        this.setMsgReserva('err', readApiError(err));
      },
    });
  }

  protected cargarInfoPago(opts?: { preserveBanner?: boolean }) {
    if (!opts?.preserveBanner) this.pagoMensaje.set(null);
    const id = this.parseReservaIdDesdePagoForm();
    if (id == null) {
      this.setPagoFeedback('error', 'Indica un ID de reserva válido.');
      return;
    }
    this.loadingPagos.set(true);
    this.fetchPagoInfoYPagos(id).subscribe({
      next: ({ raw, pagos }) => {
        this.loadingPagos.set(false);
        this.aplicarRespuestaPagoCargado(id, raw, pagos);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingPagos.set(false);
        this.pagoInfo.set(null);
        this.pagosLista.set([]);
        this.setPagoFeedback('error', readApiError(err));
      },
    });
  }

  protected listarPagosReserva(opts?: { preserveBanner?: boolean }) {
    if (!opts?.preserveBanner) this.pagoMensaje.set(null);
    const id = this.parseReservaIdDesdePagoForm();
    if (id == null) {
      this.setPagoFeedback('error', 'Indica un ID de reserva válido.');
      return;
    }
    this.loadingPagos.set(true);
    this.fetchPagoInfoYPagos(id).subscribe({
      next: ({ raw, pagos }) => {
        this.loadingPagos.set(false);
        this.aplicarRespuestaPagoCargado(id, raw, pagos);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingPagos.set(false);
        this.pagoInfo.set(null);
        this.pagosLista.set([]);
        this.setPagoFeedback('error', readApiError(err));
      },
    });
  }

  protected registrarPago() {
    this.pagoMensaje.set(null);
    if (this.pagoForm.invalid) {
      this.pagoForm.markAllAsTouched();
      if (this.pagoForm.get('fechaPago')?.hasError('fechaPagoPasada')) {
        this.setPagoFeedback('error', 'La fecha de pago no puede ser anterior a hoy.');
      }
      return;
    }
    const p = this.pagoForm.getRawValue();
    const reservaId = this.parseReservaIdDesdePagoForm();
    const monto = p.monto;
    const metodoPago = p.metodoPago;
    const fechaPago = p.fechaPago;
    if (
      reservaId == null ||
      monto == null ||
      metodoPago == null ||
      !fechaPago?.trim()
    ) {
      this.pagoForm.markAllAsTouched();
      return;
    }
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum < 0.01) {
      this.pagoForm.markAllAsTouched();
      return;
    }
    const montoJson = Math.round(montoNum * 100) / 100;

    /** Importes y lista al día antes de validar y enviar (evita saldo obsoleto en pantalla). */
    this.loadingPagos.set(true);
    this.fetchPagoInfoYPagos(reservaId).subscribe({
      next: ({ raw, pagos }) => {
        this.aplicarRespuestaPagoCargado(reservaId, raw, pagos);
        const info = this.pagoInfo();
        if (!info) {
          this.loadingPagos.set(false);
          this.setPagoFeedback('error', 'No se pudieron cargar los importes de esta reserva.');
          return;
        }
        const pendiente = this.saldoRestanteMostrado(info);
        if (montoJson > pendiente + 0.005) {
          this.loadingPagos.set(false);
          this.setPagoFeedback(
            'error',
            `El importe supera el saldo pendiente (${pendiente.toFixed(2)} €).`
          );
          return;
        }

        this.pagoService
          .registrarPago({
            reservaId,
            monto: montoJson,
            metodoPago,
            fechaPago,
            confirmado: true,
          })
          .subscribe({
            next: () => {
              this.loadingPagos.set(false);
              this.setPagoFeedback('success', 'Pago registrado correctamente.');
              const rid = reservaId;
              const hoy = hoyLocalISODate();

              this.fetchPagoInfoYPagos(rid).subscribe({
                next: ({ raw: r2, pagos: p2 }) => {
                  this.aplicarRespuestaPagoCargado(rid, r2, p2);
                },
                error: () => {
                  this.pagoInfo.set(null);
                  this.pagosLista.set([]);
                },
              });

              this.pagoForm.patchValue({
                reservaId: rid,
                monto: 0,
                metodoPago: MetodoPago.TRANSFERENCIA,
                fechaPago: hoy,
              });
              this.pagoForm.markAsPristine();
              this.pagoForm.markAsUntouched();
            },
            error: (err: HttpErrorResponse) => {
              this.loadingPagos.set(false);
              this.setPagoFeedback('error', readApiError(err));
            },
          });
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
    this.msgCasas.set(null);
    this.msgDisp.set(null);
    this.msgReserva.set(null);
    this.pagoMensaje.set(null);
  }
}
