// expediente.ts
import { Component, OnInit, AfterViewInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ServicioExpediente, Expediente, RespuestaCreacionExpediente, RespuestaListaExpedientes, EstadisticasExpediente } from '../../services/expediente.service';
import { AlertaService } from '../../services/alerta.service';
import { AuthService } from '../../services/auth.service';
import { PerfilService } from '../../services/perfil.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { NgxPaginationModule } from 'ngx-pagination';
import { PdfExcelReporteriaService } from '../../services/pdf-excel-reporteria.service';
import { ArchivoService } from '../../services/archivo.service';
import { ProgramaService, Programa } from '../../services/programa.service';
import { PermisoService } from '../../services/permiso.service';

@Component({
  selector: 'app-expediente-lista',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, SidebarComponent],
  templateUrl: './expediente.html',
  styleUrls: ['./expediente.scss']
})
export class ExpedienteListaComponent implements OnInit, AfterViewInit, OnDestroy {

  // Programas — lista general
  listaProgramas: Programa[] = [];
  programasSeleccionados: number[] = [];

  // Gestión de programas (CRUD modal)
  mostrarModalProgramas = false;
  programaEnEdicion: Programa | null = null;
  nombreProgramaForm = '';
  descripcionProgramaForm = '';
  guardandoPrograma = false;
  
  @Input() mostrarComoModal: boolean = false;
  @Input() datosPaciente: any = null;
  @Output() cerrarModal = new EventEmitter<void>();
  @Output() expedienteCreado = new EventEmitter<any>();
  
  private destruir$ = new Subject<void>();
  private perfilSubscription?: Subscription;
  
  // Estados de la aplicación
  vistaActual: 'lista' | 'formulario' | 'detalle' = 'lista';
  modoEdicion = false;
  cargando = false;
  
  // Datos principales
  expedientes: Expediente[] = [];
  expedientesFiltrados: Expediente[] = [];
  expedienteSeleccionado: Expediente | null = null;
  estadisticas: EstadisticasExpediente | null = null;

  // Variables de paginación 
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  totalItems = 0;
  paginatedExpedientes: Expediente[] = [];

  // Exponer Math para usar en el template
  Math = Math;

  // Formulario
  formularioExpediente: FormGroup;
  
  // Búsqueda y paginación
  terminoBusqueda = '';
  private sujetoBusqueda = new Subject<string>();
  paginaActual = 1;
  tamanoPagina = 10;
  totalElementos = 0;
  totalPaginas = 0;
  
  // Interfaz de usuario
  barraLateralExpandida = true;
  sidebarVisible = false;
  informacionUsuario: any = { name: 'Usuario', avatar: null };
  error = '';

  //Variables para filtro de clínica
  clinicas: any[] = [];
  clinicaSeleccionada: number = 0; // 0 = Todas las clínicas

  constructor(
    private servicioExpediente: ServicioExpediente,
    private fb: FormBuilder,
    private servicioAlerta: AlertaService,
    private archivoService: ArchivoService,
    private pdfExcelService: PdfExcelReporteriaService,
    private authService: AuthService,
    private perfilService: PerfilService
    , private programaService: ProgramaService
    , private permisoService: PermisoService
  ) {
    this.formularioExpediente = this.crearFormulario();
    this.configurarBusqueda();
  }

  // Rutas de permiso del rol actual, para mostrar/ocultar elementos sin roles quemados en el código
  permisosExpediente: string[] = [];

  /** true si el rol actual tiene el permiso (o sub-permiso) identificado por esa ruta */
  puedeVer(rutaPermiso: string): boolean {
    return this.permisosExpediente.includes('*') || this.permisosExpediente.includes(rutaPermiso);
  }

  ngOnInit(): void {
    this.permisoService.obtenerMisRutas().subscribe({
      next: (rutas) => this.permisosExpediente = rutas || [],
      error: () => this.permisosExpediente = []
    });
    this.cargarProgramas();
    // Suscribirse al perfil para que el sidebar se actualice reactivamente
    this.perfilSubscription = this.perfilService.perfil$.subscribe({
      next: (usuario) => {
        if (usuario) {
          this.informacionUsuario = this.perfilService.obtenerInfoSidebar();
        }
      },
      error: (error) => {
      }
    });

    // Cargar el perfil desde el backend para inicializar
    this.perfilService.obtenerPerfilDesdeBackend().subscribe({
      error: (error) => {
      }
    });

    this.cargarClinicas();
    this.establecerFiltroClinicaDefecto();
    this.cargarExpedientes();
    this.cargarEstadisticas();
  }

