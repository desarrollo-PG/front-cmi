import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

// ✅ AGREGAR esta interfaz
interface Notification {
  type: 'success' | 'error' | 'info';
  message: string;
  show: boolean;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  modoOlvidoClave = false;
  usuario = '';
  clave = '';
  correoRecuperacion = '';
  error = '';

  // ✅ AGREGAR esta propiedad
  notification: Notification = {
    type: 'info',
    message: '',
    show: false
  };

  constructor(private authService: AuthService, private router: Router) {}

  // ✅ AGREGAR estos métodos
  showNotification(type: 'success' | 'error' | 'info', message: string) {
    this.notification = { type, message, show: true };
    setTimeout(() => {
      this.hideNotification();
    }, 4000);
  }

  hideNotification() {
    this.notification.show = false;
  }

  getNotificationIcon(): string {
    switch (this.notification.type) {
      case 'success': return 'fas fa-check-circle';
      case 'error': return 'fas fa-exclamation-circle';
      case 'info': return 'fas fa-info-circle';
      default: return 'fas fa-info-circle';
    }
  }

  cambiarModo() {
    this.modoOlvidoClave = !this.modoOlvidoClave;
    this.correoRecuperacion = '';
    this.error = '';
    this.hideNotification();
  }

  onSubmitLogin() {
    if (!this.usuario || !this.clave) {
      this.showNotification('error', 'Debe ingresar usuario y contraseña');
      return;
    }

    this.authService.login(this.usuario, this.clave).subscribe({
      next: (res) => {        
        if (res.success) {
          this.showNotification('success', '¡Inicio de sesión exitoso!');
          
          setTimeout(() => {
            this.authService.handleLoginResponse(res);
          }, 1500);
          
        } else {
          this.showNotification('error', res.message || 'Error desconocido');
        }
      },
      error: (err) => {
        this.showNotification('error', err.error?.message || 'Error de conexión');
      }
    });
  }

  onSubmitReset() {
    if (!this.correoRecuperacion) {
      this.showNotification('error', 'Por favor ingrese su correo electrónico');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.correoRecuperacion)) {
      this.showNotification('error', 'Por favor ingrese un correo electrónico válido');
      return;
    }

    this.authService.resetearPassword(this.correoRecuperacion).subscribe({
      next: (res) => {
        if (res.success) {
          this.showNotification('success', 'Se ha enviado una contraseña temporal a tu correo electrónico');
          setTimeout(() => {
            this.cambiarModo();
          }, 3000);
        } else {
          this.showNotification('error', res.message || 'Error al enviar el correo');
        }
      },
      error: (err) => {
        let mensaje = 'Error al enviar el correo de recuperación';
        
        if (err.error?.message) {
          if (err.error.message.includes('no encontrado') || err.error.message.includes('inválidas')) {
            mensaje = 'No se encontró un usuario con ese correo electrónico';
          } else if (err.error.message.includes('inactivo')) {
            mensaje = 'Usuario inactivo. Contacte al administrador';
          } else if (err.error.message.includes('Too Many Requests')) {
            mensaje = 'Demasiados intentos. Espere un momento antes de volver a intentar';
          }
        }
        
        this.showNotification('error', mensaje);
      }
    });
  }
}