import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../Services/auth.service'; 
import { LoginRequest } from '../../DTO/login-request';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  protected readonly isSubmitting = signal(false);
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    correoElectronico: ['', [Validators.required, Validators.email]],
    contraseña: ['', [Validators.required, Validators.minLength(8)]],
    rememberMe: [true],
  });

  protected readonly canSubmit = computed(() =>
    this.form.valid && !this.isSubmitting()
  );

  protected togglePasswordVisibility() {
    this.showPassword.update(v => !v);
  }

  protected submit() {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    const data: LoginRequest = this.form.getRawValue();

    this.authService.login(data).subscribe({
      next: (res: any) => {
        console.log('Login exitoso', res);

        // Guardar token
        localStorage.setItem('token', res.token);

        this.isSubmitting.set(false);

        // 👉 opcional: redirigir
        // this.router.navigate(['/home']);
      },
      error: (err) => {
        console.error('Error en login', err);
        this.isSubmitting.set(false);
      }
    });
  }

  protected continueWithGoogle() {
    alert('Integración con Google pendiente.');
  }
}