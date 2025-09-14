import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse  } from '@angular/common/http';
import { tap, catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.development';

export interface Usuario {
    idusuario:                number;
    fkrol:                    number;
    usuario:                  string;
    clave:                    string;
    nombres:                  string;
    apellidos:                string;
    fechanacimiento:          string;
    correo:                   string;
    puesto:                   string;
    profesion:                string;
    telinstitucional:         string;
    extension:                string;
    telefonopersonal:         string;
    nombrecontactoemergencia: string;
    telefonoemergencia:       string;
    rutafotoperfil:           string;
    observaciones?:           string;
    usuariocreacion:          string;
    estado:                   number;
}

export interface Rol {
  idrol: number;
  nombre: string;
}

@Injectable({
    providedIn: 'root'
})
export class UsuarioService{
    private apiUrl = `${environment.apiUrl}/usuario`;

    constructor(private http: HttpClient){
    }

    getCurrentUserData() {
        const userData = localStorage.getItem('usuario');
        return userData ? JSON.parse(userData) : null;
    }

    obtenerUsuarios(): Observable<Usuario[]>{
        const ruta = `${this.apiUrl}/buscarUsuarios`;
        return this.http.get<any>(ruta).pipe(
            tap(response => {}),
            map(response => {
                if(response && response.success && response.data && Array.isArray(response.data)){
                    return response.data;
                }
                return[];
            }),
            catchError(error => {
                return of([]);
            })
        )
    }

    obtenerRoles(): Observable<Rol[]>{
        const ruta = `${this.apiUrl}/roles`;
        return this.http.get<any>(ruta).pipe(
            tap(response => {}),
            map(response => {
                if(response && response.success && response.data && Array.isArray(response.data)){
                    return response.data;
                }
                return[];
            }),
            catchError(error => {
                return of([]);
            })
        )
    }

    obtenerUsuarioPorId(id: number): Observable<Usuario> {
        return this.http.get<Usuario>(`${this.apiUrl}/buscarPorId/${id}`).pipe(
            tap(response => {
            }),
            catchError(error => {
                if (error.status === 0) {
                    console.error('Sin conexión al servidor');
                }
                throw error;
            })
        );
    }

    crearUsuario(usuario: Omit<Usuario, 'idusuario'>): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/crearUsuario`, usuario).pipe(
            tap(response => {
            }),
            catchError((error: HttpErrorResponse) => {
                // Si es un error 400 o 422 (errores de validación), tratarlo como respuesta válida
                if ((error.status === 400 || error.status === 422) && error.error) {
                    return of(error.error);
                }
                
                // Para otros errores (500, red, etc.), mantener como error
                throw error;
            })
        );
    }

    actualizarUsuario(id: number, usuario: Omit<Usuario, 'idusuario'>): Observable<any> {
        return this.http.put<any>(`${this.apiUrl}/actualizarUsuario/${id}`, usuario).pipe(
            tap(response => {
            }),
            catchError(error => {
                if (error.status === 0) {
                    console.error('Sin conexión al servidor');
                }
                
                throw error;
            })
        );
    }

    eliminarUsuario(id: number): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/eliminarUsuario/${id}`).pipe(
            tap((response) => {
            }),
            catchError((error: HttpErrorResponse) => {                
                // Si es un error 400 con mensaje del backend, tratarlo como respuesta válida
                if (error.status === 400 && error.error && error.error.success === false) {
                    return of(error.error);
                }
                
                if (error.status === 0) {
                    console.error('Sin conexión al servidor');
                }
                
                // Relanzar el error para que llegue al error: del componente
                throw error;
            })
        );
    }
}