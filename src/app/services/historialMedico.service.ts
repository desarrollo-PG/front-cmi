// services/historialMedico.service.ts - VERSIÓN LIMPIA
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface HistorialMedico {
  idhistorial: number;
  fkpaciente: number;
  fkusuario: number;
  fecha: string;
  motivoconsulta: string;
  notaconsulta?: string;
  recordatorio?: string;
  evolucion?: string;
  diagnosticotratamiento?: string;
  fechacreacion: string;
  fechamodificacion?: string;
  usuario?: {
    nombres: string;
    apellidos: string;
    puesto: string;
  };
  paciente?: {
    nombres: string;
    apellidos: string;
    expedientes?: {
      numeroexpediente: string;
    }[];
  };
}

export interface InfoPaciente {
  idpaciente: number;
  nombres: string;
  apellidos: string;
  cui: string;
  rutafotoperfil?: string;
  telefono?: string;
  email?: string;
  fechanacimiento?: string;
  expedientes?: {
    numeroexpediente: string;
    fechacreacion?: string;
  }[];
}

export interface CrearSesionRequest {
  fkpaciente: number;
  fkusuario: number;
  fecha: string;
  motivoconsulta: string;
  notaconsulta?: string;
  recordatorio?: string;
  evolucion?: string;
  diagnosticotratamiento?: string;
}

export interface ActualizarSesionRequest {
  motivoconsulta?: string;
  notaconsulta?: string;
  recordatorio?: string;
  evolucion?: string;
  diagnosticotratamiento?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  total?: number;
}

@Injectable({
  providedIn: 'root'
})
export class HistorialMedicoService {
  private apiUrl = 'http://localhost:3000/api/historial';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  obtenerHistorialPorPaciente(idpaciente: number): Observable<HistorialMedico[]> {
    return this.http.get<ApiResponse<HistorialMedico[]>>(
      `${this.apiUrl}/paciente/${idpaciente}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data || [])
    );
  }

  obtenerInfoPaciente(idpaciente: number): Observable<InfoPaciente> {
    return this.http.get<ApiResponse<InfoPaciente>>(
      `${this.apiUrl}/info-paciente/${idpaciente}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data)
    );
  }

  crearSesion(sesion: CrearSesionRequest): Observable<HistorialMedico> {
    return this.http.post<ApiResponse<HistorialMedico>>(
      `${this.apiUrl}/crear-sesion`,
      sesion, 
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data)
    );
  }

  actualizarSesion(idhistorial: number, datos: ActualizarSesionRequest): Observable<HistorialMedico> {
    return this.http.put<ApiResponse<HistorialMedico>>(
      `${this.apiUrl}/actualizar-sesion/${idhistorial}`,
      datos, 
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data)
    );
  }

  subirArchivos(idpaciente: number, archivos: FileList): Observable<any> {
    const formData = new FormData();
    
    for (let i = 0; i < archivos.length; i++) {
      formData.append('archivos', archivos[i]);
    }

    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<ApiResponse<any>>(
      `${this.apiUrl}/subir-archivos/${idpaciente}`,
      formData, 
      { headers }
    );
  }

  eliminarSesion(idhistorial: number): Observable<any> {
    return this.http.delete<ApiResponse<any>>(
      `${this.apiUrl}/eliminar-sesion/${idhistorial}`,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => response.data)
    );
  }

  formatearFechaInput(fecha: string): string {
    if (!fecha) return '';
    return fecha.split('T')[0];
  }

  formatearFechaDisplay(fecha: string): string {
    if (!fecha) return '';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-GT');
  }

  calcularEdad(fechaNacimiento: string): number {
    if (!fechaNacimiento) return 0;
    const today = new Date();
    const birthDate = new Date(fechaNacimiento);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
}