  private establecerFiltroClinicaDefecto(): void {
    const userRoleName = this.authService.userRoleName;
    const user = this.authService.getCurrentUser();

    // Por nombre de rol, no por ID (idrol cambia entre entornos y momentos)
    if (userRoleName === 'Administrador' || userRoleName === 'Sistemas') {
      this.clinicaSeleccionada = 0;
      return;
    }

    // Para otros roles, filtrar por su clínica asignada
    if (user?.fkclinica) {
      this.clinicaSeleccionada = user.fkclinica;
    }
  }

  ngAfterViewInit(): void {
    this.detectarEstadoBarraLateral();
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
    this.perfilSubscription?.unsubscribe();
  }

  cargarProgramas(): void {
    this.programaService.obtenerProgramas().subscribe({
      next: (programas) => {
        this.listaProgramas = programas;
      },
      error: () => {
        this.listaProgramas = [];
      }
    });
  }

  // ==========================================
  // GESTIÓN DE PROGRAMAS (CRUD)
  // ==========================================

  abrirGestionProgramas(): void {
    this.mostrarModalProgramas = true;
    this.cancelarEdicionPrograma();
    this.cargarProgramas();
  }

  cerrarGestionProgramas(): void {
    this.mostrarModalProgramas = false;
    this.cancelarEdicionPrograma();
  }

  iniciarEdicionPrograma(programa: Programa): void {
    this.programaEnEdicion = programa;
    this.nombreProgramaForm = programa.nombre;
    this.descripcionProgramaForm = programa.descripcion || '';
  }

  cancelarEdicionPrograma(): void {
    this.programaEnEdicion = null;
    this.nombreProgramaForm = '';
    this.descripcionProgramaForm = '';
  }

  guardarProgramaGestion(): void {
    const nombre = this.nombreProgramaForm.trim();
    if (!nombre) {
      this.servicioAlerta.alertaPreventiva('El nombre del programa es requerido');
      return;
    }

    this.guardandoPrograma = true;
    const datos = { nombre, descripcion: this.descripcionProgramaForm.trim() };

    const operacion = this.programaEnEdicion
      ? this.programaService.actualizarPrograma(this.programaEnEdicion.idprograma, datos)
      : this.programaService.crearPrograma(datos);

    operacion.subscribe({
      next: () => {
        this.servicioAlerta.alertaExito(
          this.programaEnEdicion ? 'Programa actualizado' : 'Programa creado'
        );
        this.guardandoPrograma = false;
        this.cancelarEdicionPrograma();
        this.cargarProgramas();
      },
      error: () => {
        this.servicioAlerta.alertaError('Error al guardar el programa');
        this.guardandoPrograma = false;
      }
    });
  }

  async eliminarProgramaGestion(programa: Programa): Promise<void> {
    const confirmado = await this.servicioAlerta.alertaConfirmacion(
      `¿Eliminar el programa "${programa.nombre}"?`,
      'Los expedientes que lo tengan asignado perderán esta asociación.',
      'Sí, eliminar',
      'Cancelar'
    );
    if (!confirmado) return;

    this.programaService.eliminarPrograma(programa.idprograma).subscribe({
      next: () => {
        this.servicioAlerta.alertaExito('Programa eliminado');
        this.cargarProgramas();
      },
      error: () => {
        this.servicioAlerta.alertaError('Error al eliminar el programa');
      }
    });
  }

  // ==========================================
  // CONFIGURACIÓN INICIAL
  // ==========================================

  /**
   * Crea el formulario reactivo para expedientes médicos
   */
  crearFormulario(): FormGroup {
    return this.fb.group({
      numeroexpediente: [''], 
      generarAutomatico: [true],
      historiaenfermedad: [''],
      
      // Antecedentes médicos
      antmedico: [''],
      antmedicamento: [''],
      anttraumaticos: [''],
      antfamiliar: [''],
      antalergico: [''],
      antmedicamentos: [''],
      antsustancias: [''],
      antintolerantelactosa: [''],
      
      // Antecedentes fisiológicos
      antfisoinmunizacion: [''],
      antfisocrecimiento: [''],
      antfisohabitos: [''],
      antfisoalimentos: [''],
      
      // Antecedentes gineco-obstétricos
      gineobsprenatales: [''],
      gineobsnatales: [''],
      gineobspostnatales: [''],
      gineobsgestas: [''],
      gineobspartos: [''],
      gineobsabortos: [''],
      gineobscesareas: [''],
      gineobshv: [''],
      gineobsmh: [''],
      gineobsfur: [''],
      gineobsciclos: [''],
      gineobsmenarquia: [''],
      
      // Examen físico
      examenfistc: [''],
      examenfispa: [''],
      examenfisfc: [''],
      examenfisfr: [''],
      examenfissao2: [''],
      examenfispeso: [''],
      examenfistalla: [''],
      examenfisimc: [''],
      examenfisgmt: ['']
    });
  }

