import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import {
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

const LS_CODIGO = 'cliente_codigo_casa';
const SS_RESERVA = 'cliente_ultima_reserva';

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
  /** Detalle de la casa (fotos, descripción); null si el backend no expone GET por código. */
  protected readonly casaDetalle = signal<CasaRuralResponse | null>(null);
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

  protected readonly codigoForm = this.fb.nonNullable.group({
    codigo: [1, [Validators.required, Validators.min(1)]],
  });

  protected readonly dispForm = this.fb.nonNullable.group({
    fechaInicio: ['', Validators.required],
    noches: [3, [Validators.required, Validators.min(1)]],
  });

  protected readonly reservaForm = this.fb.nonNullable.group({
    fechaInicio: ['', Validators.required],
    noches: [3, [Validators.required, Validators.min(1)]],
    paqueteId: [0, [Validators.required, Validators.min(1)]],
    telefonoContacto: [''],
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
        this.success.set(`Datos cargados para casa ${v}`);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingPaquetes.set(false);
        this.error.set(readApiError(err));
      },
    });
  }

  /** Solo http(s) para evitar javascript: en src de imagen. */
  protected urlFotoSegura(url: string | undefined | null): string | null {
    const u = (url ?? '').trim();
    if (!u) return null;
    const l = u.toLowerCase();
    if (l.startsWith('https://') || l.startsWith('http://')) return u;
    return null;
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
      this.error.set('Primero carga el código de casa');
      return;
    }
    if (this.dispForm.invalid) {
      this.dispForm.markAllAsTouched();
      return;
    }
    this.loadingDisp.set(true);
    this.disponibilidadResult.set(null);
    const d = this.dispForm.getRawValue();
    this.reservaService
      .verificarDisponibilidad({
        casaId: casa,
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
      this.error.set('Primero carga el código de casa');
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
        this.success.set(`Reserva creada (id ${res.id}). Fecha límite pago: ${res.fechaLimitePago}`);
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
          this.success.set('Pago registrado');
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
