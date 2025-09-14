//password-change.guard.ts

import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const cambioClaveGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // ← VERIFICAR si está logueado
  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  // ← ESTE GUARD PERMITE ACCESO A LA RUTA DE CAMBIO DE CONTRASEÑA
  // solo si el usuario está logueado. El flujo de cambio obligatorio
  // se maneja desde el AuthService y el interceptor
  
  return true;
};