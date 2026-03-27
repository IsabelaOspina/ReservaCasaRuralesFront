import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../Services/auth.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { RegistroRequest } from '../../DTO/registro-request';
import { RegistroResponse } from '../../DTO/registro-response';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.css']
})
export class RegistroComponent {
  // Modelo para el formulario
  registroData: RegistroRequest = {
    nombre: '',
    usuario: '',
    password: '',
    correoElectronico: '',
    telefonoContacto: '',
    numeroCuenta: ''
  };

  // Variables para manejar el estado
  loading = false;
  errorMessage = '';
  successMessage = '';
  showPassword = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  // Método para enviar el formulario
  onSubmit() {
    // Limpiar mensajes anteriores
    this.errorMessage = '';
    this.successMessage = '';

    // Validar campos
    if (!this.validarFormulario()) {
      return;
    }

    this.loading = true;

    this.authService.registrar(this.registroData).subscribe({
      next: (response: RegistroResponse) => {
        this.loading = false;
        this.successMessage = `¡Registro exitoso! Bienvenido ${response.nombre}`;
        
        // Limpiar formulario
        this.resetFormulario();
        
        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (error) => {
        this.loading = false;
        console.error('Error en registro:', error);
        
        // Manejar diferentes tipos de errores
        if (error.status === 409) {
          this.errorMessage = 'El usuario o correo electrónico ya existe';
        } else if (error.status === 400) {
          this.errorMessage = 'Datos inválidos. Por favor verifica la información';
        } else if (error.status === 0) {
          this.errorMessage = 'Error de conexión. Verifica que el servidor esté disponible';
        } else {
          this.errorMessage = error.message || 'Error al registrar usuario. Intenta nuevamente';
        }
      }
    });
  }

  // Validación del formulario
  private validarFormulario(): boolean {
    // Validar nombre
    if (!this.registroData.nombre.trim()) {
      this.errorMessage = 'El nombre es obligatorio';
      return false;
    }

    // Validar usuario
    if (!this.registroData.usuario.trim()) {
      this.errorMessage = 'El nombre de usuario es obligatorio';
      return false;
    }
    if (this.registroData.usuario.length < 3) {
      this.errorMessage = 'El nombre de usuario debe tener al menos 3 caracteres';
      return false;
    }

    // Validar contraseña
    if (!this.registroData.password) {
      this.errorMessage = 'La contraseña es obligatoria';
      return false;
    }
    if (this.registroData.password.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres';
      return false;
    }

    // Validar correo electrónico
    if (!this.registroData.correoElectronico.trim()) {
      this.errorMessage = 'El correo electrónico es obligatorio';
      return false;
    }
    const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
    if (!emailRegex.test(this.registroData.correoElectronico)) {
      this.errorMessage = 'El correo electrónico no es válido';
      return false;
    }

    // Validar teléfono
    if (!this.registroData.telefonoContacto.trim()) {
      this.errorMessage = 'El teléfono de contacto es obligatorio';
      return false;
    }
    const phoneRegex = /^[0-9]{8,15}$/;
    if (!phoneRegex.test(this.registroData.telefonoContacto.replace(/\s/g, ''))) {
      this.errorMessage = 'El teléfono debe contener solo números y tener entre 8 y 15 dígitos';
      return false;
    }

    // Validar número de cuenta
    if (!this.registroData.numeroCuenta.trim()) {
      this.errorMessage = 'El número de cuenta es obligatorio';
      return false;
    }
    if (this.registroData.numeroCuenta.length < 5) {
      this.errorMessage = 'El número de cuenta debe tener al menos 5 caracteres';
      return false;
    }

    return true;
  }

  // Método para limpiar el formulario
  resetFormulario() {
    this.registroData = {
      nombre: '',
      usuario: '',
      password: '',
      correoElectronico: '',
      telefonoContacto: '',
      numeroCuenta: ''
    };
  }

  // Método para alternar visibilidad de contraseña
  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // Método para ir al login
  irAlLogin() {
    this.router.navigate(['/login']);
  }
}