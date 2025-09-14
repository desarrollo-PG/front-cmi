// src/app/services/expediente.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Interface principal del expediente médico
 */
export interface Expediente {
  idexpediente?: number;
  fkpaciente?: number;
  numeroexpediente: string;
  generarAutomatico?: boolean;
  
  // Historia clínica
  historiaenfermedad?: string;
  
  // Antecedentes médicos
  antmedico?: string;
  antmedicamento?: string;
  anttraumaticos?: string;
  antfamiliar?: string;
  antalergico?: string;
  antmedicamentos?: string;
  antsustancias?: string;
  antintolerantelactosa?: number; // 0 = No, 1 = Sí
  
  // Antecedentes fisiológicos
  antfisoinmunizacion?: string;
  antfisocrecimiento?: string;
  antfisohabitos?: string;
  antfisoalimentos?: string;
  
  // Antecedentes gineco-obstétricos
  gineobsprenatales?: string;
  gineobsnatales?: string;
  gineobspostnatales?: string;
  gineobsgestas?: number;
  gineobspartos?: number;
  gineobsabortos?: number;
  gineobscesareas?: number;
  gineobshv?: string;
  gineobsmh?: string;
  gineobsfur?: string; // Fecha de última regla
  gineobsciclos?: string;
  gineobsmenarquia?: string;
  
  // Examen físico y signos vitales
  examenfistc?: number; // Temperatura corporal
  examenfispa?: string; // Presión arterial
  examenfisfc?: number; // Frecuencia cardíaca
  examenfisfr?: number; // Frecuencia respiratoria
  examenfissao2?: number; // Saturación de oxígeno
  examenfispeso?: number; // Peso
  examenfistalla?: number; // Talla
  examenfisimc?: number; // Índice de masa corporal
  examenfisgmt?: string; // Examen físico general
  
  // Campos de auditoría
  usuariocreacion?: string;
  fechacreacion?: string;
  usuariomodificacion?: string;
  fechamodificacion?: string;
  estado?: number;
  
  // Relaciones incluidas
  paciente?: Array<{
    idpaciente: number;
    nombres: string;
    apellidos: string;
    cui: string;
  }>;
  detallereferirpaciente?: Array<{
    idrefpaciente: number;
    comentario: string;
    fechacreacion: string;
    clinica: {
      idclinica: number;
      nombreclinica: string;
    };
  }>;
}

/**
 * Respuesta para creación de expedientes
 */
export interface RespuestaCreacionExpediente {
  exito: boolean;
  datos: Expediente;
  mensaje?: string;
}

/**
 * Respuesta para listado de expedientes
 */
export interface RespuestaListaExpedientes {
  exito: boolean;
  datos: Expediente[];
  mensaje?: string;
  paginacion?: {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
  };
}

/**
 * Respuesta genérica para expedientes
 */
export interface RespuestaExpediente {
  exito: boolean;
  datos: Expediente | Expediente[];
  mensaje?: string;
  paginacion?: {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
  };
  error?: string;
}

/**
 * Estadísticas de expedientes médicos
 */
export interface EstadisticasExpediente {
  totalExpedientes: number;
  expedientesRecientes: number;
  expedientesConPacientes: number;
  expedientesSinPacientes: number;
}

/**
 * Respuesta para generación de número de expediente
 */
export interface RespuestaNumeroExpediente {
  exito: boolean;
  datos: {
    numeroexpediente: string;
  };
  mensaje?: string;
}

/**
 * Servicio para gestión de expedientes médicos
 */
@Injectable({
  providedIn: 'root'
})
export class ServicioExpediente {
  private urlApi = `${environment.apiUrl}/expedientes`;

  constructor(private http: HttpClient) {}

  // ==========================================
  // OPERACIONES CRUD BÁSICAS
  // ==========================================

  /**
   * Obtiene todos los expedientes con paginación y búsqueda
   * @param pagina - Número de página (por defecto 1)
   * @param limite - Elementos por página (por defecto 10)
   * @param busqueda - Término de búsqueda opcional
   */
  obtenerTodosLosExpedientes(pagina: number = 1, limite: number = 10, busqueda: string = ''): Observable<RespuestaListaExpedientes> {
    let parametros = new HttpParams()
      .set('pagina', pagina.toString())
      .set('limite', limite.toString());
    
    if (busqueda.trim()) {
      parametros = parametros.set('busqueda', busqueda);
    }

    return this.http.get<RespuestaListaExpedientes>(this.urlApi, { params: parametros });
  }

