import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment.development';
import { ArchivoService } from '../services/archivo.service';
import { BehaviorSubject } from 'rxjs';

export interface CambiarClaveRequest {
  usuario: string;
  claveActual: string;
  claveNueva: string;
  confirmarClave: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userInfoSubject = new BehaviorSubject<any>({ name: 'Usuario', avatar: null });
  public userInfo$ = this.userInfoSubject.asObservable();
  private apiUrl = `${environment.apiUrl}/auth`;

  // ✅ AGREGAR para mensaje de bienvenida
  private showWelcomeSubject = new Subject<boolean>();
  public showWelcome$ = this.showWelcomeSubject.asObservable();

  // ← NUEVO: Subject para controlar cambio de contraseña
  private cambiarClaveSubject = new Subject<boolean>();
  public cambiarClave$ = this.cambiarClaveSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private archivoService: ArchivoService
  ) {}

  /**
   * Login de usuario
   */
  login(usuario: string, clave: string): Observable<any> {
    const loginData = { usuario, clave };
    return this.http.post<any>(`${this.apiUrl}/login`, loginData);
  }

  /**
   * Resetear contraseña
   */
  resetearPassword(correo: string): Observable<any> {
    const resetData = { correo };
    return this.http.post<any>(`${this.apiUrl}/resetearPass`, resetData);
  }

  // ← NUEVA FUNCIÓN: Cambiar contraseña temporal
  /**
   * Cambiar contraseña temporal
   */
  cambiarClaveTemporary(data: CambiarClaveRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cambiarClave`, data);
  }

  /**
   * Guardar datos de autenticación
   */
  saveAuthData(token: string, usuario: any): void {
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));
  }

  // ← NUEVA FUNCIÓN: Manejar respuesta de login con cambio de contraseña
  /**
   * Procesar respuesta de login y manejar cambio de contraseña
   */
  handleLoginResponse(response: any): void {    
    if (response.success && response.data) {
      // Guardar datos de autenticación
      this.saveAuthData(response.data.token, response.data.usuario);
      
      // ← VERIFICAR SI DEBE CAMBIAR CONTRASEÑA
      if (response.data.cambiarclave || response.cambiarclave) {
        this.cambiarClaveSubject.next(true);
        this.router.navigate(['/cambiar-clave-temporal']);
      } else {
        this.router.navigate(['/bienvenida']);
      }
    }
  }

  // ← NUEVA FUNCIÓN: Después de cambiar contraseña exitosamente
  /**
   * Manejar cambio exitoso de contraseña
   */
  handlePasswordChangeSuccess(): void {
    this.cambiarClaveSubject.next(false);
    this.navigateToMenu();
  }

  // ← NUEVA FUNCIÓN: Manejar respuesta de cambio obligatorio desde interceptor
  /**
   * Manejar cuando el backend responde que debe cambiar contraseña
   */
  manejarCambioObligatorio(): void {
    this.cambiarClaveSubject.next(true);
    this.router.navigate(['/cambiar-clave-temporal']);
  }

  /**
   * Obtener token
   */
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  // ← NUEVA FUNCIÓN: Obtener usuario actual
  /**
   * Obtener usuario actual del localStorage
   */
  getCurrentUser(): any {
    const usuario = localStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
  }

  // ← NUEVA FUNCIÓN: Verificar si debe cambiar contraseña
  /**
   * Verificar si el usuario debe cambiar su contraseña
   */
  debeCambiarClave(): boolean {
    return false; // Por defecto false, se maneja desde el backend
  }

  /**
   * Verificar si está logueado
   */
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /**
   * Navegar al menú
   */
  navigateToMenu(): void {
    // ✅ ACTIVAR mensaje de bienvenida
    this.showWelcomeSubject.next(true);
    this.router.navigate(['/menu']);
  }

  /**
   * Logout
   */
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    // ← LIMPIAR subjects al hacer logout
    this.cambiarClaveSubject.next(false);
    this.router.navigate(['/login']);
  }

  // En tu auth.service.ts
  actualizarEstadoCambioClave(): void {
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      currentUser.cambiarclave = false;
      // Actualizar en localStorage o donde manejes el estado
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
  }

  // auth.service.ts - SOLO AQUÍ manejas la lógica
  loadUserInfo(): void {
    console.log('🚀 loadUserInfo() SE ESTÁ EJECUTANDO');
    try {
      const usuarioData = localStorage.getItem('usuario');
      console.log('=== DEBUG SIMPLE ===');
    console.log('usuarioData raw:', usuarioData);

      if (usuarioData) {
        const usuario = JSON.parse(usuarioData);        
        console.log('usuario parseado:', usuario);
      console.log('usuario.rutafotoperfil:', usuario.rutafotoperfil);
      
        const userInfo = {
          name: `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim(),
          avatar: usuario.rutafotoperfil ? this.archivoService.obtenerUrlPublica(usuario.rutafotoperfil) : null,
          usuario: usuario
        };
        
        this.userInfoSubject.next(userInfo);
      } 
    } catch (error) {
      console.error('Error al cargar información del usuario:', error);
      this.userInfoSubject.next({ name: 'Usuario', avatar: null });
    }
  }
}