import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UsuarioService } from '../../Services/usuario.service';
import { readApiError } from '../../core/http-error.util';
import { ClienteRequest } from '../../DTO/cliente-request';
import { PropietarioRequest } from '../../DTO/propietario-request';

function telefonoValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = (control.value ?? '').toString().replace(/\s/g, '');
    if (!raw) return { required: true };
    if (!/^\d+$/.test(raw)) return { digitsOnly: true };
    if (raw.length < 8 || raw.length > 15) return { phoneLength: true };
    return null;
  };
}

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css',
})
export class RegistroComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly usuarioService = inject(UsuarioService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly rol = signal<'cliente' | 'propietario'>(
    (this.route.snapshot.data['rol'] as 'cliente' | 'propietario' | undefined) ?? 'cliente'
  );

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required]],
    usuario: ['', [Validators.required, Validators.minLength(3)]],
    correoElectronico: ['', [Validators.required, Validators.email]],
    telefonoContacto: ['', [telefonoValidator()]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    numeroCuenta: [''],
    banco: [''],
  });

  ngOnInit(): void {
    this.applyRolValidators();
  }

  private applyRolValidators(): void {
    const nc = this.form.get('numeroCuenta');
    const banco = this.form.get('banco');
    if (this.rol() === 'propietario') {
      nc?.setValidators([Validators.required]);
      banco?.setValidators([Validators.required]);
    } else {
      nc?.clearValidators();
      banco?.clearValidators();
      nc?.setValue('');
      banco?.setValue('');
    }
    nc?.updateValueAndValidity({ emitEvent: false });
    banco?.updateValueAndValidity({ emitEvent: false });
  }

  protected tituloRegistro(): string {
    return this.rol() === 'propietario'
      ? 'Registro como propietario'
      : 'Registro como cliente';
  }

  protected subtituloRegistro(): string {
    return this.rol() === 'propietario'
      ? 'Gestiona y publica tus casas rurales en la plataforma'
      : 'Crea tu cuenta para reservar estancias y disfrutar del refugio rural';
  }

  protected canSubmit(): boolean {
    return this.form.valid && !this.loading();
  }

  protected fieldState(
    name:
      | 'nombre'
      | 'usuario'
      | 'correoElectronico'
      | 'telefonoContacto'
      | 'password'
      | 'numeroCuenta'
      | 'banco'
  ): '' | 'invalid' | 'valid' {
    const c = this.form.get(name);
    if (!c) return '';
    if (!(c.dirty || c.touched)) return '';
    return c.invalid ? 'invalid' : 'valid';
  }

  protected togglePasswordVisibility() {
    this.showPassword.update((v) => !v);
  }

  protected limpiar() {
    this.successMessage.set('');
    this.errorMessage.set('');
    this.form.reset({
      nombre: '',
      usuario: '',
      correoElectronico: '',
      telefonoContacto: '',
      password: '',
      numeroCuenta: '',
      banco: '',
    });
    this.applyRolValidators();
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  protected onSubmit() {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid || this.loading()) return;

    const v = this.form.getRawValue();
    this.loading.set(true);

    if (this.rol() === 'cliente') {
      const payload: ClienteRequest = {
        username: v.usuario.trim(),
        password: v.password,
        nombre: v.nombre.trim(),
        correoElectronico: v.correoElectronico.trim(),
        telefonoContacto: v.telefonoContacto.replace(/\s/g, ''),
      };
      this.usuarioService.registrarCliente(payload).subscribe({
        next: (text: string) => {
          this.loading.set(false);
          this.errorMessage.set('');
          this.successMessage.set(text.trim() || 'Cliente registrado correctamente');
          this.limpiarAfterSuccess();
          setTimeout(() => this.router.navigate(['/login']), 2000);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.errorMessage.set(readApiError(err));
        },
      });
    } else {
      const payload: PropietarioRequest = {
        username: v.usuario.trim(),
        password: v.password,
        nombre: v.nombre.trim(),
        correoElectronico: v.correoElectronico.trim(),
        telefonoContacto: v.telefonoContacto.replace(/\s/g, ''),
        numeroCuenta: v.numeroCuenta.trim(),
        banco: v.banco.trim(),
      };
      this.usuarioService.registrarPropietario(payload).subscribe({
        next: (text: string) => {
          this.loading.set(false);
          this.errorMessage.set('');
          this.successMessage.set(text.trim() || 'Propietario registrado correctamente');
          this.limpiarAfterSuccess();
          setTimeout(() => this.router.navigate(['/login']), 2000);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.errorMessage.set(readApiError(err));
        },
      });
    }
  }

  private limpiarAfterSuccess(): void {
    this.form.reset({
      nombre: '',
      usuario: '',
      correoElectronico: '',
      telefonoContacto: '',
      password: '',
      numeroCuenta: '',
      banco: '',
    });
    this.applyRolValidators();
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }
}