  /**
   * Obtiene un expediente específico por su ID
   * @param id - ID del expediente
   */
  obtenerExpedientePorId(id: number): Observable<RespuestaExpediente> {
    return this.http.get<RespuestaExpediente>(`${this.urlApi}/${id}`);
  }

  /**
   * Crea un nuevo expediente médico
   * @param expediente - Datos del expediente a crear
   */
  crearExpediente(expediente: Expediente): Observable<RespuestaCreacionExpediente> {
    const datosFormateados = this.formatearParaBackend(expediente);
    return this.http.post<RespuestaCreacionExpediente>(this.urlApi, datosFormateados);
  }

  // TAMBIÉN AGREGAR: Método para actualizar expediente con mejor logging
  /**
   * Actualiza un expediente existente - VERSION MEJORADA
   * @param id - ID del expediente a actualizar
   * @param expediente - Datos actualizados del expediente
   */
  actualizarExpediente(id: number, expediente: Partial<Expediente>): Observable<RespuestaExpediente> {
    console.log('🔄 Servicio: Actualizando expediente', id);
    console.log('📝 Datos recibidos en servicio:', expediente);
    
    const datosFormateados = this.formatearParaBackend(expediente);
    
    console.log('🚀 Enviando PUT a:', `${this.urlApi}/${id}`);
    console.log('📦 Datos finales a enviar:', datosFormateados);
    
    return this.http.put<RespuestaExpediente>(`${this.urlApi}/${id}`, datosFormateados);
  }

  /**
   * Elimina un expediente (eliminación lógica)
   * @param id - ID del expediente a eliminar
   */
  eliminarExpediente(id: number): Observable<RespuestaExpediente> {
    console.log('🗑️ Servicio: Eliminando expediente', id);
    return this.http.delete<RespuestaExpediente>(`${this.urlApi}/${id}`);
  }

  // ==========================================
  // FUNCIONES ESPECIALIZADAS
  // ==========================================

  /**
   * Obtiene expedientes disponibles (sin pacientes asignados)
   */
  obtenerExpedientesDisponibles(): Observable<RespuestaExpediente> {
    return this.http.get<RespuestaExpediente>(`${this.urlApi}/disponibles`);
  }

  /**
   * Genera automáticamente un número de expediente único
   */
  generarNumeroExpediente(): Observable<RespuestaNumeroExpediente> {
    return this.http.get<RespuestaNumeroExpediente>(`${this.urlApi}/generar-numero`);
  }

  /**
   * Obtiene estadísticas generales de expedientes
   */
  obtenerEstadisticas(): Observable<{ exito: boolean; datos: EstadisticasExpediente }> {
    return this.http.get<{ exito: boolean; datos: EstadisticasExpediente }>(`${this.urlApi}/estadisticas`);
  }

  // ==========================================
  // UTILIDADES Y VALIDACIONES
  // ==========================================

