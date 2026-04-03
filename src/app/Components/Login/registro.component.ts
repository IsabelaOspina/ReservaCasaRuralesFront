import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../Services/usuario.service';
import { RegistroRequest } from '../../DTO/registro-request';
import { RegistroResponse } from '../../DTO/registro-response';

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
export class RegistroComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');

  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required]],
    usuario: ['', [Validators.required, Validators.minLength(3)]],
    correoElectronico: ['', [Validators.required, Validators.email]],
    telefonoContacto: ['', [telefonoValidator()]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    numeroCuenta: ['', [Validators.required]],
  });

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
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  protected onSubmit() {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.form.markAllAsTouched();

    if (this.form.invalid || this.loading()) return;

    const v = this.form.getRawValue();
    const payload: RegistroRequest = {
      nombre: v.nombre.trim(),
      usuario: v.usuario.trim(),
      password: v.password,
      correoElectronico: v.correoElectronico.trim(),
      telefonoContacto: v.telefonoContacto.replace(/\s/g, ''),
      numeroCuenta: v.numeroCuenta.trim(),
    };

    this.loading.set(true);

    this.authService.registrar(payload).subscribe({
      next: (response: RegistroResponse) => {
        this.loading.set(false);
        this.errorMessage.set('');
        this.successMessage.set(`¡Registro exitoso! Bienvenido ${response.nombre}`);
        this.form.reset({
          nombre: '',
          usuario: '',
          correoElectronico: '',
          telefonoContacto: '',
          password: '',
          numeroCuenta: '',
        });
        this.form.markAsPristine();
        this.form.markAsUntouched();
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (error) => {
        this.loading.set(false);
        const serverMsg =
          error?.error?.error ??
          error?.error?.message ??
          (error.status === 409
            ? 'El usuario o correo electrónico ya existe'
            : error.status === 400
              ? 'Datos inválidos. Verifica la información'
              : error.status === 0
                ? 'Error de conexión. Comprueba que el servidor esté disponible'
                : 'Error al registrar. Intenta de nuevo');
        this.errorMessage.set(
          typeof serverMsg === 'string' ? serverMsg : 'Error al registrar'
        );
      },
    });
  }
}
