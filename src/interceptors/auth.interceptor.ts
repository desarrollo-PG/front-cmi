import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs/operators';
import { AuthService } from '../app/services/auth.service';

// ← DEFINIR INTERFACE para las respuestas del backend
interface BackendResponse {
  success: boolean;
  cambiarClave?: boolean;
  message?: string;
  data?: any;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  
  const authService = inject(AuthService);
  
  const token = localStorage.getItem('token');
  
  if (token) {
    
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return next(authReq).pipe(
      tap({
        next: (event) => {
          // Verificar si es una respuesta HTTP
          if (event instanceof HttpResponse) {
            const body = event.body as BackendResponse; // ← CAST al tipo correcto
            
            // ← DETECTAR cuando el backend responde que debe cambiar contraseña
            if (body && body.cambiarClave === true && body.success === false) {
              console.log('🔐 Backend indica: debe cambiar contraseña');
              authService.manejarCambioObligatorio();
            }
          }
        },
        error: (error) => {
          // Manejar errores de autenticación
          if (error.status === 401) {
            console.log('❌ Error 401: Token inválido, redirigiendo a login');
            authService.logout();
          }
        }
      })
    );
    
  } else {
    // Sin token, pasar la petición normal
    return next(req);
  }
};