  /**
   * Valida los datos del expediente antes del envío
   * @param expediente - Datos del expediente a validar
   */
  validarExpediente(expediente: Expediente): { valido: boolean; errores: string[] } {
    const errores: string[] = [];

    // Validar número de expediente en modo manual
    if (!expediente.generarAutomatico && (!expediente.numeroexpediente || expediente.numeroexpediente.trim() === '')) {
      errores.push('El número de expediente es requerido cuando no se genera automáticamente');
    }

    // Validar rangos de signos vitales
    if (expediente.examenfistc !== undefined && expediente.examenfistc !== null) {
      if (expediente.examenfistc < 0 || expediente.examenfistc > 999.99) {
        errores.push('La temperatura corporal debe estar entre 0 y 999.99°C');
      }
    }

    if (expediente.examenfissao2 !== undefined && expediente.examenfissao2 !== null) {
      if (expediente.examenfissao2 < 0 || expediente.examenfissao2 > 100) {
        errores.push('La saturación de oxígeno debe estar entre 0 y 100%');
      }
    }

    if (expediente.examenfispeso !== undefined && expediente.examenfispeso !== null) {
      if (expediente.examenfispeso < 0 || expediente.examenfispeso > 9999.99) {
        errores.push('El peso debe estar entre 0 y 9999.99 kg');
      }
    }

    if (expediente.examenfistalla !== undefined && expediente.examenfistalla !== null) {
      if (expediente.examenfistalla < 0 || expediente.examenfistalla > 999.99) {
        errores.push('La talla debe estar entre 0 y 999.99 metros');
      }
    }

    // Validar frecuencias (deben ser enteros positivos)
    if (expediente.examenfisfc !== undefined && expediente.examenfisfc !== null) {
      if (expediente.examenfisfc < 0 || expediente.examenfisfc > 999 || !Number.isInteger(Number(expediente.examenfisfc))) {
        errores.push('La frecuencia cardíaca debe ser un número entero entre 0 y 999');
      }
    }

    if (expediente.examenfisfr !== undefined && expediente.examenfisfr !== null) {
      if (expediente.examenfisfr < 0 || expediente.examenfisfr > 999 || !Number.isInteger(Number(expediente.examenfisfr))) {
        errores.push('La frecuencia respiratoria debe ser un número entero entre 0 y 999');
      }
    }

    // Validar datos gineco-obstétricos (números enteros positivos)
    const camposGinecoObstetricos = ['gineobsgestas', 'gineobspartos', 'gineobsabortos', 'gineobscesareas'];
    camposGinecoObstetricos.forEach(campo => {
      const valor = (expediente as any)[campo];
      if (valor !== undefined && valor !== null && (valor < 0 || !Number.isInteger(Number(valor)))) {
        errores.push(`${campo} debe ser un número entero positivo`);
      }
    });

    // Validar presión arterial si está presente
    if (expediente.examenfispa && !this.validarPresionArterial(expediente.examenfispa)) {
      errores.push('La presión arterial debe tener el formato XXX/XXX (ej: 120/80)');
    }

    return {
      valido: errores.length === 0,
      errores
    };
  }

/**
 * Formatea los datos para envío al backend - VERSION ARREGLADA
 * @param expediente - Datos del expediente a formatear
 */
formatearParaBackend(expediente: Partial<Expediente>): any {
  console.log('🔧 Formateando datos para backend...');
  console.log('📥 Datos originales:', expediente);
  
  const formateado = { ...expediente };

  // 🚫 REMOVER campos que no deben enviarse al backend
  delete (formateado as any).generarAutomatico;

  // Convertir strings vacíos a null PRIMERO
  Object.keys(formateado).forEach(clave => {
    const valor = (formateado as any)[clave];
    
    // Convertir strings vacíos o solo espacios a null
    if (typeof valor === 'string' && valor.trim() === '') {
      (formateado as any)[clave] = null;
    }
  });

  // Asegurar que valores numéricos sean números - MEJORADO
  const camposNumericos = [
    'fkpaciente', 'antintolerantelactosa', 'gineobsgestas', 'gineobspartos', 
    'gineobsabortos', 'gineobscesareas', 'examenfisfc', 'examenfisfr'
  ];

  const camposDecimales = [
    'examenfistc', 'examenfissao2', 'examenfispeso', 'examenfistalla', 'examenfisimc'
  ];

  // Procesar campos que deben ser enteros
  camposNumericos.forEach(campo => {
    const valor = (formateado as any)[campo];
    
    if (valor !== undefined && valor !== null && valor !== '') {
      const numeroConvertido = parseInt(String(valor));
      
      if (!isNaN(numeroConvertido)) {
        (formateado as any)[campo] = numeroConvertido;
      } else {
        console.warn(`⚠️ No se pudo convertir ${campo} a entero:`, valor);
        (formateado as any)[campo] = null;
      }
    } else {
      // Valor vacío o null, mantener como null
      (formateado as any)[campo] = null;
    }
  });

  // Procesar campos que deben ser decimales
  camposDecimales.forEach(campo => {
    const valor = (formateado as any)[campo];
    
    if (valor !== undefined && valor !== null && valor !== '') {
      const numeroConvertido = parseFloat(String(valor));
      
      if (!isNaN(numeroConvertido)) {
        (formateado as any)[campo] = numeroConvertido;
      } else {
        console.warn(`⚠️ No se pudo convertir ${campo} a decimal:`, valor);
        (formateado as any)[campo] = null;
      }
    } else {
      // Valor vacío o null, mantener como null
      (formateado as any)[campo] = null;
    }
  });

  // Manejar fecha FUR especialmente
  if (formateado.gineobsfur) {
    try {
      const fecha = new Date(formateado.gineobsfur);
      if (!isNaN(fecha.getTime())) {
        // Enviar solo la fecha en formato YYYY-MM-DD
        formateado.gineobsfur = fecha.toISOString().split('T')[0];
      } else {
        console.warn('⚠️ Fecha FUR inválida, estableciendo a null');
        (formateado as any).gineobsfur = null;
      }
    } catch (error) {
      console.warn('⚠️ Error al procesar fecha FUR:', error);
      (formateado as any).gineobsfur = null;
    }
  }

  console.log('📤 Datos formateados para backend:', formateado);
  return formateado;
}

