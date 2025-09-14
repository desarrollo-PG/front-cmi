// src/app/services/paciente.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Interface del paciente
 */
export interface Paciente {
  idpaciente?: number;
  nombres: string;
  apellidos: string;
  cui: string;
  fechanacimiento: string;
  genero: string;
  tipoconsulta: string;
  tipodiscapacidad?: string;
  telefonopersonal?: string;
  nombrecontactoemergencia?: string;
  telefonoemergencia?: string;
  nombreencargado?: string;
  dpiencargado?: string;
  telefonoencargado?: string;
  municipio: string;
  aldea?: string;
  direccion: string;
  usuariocreacion?: string;
  fechacreacion?: string;
  usuariomodificacion?: string;
  fechamodificacion?: string;
  estado?: number;
  
  // Rutas de archivos
  rutafotoperfil?: string;
  rutafotoencargado?: string;
  rutacartaautorizacion?: string;

  // Relación con expedientes
  expedientes?: Array<{
    idexpediente: number;
    numeroexpediente: string;
    historiaenfermedad?: string;
  }>;
}

/**
 * Respuesta del servidor para pacientes
 */
export interface RespuestaPaciente {
  exito: boolean;
  datos: Paciente | Paciente[];
  mensaje?: string;
  paginacion?: {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
  };
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ServicioPaciente {
  private urlApi = `${environment.apiUrl}/pacientes`;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene todos los pacientes con paginación y búsqueda
   */
  obtenerTodosLosPacientes(pagina: number = 1, limite: number = 10, busqueda: string = ''): Observable<RespuestaPaciente> {
    let parametros = new HttpParams()
      .set('pagina', pagina.toString())
      .set('limite', limite.toString());
    
    if (busqueda.trim()) {
      parametros = parametros.set('busqueda', busqueda);
    }

    return this.http.get<RespuestaPaciente>(this.urlApi, { params: parametros });
  }

  /**
   * Obtiene un paciente por ID
   */
  obtenerPacientePorId(id: number): Observable<RespuestaPaciente> {
    return this.http.get<RespuestaPaciente>(`${this.urlApi}/${id}`);
  }

  /**
   * Crea un nuevo paciente
   */
  crearPaciente(paciente: Paciente): Observable<RespuestaPaciente> {
    return this.http.post<RespuestaPaciente>(this.urlApi, paciente);
  }

  /**
   * Actualiza un paciente existente
   */
  actualizarPaciente(id: number, paciente: Partial<Paciente>): Observable<RespuestaPaciente> {
    return this.http.put<RespuestaPaciente>(`${this.urlApi}/${id}`, paciente);
  }

  /**
   * Elimina un paciente
   */
  eliminarPaciente(id: number): Observable<RespuestaPaciente> {
    return this.http.delete<RespuestaPaciente>(`${this.urlApi}/${id}`);
  }

  /**
   * Obtiene pacientes disponibles para asignar a expedientes
   */
  obtenerPacientesDisponibles(): Observable<RespuestaPaciente> {
    return this.http.get<RespuestaPaciente>(`${this.urlApi}/disponibles`);
  }

  /**
   * Verifica si un paciente tiene expedientes
   */
  pacienteTieneExpedientes(paciente: Paciente): boolean {
    return !!(paciente.expedientes && paciente.expedientes.length > 0);
  }

  /**
   * Obtiene el primer expediente de un paciente
   */
  obtenerPrimerExpediente(paciente: Paciente): any | null {
    if (this.pacienteTieneExpedientes(paciente)) {
      return paciente.expedientes![0];
    }
    return null;
  }

  // Métodos de compatibilidad
  getAllPacientes = this.obtenerTodosLosPacientes;
  getPacienteById = this.obtenerPacientePorId;
  createPaciente = this.crearPaciente;
  updatePaciente = this.actualizarPaciente;
  deletePaciente = this.eliminarPaciente;
  getPacientesDisponibles = this.obtenerPacientesDisponibles;
  getPrimerExpediente = this.obtenerPrimerExpediente;
}