  /**
   * Abre el modal desde el componente de pacientes
   */
  abrirModalDesdePacientes(datosPaciente: any): void {
    if (!datosPaciente || !datosPaciente.idpaciente) {
      this.servicioAlerta.alertaError('Error: No se puede crear expediente sin ID de paciente');
      return;
    }
    
    this.datosPaciente = datosPaciente;
    
    // Pre-llenar el formulario
    this.formularioExpediente.patchValue({
      generarAutomatico: true,
      historiaenfermedad: `Expediente médico para ${datosPaciente.pacienteInfo.nombres} ${datosPaciente.pacienteInfo.apellidos}`
    });
    
    this.mostrarFormulario();
  }

  onToggleSidebar(expandido: boolean): void {
    this.barraLateralExpandida = expandido;
    // Opcional: guardar la preferencia
    localStorage.setItem('sidebarExpanded', expandido.toString());
  }
  
  /**
   * Configura la búsqueda con debounce
   */
  configurarBusqueda(): void {
    this.sujetoBusqueda
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destruir$))
      .subscribe(() => this.filtrarExpedientes());
  }

  /**
   * Carga la información del usuario desde localStorage
   */
  cargarInformacionUsuario(): void {
    try {
      const usuarioData = localStorage.getItem('usuario');
      if (usuarioData) {
        const usuario = JSON.parse(usuarioData);
        this.informacionUsuario = {
          name: `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim(),
          avatar: usuario.rutafotoperfil ? 
            this.archivoService.obtenerUrlPublica(usuario.rutafotoperfil) : null  
        };
      }
    } catch (error) {
      this.informacionUsuario = { name: 'Usuario', avatar: null };
    }
    
    // Restaurar estado del sidebar
    const sidebarState = localStorage.getItem('sidebarExpanded');
    if (sidebarState !== null) {
      this.barraLateralExpandida = sidebarState === 'true';
    }
  }

  /**
   * Detecta el estado de la barra lateral
   */
  toggleSidebarMobile(): void {
    this.sidebarVisible = !this.sidebarVisible;
  }

  onSidebarToggle(isExpanded: boolean): void {
    this.sidebarVisible = isExpanded;
  }

  detectarEstadoBarraLateral(): void {
    const verificarBarraLateral = () => {
      const barraLateral = document.querySelector('.sidebar-container');
      if (barraLateral) {
        this.barraLateralExpandida = barraLateral.classList.contains('expanded');
      }
    };

    setTimeout(verificarBarraLateral, 100);

    // Observar cambios en el sidebar
    const observer = new MutationObserver(verificarBarraLateral);
    const sidebar = document.querySelector('.sidebar-container');
    
    if (sidebar) {
      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  // ==========================================
  // NAVEGACIÓN ENTRE VISTAS
  // ==========================================

  /**
   * Muestra la vista de lista
   */
  mostrarLista(): void {
    this.vistaActual = 'lista';
    this.reiniciarFormulario();
  }

  /**
   * Muestra el formulario para crear nuevo expediente
   */
  mostrarFormulario(): void {
    this.vistaActual = 'formulario';
    this.modoEdicion = false;
    this.reiniciarFormulario();
  }

  /**
   * Muestra los detalles de un expediente
   */
verExpediente(expediente: Expediente): void {
  this.expedienteSeleccionado = expediente;
  this.vistaActual = 'detalle';
}

/**
 * Ver detalles del expediente (método original)
 */
private verDetallesExpediente(expediente: Expediente): void {
  this.expedienteSeleccionado = expediente;
  this.vistaActual = 'detalle';
}

/**
 * Descargar PDF del expediente
 */
descargarPDFExpediente(expediente: Expediente): void {
  try {
    const expedienteSeguro: any = Object.fromEntries(
      Object.entries(expediente).map(([k, v]) => {
        // Preservar arrays tal cual (programas, etc.)
        if (Array.isArray(v)) return [k, v];
        return [k, v ?? ''];
      })
    );

    this.pdfExcelService.generarPDFExpediente(expedienteSeguro);
    this.servicioAlerta.alertaExito('PDF generado exitosamente');
  } catch (error) {
    this.servicioAlerta.alertaError('Error al generar el PDF del expediente');
  }
}

/**
 * Muestra opciones para ver o descargar expediente
 */
verExpedienteConOpciones(expediente: Expediente): void {
  // Mostrar opciones: ver detalles o descargar PDF
  Swal.fire({
    title: `Expediente: ${expediente.numeroexpediente}`,
    html: `
      <div style="text-align: left; margin: 20px 0;">
        <p><strong>Paciente:</strong> ${this.obtenerNombrePaciente(expediente)}</p>
        <p><strong>Fecha:</strong> ${expediente.fechacreacion ? new Date(expediente.fechacreacion).toLocaleDateString('es-GT') : 'N/A'}</p>
        <p><strong>Historia:</strong> ${expediente.historiaenfermedad ? 
          (expediente.historiaenfermedad.length > 100 ? 
           expediente.historiaenfermedad.substring(0, 100) + '...' : 
           expediente.historiaenfermedad) : 'No especificada'}</p>
        <p style="margin-top: 20px; color: #2c6662;">¿Qué deseas hacer?</p>
      </div>
    `,
    icon: 'info',
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: '<i class="fas fa-eye"></i> Ver Detalles',
    denyButtonText: '<i class="fas fa-file-pdf"></i> Descargar PDF',
    cancelButtonText: '<i class="fas fa-times"></i> Cancelar',
    confirmButtonColor: '#2c6662',
    denyButtonColor: '#dc3545',
    cancelButtonColor: '#6c757d',
    customClass: {
      popup: 'swal-wide',
      htmlContainer: 'swal-text-left'
    }
  }).then((resultado) => {
    if (resultado.isConfirmed) {
      this.verExpediente(expediente);
    } else if (resultado.isDenied) {
      this.descargarPDFExpediente(expediente);
    }
  });
}

/**
 * Obtiene el nombre del paciente de forma segura
 */
private obtenerNombrePaciente(expediente: Expediente): string {
  if (expediente.paciente) {
    return `${expediente.paciente.nombres || ''} ${expediente.paciente.apellidos || ''}`.trim();
  } else if (expediente.fkpaciente) {
    return `Paciente ID: ${expediente.fkpaciente}`;
  } else {
    return 'Sin paciente asignado';
  }
}

  /**
   * Abre el formulario para editar un expediente
   */
  editarExpediente(expediente: Expediente): void {
    this.expedienteSeleccionado = expediente;
    this.modoEdicion = true;
    this.vistaActual = 'formulario';
    this.llenarFormulario(expediente);
  }

  /**
   * Cierra el modal o regresa a la lista
   */
  cerrarModalInterno(): void {
    if (this.mostrarComoModal) {
      this.cerrarModal.emit();
    } else {
      this.mostrarLista();
    }
  }

  /**
   * Reinicia el formulario a su estado inicial
   */
  reiniciarFormulario(): void {
    this.formularioExpediente.reset();
    
    this.formularioExpediente.patchValue({ 
      generarAutomatico: true,
      numeroexpediente: '',
      antintolerantelactosa: ''
    });
    
    const controlNumero = this.formularioExpediente.get('numeroexpediente');
    controlNumero?.clearValidators();
    controlNumero?.updateValueAndValidity();
    
    this.modoEdicion = false;
    this.expedienteSeleccionado = null;
    this.error = '';
  }

  // ==========================================
  // GESTIÓN DE DATOS
  // ==========================================

  /**
   * Carga la lista de expedientes desde el servidor - ESTRUCTURA ARREGLADA
   */
cargarExpedientes(): void {
  this.cargando = true;
  this.error = '';

  const clinicaFiltro = this.clinicaSeleccionada > 0 ? this.clinicaSeleccionada : undefined;

  this.servicioExpediente.obtenerTodosLosExpedientes(
    this.paginaActual,
    this.tamanoPagina,
    this.terminoBusqueda,
    clinicaFiltro
  ).subscribe({
    next: (respuesta: RespuestaListaExpedientes) => {
      if (respuesta.exito) {
        this.expedientes = respuesta.datos || [];
        this.expedientesFiltrados = [...this.expedientes];
        
        if (respuesta.paginacion) {
          this.totalElementos = respuesta.paginacion.total;
          this.totalPaginas = respuesta.paginacion.totalPaginas;
        }
        
        this.updatePagination();
      } else {
        this.error = 'Error al cargar expedientes';
        this.servicioAlerta.alertaError(this.error);
      }
      this.cargando = false;
    },
    error: (error) => {
      this.error = 'Error al cargar los expedientes';
      this.servicioAlerta.alertaError(this.error);
      this.cargando = false;
    }
  });
}

  /**
   * Carga las estadísticas de expedientes
   */
  cargarEstadisticas(): void {
    this.servicioExpediente.obtenerEstadisticas()
      .pipe(takeUntil(this.destruir$))
      .subscribe({
        next: (respuesta: any) => {
          if (respuesta.exito) {
            this.estadisticas = respuesta.datos;
          }
        },
        error: (error: any) => {
        }
      });
  }

  /**
   * Carga lista de clínicas para el filtro
   */
  cargarClinicas(): void {
    this.servicioExpediente.obtenerClinicas().subscribe({
      next: (respuesta) => {

        if (respuesta.exito) {
          this.clinicas = respuesta.datos;
        } else {
        }
      },
      error: (error) => {
      }
    });
  }

  /**
   * Filtra los expedientes según el término de búsqueda
   */
  filtrarExpedientes(): void {
    if (!this.terminoBusqueda.trim()) {
      this.expedientesFiltrados = [...this.expedientes];
    } else {
      const termino = this.terminoBusqueda.toLowerCase();
      this.expedientesFiltrados = this.expedientes.filter(expediente =>
        expediente.numeroexpediente.toLowerCase().includes(termino) ||
        (expediente.historiaenfermedad && expediente.historiaenfermedad.toLowerCase().includes(termino)) ||
        (expediente.paciente && 
        (expediente.paciente.nombres.toLowerCase().includes(termino) ||
          expediente.paciente.apellidos.toLowerCase().includes(termino) ||
          expediente.paciente.cui.toLowerCase().includes(termino)))
      );
    }

    this.currentPage = 1;
    this.updatePagination();
  }

  // ==========================================
  // OPERACIONES CRUD
  // ==========================================

  /**
   * Procesa el envío del formulario
   */
  async alEnviarConDepuracion(): Promise<void> {
    const valoresFormulario = this.formularioExpediente.value;
    
    if (!this.esFormularioValido()) {
      this.marcarFormularioComoTocado(this.formularioExpediente);
      this.servicioAlerta.alertaPreventiva('Complete todos los campos requeridos');
      return;
    }

    this.cargando = true;
    this.error = '';

    try {
      const datosExpediente = this.prepararDatosParaEnvio(valoresFormulario);
      
      if (this.modoEdicion && this.expedienteSeleccionado?.idexpediente) {
        await this.actualizarExpediente(this.expedienteSeleccionado.idexpediente, datosExpediente);
      } else {
        await this.crearExpediente(datosExpediente);
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Error desconocido';
      this.servicioAlerta.alertaError(this.error);
      this.cargando = false;
    }
  }

  /**
   * Prepara los datos del formulario para envío al servidor
   */
  private prepararDatosParaEnvio(valoresFormulario: any): any {
    const datos = { ...valoresFormulario };

    // Incluir programas seleccionados
    datos.programas = this.programasSeleccionados;
    
    // Configurar número de expediente según modo
    if (datos.generarAutomatico === true) {
      datos.numeroexpediente = null;
    }
    
    // Agregar FK del paciente si está disponible
  if (this.datosPaciente?.idpaciente) {
    datos.fkpaciente = this.datosPaciente.idpaciente;
  } else if (this.expedienteSeleccionado?.fkpaciente) {
    datos.fkpaciente = this.expedienteSeleccionado.fkpaciente;
  }
    
    // Limpiar campos vacíos
    Object.keys(datos).forEach(clave => {
      if (typeof datos[clave] === 'string' && datos[clave].trim() === '') {
        datos[clave] = null;
      }
    });
    
    // Convertir campos numéricos
    const camposNumericos = [
      'antintolerantelactosa', 'gineobsgestas', 'gineobspartos', 
      'gineobsabortos', 'gineobscesareas', 'examenfistc', 
      'examenfisfc', 'examenfisfr', 'examenfissao2', 
      'examenfispeso', 'examenfistalla', 'examenfisimc'
    ];
    
    camposNumericos.forEach(campo => {
      if (datos[campo] !== null && datos[campo] !== undefined && datos[campo] !== '') {
        datos[campo] = Number(datos[campo]);
      }
    });
    
    return datos;
  }

  /**
   * Crea un nuevo expediente
   */
  private async crearExpediente(datosExpediente: Expediente): Promise<void> {
    try {
      // Verificar que tenemos el ID del paciente
      if (this.datosPaciente?.idpaciente) {
        (datosExpediente as any).fkpaciente = this.datosPaciente.idpaciente;
      } else {
        throw new Error('No se puede crear expediente sin ID de paciente');
      }
      
      const respuesta = await this.servicioExpediente.crearExpediente(datosExpediente)
        .toPromise()
        .then((resp: any) => {
          if (!resp) {
            throw new Error('No se recibió respuesta del servidor');
          }
          return resp;
        });
      
      if (respuesta.exito) {
        this.servicioAlerta.alertaExito('Expediente creado exitosamente');
        
        if (this.mostrarComoModal) {
          let expedienteCreado: any = null;
          
          if (Array.isArray(respuesta.datos)) {
            expedienteCreado = respuesta.datos[0];
          } else {
            expedienteCreado = respuesta.datos;
          }
          
          if (expedienteCreado && expedienteCreado.numeroexpediente) {
            const expedienteCompleto = {
              expediente: expedienteCreado,
              numeroExpediente: expedienteCreado.numeroexpediente,
              idExpediente: expedienteCreado.idexpediente,
              pacienteId: this.datosPaciente?.idpaciente
            };
            
            this.expedienteCreado.emit(expedienteCompleto);
          }
          
          setTimeout(() => {
            this.cerrarModal.emit();
          }, 1500);
        } else {
          this.cargarExpedientes();
          this.cargarEstadisticas();
          this.mostrarLista();
        }
      } else {
        throw new Error(respuesta.mensaje || 'Error al crear expediente');
      }
    } catch (error) {
      throw error;
    } finally {
      this.cargando = false;
    }
  }

  /**
   * Actualiza un expediente existente
   */
  private async actualizarExpediente(idExpediente: number, datosExpediente: Expediente): Promise<void> {
    try {
      const respuesta = await this.servicioExpediente.actualizarExpediente(idExpediente, datosExpediente)
        .toPromise()
        .then((resp: any) => {
          if (!resp) {
            throw new Error('No se recibió respuesta del servidor');
          }
          return resp;
        });
      
      if (respuesta.exito) {
        this.servicioAlerta.alertaExito('Expediente actualizado exitosamente');
        this.cargarExpedientes();
        this.cargarEstadisticas();
        this.mostrarLista();
      } else {
        throw new Error(respuesta.mensaje || 'Error al actualizar expediente');
      }
    } catch (error) {
      throw error;
    } finally {
      this.cargando = false;
    }
  }

/**
 * Elimina un expediente con confirmación 
 */
eliminarExpediente(id: number): void {
  this.servicioAlerta.alertaConfirmacion(
    '¿Eliminar expediente?',
    'Esta acción no se puede deshacer. Si tiene pacientes asignados no se podrá eliminar.',
    'Sí, eliminar',
    'Cancelar'
  ).then((confirmado: boolean) => {
    if (confirmado) {
      this.ejecutarEliminacion(id);
    }
  });
}

/**
 * Ejecuta la eliminación del expediente
 */
private ejecutarEliminacion(id: number): void {
  this.cargando = true;
  
  this.servicioExpediente.eliminarExpediente(id)
    .pipe(takeUntil(this.destruir$))
    .subscribe({
      next: (respuesta: any) => {
        this.cargando = false;
        
        if (respuesta && respuesta.exito) {
          this.servicioAlerta.alertaExito('Expediente eliminado exitosamente');
          this.cargarExpedientes();
          this.cargarEstadisticas();
        } else {
          const mensajeError = respuesta?.mensaje || 'Error desconocido al eliminar expediente';
          this.servicioAlerta.alertaError(mensajeError);
        }
      },
      error: (error: any) => {
        this.cargando = false;
        
        let mensajeError = 'Error al eliminar expediente';
        
        if (error.error) {
          if (typeof error.error === 'string') {
            mensajeError = error.error;
          } else if (error.error.mensaje) {
            mensajeError = error.error.mensaje;
          } else if (error.error.message) {
            mensajeError = error.error.message;
          }
        } else if (error.message) {
          mensajeError = error.message;
        }
        
        // Mensajes específicos para errores comunes
        if (error.status === 400) {
          mensajeError = 'No se puede eliminar el expediente porque tiene referencias asociadas';
        } else if (error.status === 404) {
          mensajeError = 'Expediente no encontrado';
        } else if (error.status === 500) {
          mensajeError = 'Error interno del servidor al eliminar expediente';
        }
        this.servicioAlerta.alertaError(mensajeError);
      }
    });
}
  // ==========================================
  // FUNCIONES ESPECIALES DEL FORMULARIO
  // ==========================================

  /**
   * Maneja el cambio del checkbox de generación automática
   */
  alCambiarGeneracionAutomatica(): void {
    const generarAutomatico = this.formularioExpediente.get('generarAutomatico')?.value;
    const controlNumeroExpediente = this.formularioExpediente.get('numeroexpediente');
    
    if (generarAutomatico) {
      controlNumeroExpediente?.clearValidators();
      controlNumeroExpediente?.setValue('');
      controlNumeroExpediente?.markAsUntouched();
    } else {
      controlNumeroExpediente?.setValidators([
        Validators.required,
        Validators.minLength(1),
        Validators.pattern(/^[a-zA-Z0-9\-_]+$/)
      ]);
    }
    
    controlNumeroExpediente?.updateValueAndValidity();
  }

  /**
   * Sugiere un número de expediente automático
   */
  async sugerirNumero(): Promise<void> {
    try {
      const respuesta = await this.servicioExpediente.generarNumeroExpediente()
        .toPromise()
        .then((resp: any) => {
          if (!resp) {
            throw new Error('No se recibió respuesta del servidor');
          }
          return resp;
        });
      
      if (respuesta && respuesta.exito) {
        this.formularioExpediente.patchValue({
          numeroexpediente: respuesta.datos.numeroexpediente
        });
        this.servicioAlerta.alertaInfo(`Número sugerido: ${respuesta.datos.numeroexpediente}`);
      }
    } catch (error) {
      this.servicioAlerta.alertaError('Error al generar número de expediente');
    }
  }

  /**
   * Calcula el IMC automáticamente basado en peso y talla
   */
  calcularIMC(): void {
    const peso = this.formularioExpediente.get('examenfispeso')?.value;
    const talla = this.formularioExpediente.get('examenfistalla')?.value;
    
    const imc = this.servicioExpediente.calcularIMC(peso, talla);
    if (imc !== null) {
      this.formularioExpediente.patchValue({ examenfisimc: imc });
    } else {
      this.formularioExpediente.patchValue({ examenfisimc: '' });
    }
  }

  /**
   * Obtiene la categoría del IMC actual del formulario
   */
  obtenerCategoriaIMC(): string {
    const imc = this.formularioExpediente.get('examenfisimc')?.value;
    return this.obtenerCategoriaIMCDesdeValor(imc);
  }

  /**
   * Obtiene la categoría del IMC desde un valor específico
   */
  obtenerCategoriaIMCDesdeValor(imc: number | undefined): string {
    if (!imc) return '';
    
    if (imc < 18.5) return 'Bajo peso';
    if (imc >= 18.5 && imc < 25) return 'Peso normal';
    if (imc >= 25 && imc < 30) return 'Sobrepeso';
    if (imc >= 30) return 'Obesidad';
    return '';
  }

  // ==========================================
  // FUNCIONES DE UTILIDAD
  // ==========================================

  /**
   * Llena el formulario con datos de un expediente existente
   */
llenarFormulario(expediente: Expediente): void {
  this.formularioExpediente.patchValue({
    numeroexpediente: expediente.numeroexpediente || '',
    generarAutomatico: false,
    historiaenfermedad: expediente.historiaenfermedad || '',
    antmedico: expediente.antmedico || '',
    antmedicamento: expediente.antmedicamento || '',
    anttraumaticos: expediente.anttraumaticos || '',
    antfamiliar: expediente.antfamiliar || '',
    antalergico: expediente.antalergico || '',
    antmedicamentos: expediente.antmedicamentos || '',
    antsustancias: expediente.antsustancias || '',
    antintolerantelactosa: expediente.antintolerantelactosa ?? '',
    
    // Gineco-obstétricos
    gineobsprenatales: expediente.gineobsprenatales ?? '',
    gineobsnatales: expediente.gineobsnatales ?? '',
    gineobspostnatales: expediente.gineobspostnatales ?? '',
    gineobsgestas: expediente.gineobsgestas ?? '',
    gineobspartos: expediente.gineobspartos ?? '',
    gineobsabortos: expediente.gineobsabortos ?? '',
    gineobscesareas: expediente.gineobscesareas ?? '',
    gineobshv: expediente.gineobshv ?? '',
    gineobsmh: expediente.gineobsmh ?? '',
    gineobsfur: expediente.gineobsfur ?? '',
    gineobsciclos: expediente.gineobsciclos ?? '',
    gineobsmenarquia: expediente.gineobsmenarquia ?? '',
    
    // Examen físico
    examenfistc: expediente.examenfistc ?? '',
    examenfispa: expediente.examenfispa ?? '',
    examenfisfc: expediente.examenfisfc ?? '',
    examenfisfr: expediente.examenfisfr ?? '',
    examenfissao2: expediente.examenfissao2 ?? '',
    examenfispeso: expediente.examenfispeso ?? '',
    examenfistalla: expediente.examenfistalla ?? '',
    examenfisimc: expediente.examenfisimc ?? '',
    examenfisgmt: expediente.examenfisgmt ?? ''
  });

  // Restaurar programas seleccionados al editar
  this.programasSeleccionados = (expediente as any).programas?.map((ep: any) => ep.idprograma) ?? [];
}

  /**
   * Obtiene el texto legible para intolerancia a lactosa
   */
  obtenerTextoIntoleranciaLactosa(valor: number | undefined): string {
    return this.servicioExpediente.obtenerTextoIntoleranciaLactosa(valor);
  }

  // ==========================================
  // FUNCIONES PARA LA VISTA DE DETALLES
  // ==========================================

  /**
   * Verifica si el expediente tiene antecedentes médicos
   */
  tieneAntecedentes(): boolean {
    if (!this.expedienteSeleccionado) return false;
    const exp = this.expedienteSeleccionado;
    return !!(
      exp.antmedico || 
      exp.antmedicamento || 
      exp.anttraumaticos || 
      exp.antfamiliar || 
      exp.antalergico || 
      exp.antintolerantelactosa !== undefined
    );
  }

  /**
   * Verifica si el expediente tiene antecedentes gineco-obstétricos
   */
  tieneAntecedentesGineObstetricos(): boolean {
    if (!this.expedienteSeleccionado) return false;
    const exp = this.expedienteSeleccionado;
    return !!(
      exp.gineobsprenatales ||
      exp.gineobsnatales ||
      exp.gineobspostnatales ||
      exp.gineobsgestas !== undefined ||
      exp.gineobspartos !== undefined ||
      exp.gineobsabortos !== undefined ||
      exp.gineobscesareas !== undefined ||
      exp.gineobsfur ||
      exp.gineobsmenarquia
    );
  }

  /**
   * Verifica si el expediente tiene datos de examen físico
   */
  tieneExamenFisico(): boolean {
    if (!this.expedienteSeleccionado) return false;
    const exp = this.expedienteSeleccionado;
    return !!(
      exp.examenfistc ||
      exp.examenfispa ||
      exp.examenfisfc ||
      exp.examenfisfr ||
      exp.examenfissao2 ||
      exp.examenfispeso ||
      exp.examenfistalla ||
      exp.examenfisimc ||
      exp.examenfisgmt
    );
  }

  // ==========================================
  // VALIDACIONES
  // ==========================================

  /**
   * Valida si el formulario es válido para envío
   */
  esFormularioValido(): boolean {
    const valoresFormulario = this.formularioExpediente.value;
    const generarAutomatico = valoresFormulario.generarAutomatico;
    const numeroExpediente = valoresFormulario.numeroexpediente;
    
    if (generarAutomatico === true) {
      return true;
    } else {
      return numeroExpediente && numeroExpediente.trim().length > 0;
    }
  }

  /**
   * Verifica si un campo específico es inválido
   */
  esCampoInvalido(nombreCampo: string): boolean {
    const campo = this.formularioExpediente.get(nombreCampo);
    return !!(campo && campo.invalid && (campo.dirty || campo.touched));
  }

  /**
   * Obtiene el mensaje de error para un campo específico
   */
  obtenerErrorCampo(nombreCampo: string): string {
    const campo = this.formularioExpediente.get(nombreCampo);
    
    if (campo && campo.errors) {
      if (campo.errors['required']) return 'Campo requerido';
      if (campo.errors['minlength']) return 'Muy corto';
      if (campo.errors['pattern']) return 'Formato inválido';
    }
    return '';
  }

  /**
   * Marca todos los campos del formulario como tocados
   */
  private marcarFormularioComoTocado(grupoFormulario: FormGroup): void {
    Object.keys(grupoFormulario.controls).forEach(clave => {
      const control = grupoFormulario.get(clave);
      control?.markAsTouched();
    });
  }

  // MÉTODOS DE PAGINACIÓN

  /**
   * Actualiza la información de paginación
   */
  updatePagination(): void {
    this.totalItems = this.expedientesFiltrados.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    
    // Asegurar que currentPage esté en el rango válido
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = Math.max(1, this.totalPages);
    } else if (this.currentPage < 1) {
      this.currentPage = 1;
    }
    
    this.updatePaginatedExpedientes();
  }

  /**
   * Actualiza los expedientes que se muestran en la página actual
   */
  updatePaginatedExpedientes(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedExpedientes = this.expedientesFiltrados.slice(startIndex, endIndex);
  }

  /**
   * Navega a una página específica
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedExpedientes();
    }
  }

  /**
   * Navega a la página siguiente
   */
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedExpedientes();
    }
  }

  /**
   * Navega a la página anterior
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedExpedientes();
    }
  }

  /**
   * Genera array de páginas para mostrar en la paginación
   */
  getPages(): number[] {
    if (this.totalPages <= 0) return [];
    
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    // Ajustar el inicio si hay menos páginas al final
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  /**
   * Maneja el cambio de elementos por página
   */
  onItemsPerPageChange(): void {
    // Asegurar que itemsPerPage sea un número
    this.itemsPerPage = Number(this.itemsPerPage);
    this.currentPage = 1; // Resetear a primera página
    this.updatePagination();
  }

  /**
   * Obtiene el rango de elementos mostrados
   */
  getDisplayRange(): string {
    if (this.totalItems === 0) return '0 - 0';
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
    return `${start} - ${end}`;
  }

  /**
 * Maneja cambio en select de clínica
 */
onClinicaChange(): void {
  this.currentPage = 1;
  this.cargarExpedientes();
}

/**
 * Limpia el filtro de clínica
 */
limpiarFiltroClinica(): void {
  this.clinicaSeleccionada = 0;
  this.currentPage = 1;
  this.cargarExpedientes();
}

/**
 * Obtiene el nombre de la clínica del paciente
 */
obtenerNombreClinica(expediente: Expediente): string {
  if (expediente.paciente?.clinica) {
    return expediente.paciente.clinica.nombreclinica;
  }
  return 'Sin clínica asignada';
}

togglePrograma(id: number): void {
  const idx = this.programasSeleccionados.indexOf(id);
  if (idx === -1) {
    this.programasSeleccionados = [...this.programasSeleccionados, id];
  } else {
    this.programasSeleccionados = this.programasSeleccionados.filter(p => p !== id);
  }
}
  
}