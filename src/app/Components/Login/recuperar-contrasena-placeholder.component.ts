import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="wrap">
      <p>La recuperación de contraseña no está disponible aún en el servidor.</p>
      <a routerLink="/login">Volver al inicio de sesión</a>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      padding: 2rem;
      font-family: 'Poppins', system-ui, sans-serif;
      background: var(--rural-beige, #f5f5dc);
      color: var(--text-900, #1f2937);
    }
    .wrap {
      max-width: 28rem;
      margin: 4rem auto;
      text-align: center;
    }
    a {
      color: var(--rural-earth, #a0522d);
      font-weight: 600;
    }
  `,
})
export class RecuperarContrasenaPlaceholderComponent {}