  /**
   * Calcula el Índice de Masa Corporal (IMC)
   * @param peso - Peso en kilogramos
   * @param talla - Talla en metros
   */
  calcularIMC(peso?: number, talla?: number): number | null {
    if (!peso || !talla || peso <= 0 || talla <= 0) {
      return null;
    }
    return Number((peso / (talla * talla)).toFixed(2));
  }

  /**
   * Obtiene la categoría del IMC según los estándares médicos
   * @param imc - Valor del IMC
   */
  obtenerCategoriaIMC(imc: number): string {
    if (imc < 18.5) return 'Bajo peso';
    if (imc >= 18.5 && imc < 25) return 'Peso normal';
    if (imc >= 25 && imc < 30) return 'Sobrepeso';
    if (imc >= 30 && imc < 35) return 'Obesidad grado I';
    if (imc >= 35 && imc < 40) return 'Obesidad grado II';
    if (imc >= 40) return 'Obesidad grado III (mórbida)';
    return 'No clasificado';
  }

  /**
   * Valida el formato de presión arterial
   * @param presion - Cadena de presión arterial (ej: "120/80")
   */
  validarPresionArterial(presion: string): boolean {
    if (!presion) return true; // Campo opcional
    const regex = /^\d{2,3}\/\d{2,3}$/;
    return regex.test(presion.trim());
  }

  /**
   * Obtiene texto descriptivo para intolerancia a lactosa
   * @param valor - 0 = No, 1 = Sí, undefined = No especificado
   */
  obtenerTextoIntoleranciaLactosa(valor: number | undefined): string {
    if (valor === 1) return 'Sí';
    if (valor === 0) return 'No';
    return 'No especificado';
  }

  /**
   * Valida rangos de signos vitales según estándares médicos
   * @param tipo - Tipo de signo vital
   * @param valor - Valor a validar
   */
  validarSignoVital(tipo: string, valor: number): { valido: boolean; mensaje?: string } {
    switch (tipo) {
      case 'temperatura':
        if (valor < 35 || valor > 42) {
          return { valido: false, mensaje: 'Temperatura fuera del rango normal (35-42°C)' };
        }
        break;
      case 'frecuenciaCardiaca':
        if (valor < 40 || valor > 200) {
          return { valido: false, mensaje: 'Frecuencia cardíaca fuera del rango normal (40-200 lpm)' };
        }
        break;
      case 'frecuenciaRespiratoria':
        if (valor < 8 || valor > 40) {
          return { valido: false, mensaje: 'Frecuencia respiratoria fuera del rango normal (8-40 rpm)' };
        }
        break;
      case 'saturacionOxigeno':
        if (valor < 70 || valor > 100) {
          return { valido: false, mensaje: 'Saturación de oxígeno fuera del rango normal (70-100%)' };
        }
        break;
    }
    return { valido: true };
  }

  /**
   * Genera un resumen del expediente para vista rápida
   * @param expediente - Expediente a resumir
   */
  generarResumenExpediente(expediente: Expediente): string {
    const resumen: string[] = [];
    
    if (expediente.historiaenfermedad) {
      resumen.push(`Historia: ${expediente.historiaenfermedad.substring(0, 100)}...`);
    }
    
    if (expediente.antmedico) {
      resumen.push(`Antecedentes: ${expediente.antmedico.substring(0, 50)}...`);
    }
    
    if (expediente.examenfispeso && expediente.examenfistalla) {
      const imc = this.calcularIMC(expediente.examenfispeso, expediente.examenfistalla);
      if (imc) {
        resumen.push(`IMC: ${imc} (${this.obtenerCategoriaIMC(imc)})`);
      }
    }
    
    return resumen.join(' | ') || 'Sin información adicional';
  }

  // ==========================================
  // MÉTODOS DE COMPATIBILIDAD
  // ==========================================

  /**
   * Métodos con nombres originales para mantener compatibilidad
   */
  getAllExpedientes = this.obtenerTodosLosExpedientes;
  getExpedienteById = this.obtenerExpedientePorId;
  createExpediente = this.crearExpediente;
  updateExpediente = this.actualizarExpediente;
  deleteExpediente = this.eliminarExpediente;
  getExpedientesDisponibles = this.obtenerExpedientesDisponibles;
  getEstadisticas = this.obtenerEstadisticas;
  getIntolerancieLactosaText = this.obtenerTextoIntoleranciaLactosa;
}