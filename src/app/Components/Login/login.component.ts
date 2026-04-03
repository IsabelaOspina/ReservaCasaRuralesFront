import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../Services/usuario.service';
import { LoginRequest } from '../../DTO/login-request';

const LS_EMAIL = 'login_remember_email';
const LS_REMEMBER = 'login_remember_me';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  protected readonly isSubmitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    correoElectronico: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    rememberMe: [true],
  });

  protected canSubmit(): boolean {
    return this.form.valid && !this.isSubmitting();
  }

  ngOnInit(): void {
    const remembered = localStorage.getItem(LS_REMEMBER) === 'true';
    const savedEmail = localStorage.getItem(LS_EMAIL) ?? '';
    this.form.patchValue({
      rememberMe: remembered,
      correoElectronico: remembered ? savedEmail : this.form.getRawValue().correoElectronico,
    });
  }

  protected fieldState(
    name: 'correoElectronico' | 'password'
  ): '' | 'invalid' | 'valid' {
    const c = this.form.get(name);
    if (!c) return '';
    if (!(c.dirty || c.touched)) return '';
    return c.invalid ? 'invalid' : 'valid';
  }

  protected togglePasswordVisibility() {
    this.showPassword.update((v: boolean) => !v);
  }

  protected submit() {
    this.serverError.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    const raw = this.form.getRawValue();
    const data: LoginRequest = {
      correoElectronico: raw.correoElectronico.trim(),
      password: raw.password,
    };

    this.authService.login(data).subscribe({
      next: (res) => {
        if (res?.token) {
          localStorage.setItem('token', res.token);
        }
        if (raw.rememberMe) {
          localStorage.setItem(LS_REMEMBER, 'true');
          localStorage.setItem(LS_EMAIL, data.correoElectronico);
        } else {
          localStorage.removeItem(LS_REMEMBER);
          localStorage.removeItem(LS_EMAIL);
        }
        this.isSubmitting.set(false);
      },
      error: (err) => {
        const msg =
          err?.error?.error ??
          err?.error?.message ??
          'No se pudo iniciar sesión. Intenta de nuevo.';
        this.serverError.set(typeof msg === 'string' ? msg : 'Error al iniciar sesión');
        this.isSubmitting.set(false);
      },
    });
  }
}
