import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ServicioPaciente, Paciente, RespuestaPaciente, Clinica } from '../../services/paciente.service';
import { ServicioExpediente } from '../../services/expediente.service'; 
import { ArchivoService } from '../../services/archivo.service';
import { AlertaService } from '../../services/alerta.service';
import { AuthService } from '../../services/auth.service';
import { PerfilService } from '../../services/perfil.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { ExpedienteListaComponent } from '../expediente/expediente';
import { HostListener } from '@angular/core';

// AGREGAR LA DIRECTIVA DE TELÉFONO
import { FormatoTelefonicoDirective } from '../../directives/numeroFormato';

// Interfaz para la información del usuario
export interface InformacionUsuario {
  name: string;        
  avatar?: string | undefined;      
  nombres?: string;
  apellidos?: string;
  rol?: string;
}

@Component({
  selector: 'app-paciente-lista',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    FormsModule, 
    SidebarComponent,
    ExpedienteListaComponent,
    FormatoTelefonicoDirective  
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './paciente-list.component.html',
  styleUrls: ['./paciente-list.component.scss']
})
export class PacienteListaComponent implements OnInit, AfterViewInit, OnDestroy {
  
  @ViewChild(ExpedienteListaComponent) componenteExpediente!: ExpedienteListaComponent;
  private destruir$ = new Subject<void>();
  private perfilSubscription?: Subscription;

@HostListener('document:keydown.escape', ['$event'])
onEscapeKey(event: Event): void {
  if (this.modalAccionesAbierto) {
    this.cerrarModalAcciones();
  }
}
  // Estados de la aplicación
  vistaActual: 'lista' | 'formulario' | 'detalle' | 'modal-expediente' = 'lista';
  datosExpedientePaciente: any = null;
  formularioExpediente: FormGroup | null = null;
  modoEdicion = false;
  cargando = false;
  subiendoArchivos = false;

  //Paginación
   currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  totalItems = 0;
  paginatedPacientes: Paciente[] = []; 
  
  //math para usar el template
  Math = Math;

  // Datos principales
  pacientes: Paciente[] = [];
  pacientesFiltrados: Paciente[] = [];
  pacienteSeleccionado: Paciente | null = null;

  // Lista de clínicas
 clinicas: Clinica[] = []; 
 clinicaSeleccionada: number = 0;
  
  // Formulario
  formularioPaciente: FormGroup;

    // Archivos seleccionados
  selectedFotoPaciente: File | null = null;
  selectedFotoEncargado: File | null = null;
  selectedCartaAutorizacion: File | null = null;

  // Previews específicos para pacientes
  fotoPacientePreview: string | null = null;
  fotoEncargadoPreview: string | null = null;
  cartaAutorizacionPreview: string | null = null;
  
  // Variables de archivos (mantener compatibilidad con HTML)
  fotoSeleccionada: string | null = null;
  fotoEncargadoSeleccionada: string | null = null;
  cartaSeleccionada: string | null = null;
  esCartaPDF = false;

  modalAccionesAbierto = false;
  pacienteSeleccionadoAcciones: Paciente | null = null;

abrirModalAcciones(paciente: Paciente, index: number): void {
  this.pacienteSeleccionadoAcciones = paciente;
  this.modalAccionesAbierto = true;
  document.body.style.overflow = 'hidden';
}

cerrarModalAcciones(): void {
  this.modalAccionesAbierto = false;
  this.pacienteSeleccionadoAcciones = null;
  document.body.style.overflow = 'auto';
}

obtenerIniciales(nombres?: string, apellidos?: string): string {
  if (!nombres && !apellidos) return '??';
  const inicial1 = nombres ? nombres.charAt(0).toUpperCase() : '';
  const inicial2 = apellidos ? apellidos.charAt(0).toUpperCase() : '';
  return inicial1 + inicial2 || '??';
}

  // Búsqueda y paginación
  terminoBusqueda = '';
  private sujetoBusqueda = new Subject<string>();
  paginaActual = 1;
  tamanoPagina = 10;
  totalElementos = 0;
  totalPaginas = 0;
  
  // Interfaz de usuario
  fechaActual = new Date();
  barraLateralExpandida = true;
  sidebarVisible = false;
  informacionUsuario: any = {
    name: 'Usuario',
    avatar: null
  };
  error = '';

  constructor(
    private servicioUsuario: ServicioPaciente,
    private servicioExpediente: ServicioExpediente,
    private fb: FormBuilder,
    private servicioAlerta: AlertaService,
    public archivoService: ArchivoService,  
    private router: Router,
    private authService: AuthService,
    private perfilService: PerfilService
  ) {
    this.formularioPaciente = this.crearFormulario();
    this.configurarBusqueda();
  }

  ngOnInit(): void {
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
    this.cargarPacientes();
  }

  /**
   * Establece el filtro de clínica por defecto según el rol del usuario
   * - Administrador y Sistemas: Ver todas las clínicas
   * - Otros: Filtrar por su clínica asignada
   */
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

  /**
   * Carga lista de clínicas para el filtro
   */
  cargarClinicas(): void {
    this.servicioUsuario.obtenerClinicas().subscribe({
      next: (clinicas) => {
        this.clinicas = clinicas;
      },
      error: (error) => {
      }
    });
  }

  ngAfterViewInit(): void {
    this.detectarEstadoBarraLateral();
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
    this.perfilSubscription?.unsubscribe();
  }

  // ==========================================
  // MÉTODOS PARA EL HTML (ARCHIVOS Y UTILIDADES)
  // ==========================================

  /**
   * Verifica si es archivo PDF
   */
  esArchivoPDF(rutaArchivo: string): boolean {
    if (!rutaArchivo) return false;
    const extension = rutaArchivo.toLowerCase().split('.').pop();
    return extension === 'pdf';
  }

  /**
   * Verifica si es archivo de imagen
   */
  esArchivoImagen(rutaArchivo: string): boolean {
    if (!rutaArchivo) return false;
    const extension = rutaArchivo.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '');
  }

  /**
   * Obtiene el nombre del archivo
   */
  obtenerNombreArchivo(rutaArchivo: string): string {
    if (!rutaArchivo) return 'Archivo';
    return rutaArchivo.split('/').pop() || 'Archivo';
  }

  /**
   * Formatea fecha para mostrar
   */
  formatearFecha(fecha: string): string {
    if (!fecha) return 'No especificada';
    
    try {
      const fechaObj = new Date(fecha);
      return fechaObj.toLocaleDateString('es-GT', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  }

  /**
   * Descarga documento
   */
  descargarDocumento(rutaArchivo: string): void {
    if (!rutaArchivo) {
      this.servicioAlerta.alertaError('No se encontró el archivo');
      return;
    }

    try {
      const url = this.archivoService.obtenerUrlPublica(rutaArchivo);
      
      if (!url) {
        this.servicioAlerta.alertaError('No se pudo generar la URL del archivo');
        return;
      }
      
      const nombreArchivo = this.obtenerNombreArchivo(rutaArchivo);
      
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = nombreArchivo;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.servicioAlerta.alertaInfo(`Descargando: ${nombreArchivo}`);
    } catch (error) {
      this.servicioAlerta.alertaError('Error al acceder al archivo');
    }
  }

  /**
   * Maneja errores de carga de imágenes
   */
  onImageError(event: any): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
      const container = img.closest('.foto-preview');
      if (container) {
        container.classList.add('has-error');
      }
    }
  }

  // ==========================================
  // CONFIGURACIÓN INICIAL (SIN CAMBIOS)
  // ==========================================

  // Crea el formulario reactivo para pacientes
  crearFormulario(): FormGroup {
    return this.fb.group({
      nombres: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      cui: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
      fechanacimiento: ['', Validators.required],
      genero: ['', Validators.required],
      fkclinica: [null],
      tipoconsulta: ['', Validators.required],
      tipodiscapacidad: ['Ninguna'],
      telefonopersonal: [''],
      nombrecontactoemergencia: [''],
      telefonoemergencia: [''],
      nombreencargado: [''],
      dpiencargado: [''],
      telefonoencargado: [''],
      municipio: ['', Validators.required],
      aldea: [''],
      direccion: ['', Validators.required]
    });
  }

  //Configura la búsqueda con debounce
configurarBusqueda(): void {
  this.sujetoBusqueda
    .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destruir$))
    .subscribe(termino => {
      if (!termino.trim()) {
        this.pacientesFiltrados = [...this.pacientes];
      } else {
        const terminoBusqueda = termino.toLowerCase();
        this.pacientesFiltrados = this.pacientes.filter(paciente =>
          paciente.nombres.toLowerCase().includes(terminoBusqueda) ||
          paciente.apellidos.toLowerCase().includes(terminoBusqueda) ||
          paciente.cui.toLowerCase().includes(terminoBusqueda) ||
          (paciente.telefonopersonal && paciente.telefonopersonal.toLowerCase().includes(terminoBusqueda))
        );
      }
      this.currentPage = 1;
      this.updatePagination();
    });
}

//Carga la información del usuario desde localStorage
cargarInformacionUsuario(): void {
  try {
    const usuarioData = localStorage.getItem('usuario');
    
    if (usuarioData) {
      const usuario = JSON.parse(usuarioData);
      
      // Usar 'any' para evitar problemas de tipos
      this.informacionUsuario = {
        name: `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim(),
        avatar: usuario.rutafotoperfil ? 
          this.archivoService.obtenerUrlPublica(usuario.rutafotoperfil) : null
      };
    }
  } catch (error) {
    this.informacionUsuario = {
  name: 'Usuario',
  avatar: null
    };
  }
}

  //Detecta el estado de la barra lateral
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

  //Muestra la vista de lista
  mostrarLista(): void {
    this.vistaActual = 'lista';
    this.reiniciarFormulario();
  }

  //Muestra el formulario para crear nuevo paciente
  mostrarFormulario(): void {
    this.vistaActual = 'formulario';
    this.modoEdicion = false;
    this.reiniciarFormulario();
  }

  //Muestra los detalles de un paciente
  verPaciente(paciente: Paciente): void {
    this.pacienteSeleccionado = paciente;
    this.vistaActual = 'detalle';
  }

  //Abre el formulario para editar un paciente
  editarPaciente(paciente: Paciente): void {
    this.pacienteSeleccionado = paciente;
    this.modoEdicion = true;
    this.vistaActual = 'formulario';
    this.llenarFormulario(paciente);
    this.cargarFotosExistentes(paciente);
  }

   //Cierra el modal
  cerrarModal(): void {
    this.vistaActual = 'lista';
    this.reiniciarFormulario();
  }

// Reinicia el formulario a su estado inicial
reiniciarFormulario(): void {
  this.formularioPaciente.reset();
  this.formularioPaciente.patchValue({ tipodiscapacidad: 'Ninguna' });
  this.modoEdicion = false;
  this.pacienteSeleccionado = null;
  
  // Limpiar archivos específicos de pacientes
  this.limpiarArchivosSeleccionados();
  
  this.fotoPacientePreview = null;
  this.fotoEncargadoPreview = null;
  this.cartaAutorizacionPreview = null;
  
  // Mantener compatibilidad con HTML
  this.fotoSeleccionada = null;
  this.fotoEncargadoSeleccionada = null;
  this.cartaSeleccionada = null;
  this.esCartaPDF = false;
  this.subiendoArchivos = false;
  this.error = '';
}

  // ==========================================
  // GESTIÓN DE DATOS
  // ==========================================

  // Carga la lista de pacientes desde el servidor
  cargarPacientes(): void {
    this.cargando = true;
    this.error = '';

    // Pasar filtro de clínica
    const clinicaFiltro = this.clinicaSeleccionada > 0 ? this.clinicaSeleccionada : undefined;

    this.servicioUsuario.obtenerTodosLosPacientes(
      this.paginaActual,
      this.tamanoPagina,
      this.terminoBusqueda,
      clinicaFiltro
    ).subscribe({
      next: (respuesta: RespuestaPaciente) => {
        if (respuesta.exito) {
          this.pacientes = Array.isArray(respuesta.datos) 
            ? respuesta.datos 
            : [respuesta.datos];
          this.pacientesFiltrados = [...this.pacientes];
          
          if (respuesta.paginacion) {
            this.totalElementos = respuesta.paginacion.total;
            this.totalPaginas = respuesta.paginacion.totalPaginas;
          }
          
          this.updatePagination();
        } else {
          this.error = respuesta.mensaje || 'Error desconocido';
          this.servicioAlerta.alertaError(this.error);
        }
        this.cargando = false;
      },
      error: (error) => {
        this.error = 'Error al cargar los pacientes';
        this.servicioAlerta.alertaError(this.error);
        this.cargando = false;
      }
    });
  }

 //Filtra los pacientes según el término de búsqueda
filtrarPacientes(): void {
  this.sujetoBusqueda.next(this.terminoBusqueda);
}

formatearTelefono(campo: string): void {
  let valor: string = this.formularioPaciente.get(campo)?.value || '';

  // Quitar todo lo que no sea número
  valor = valor.replace(/\D/g, '');

  // Si ya empieza con 502, lo quitamos (para evitar que el usuario lo escriba)
  if (valor.startsWith('502')) {
    valor = valor.substring(3);
  }

  // Limitar a 8 dígitos (números de Guatemala)
  if (valor.length > 8) {
    valor = valor.substring(0, 8);
  }

  // Formatear: +502-XXXX-XXXX
  let formateado = '';
  if (valor.length > 0) {
    if (valor.length <= 4) {
      formateado = `+502 ${valor}`;
    } else {
      formateado = `+502 ${valor.substring(0, 4)}-${valor.substring(4)}`;
    }
  }

  // Actualizar el campo en el formulario
  this.formularioPaciente.get(campo)?.setValue(formateado, { emitEvent: false });
}

  // ==========================================
  // OPERACIONES CRUD (SIN CAMBIOS IMPORTANTES)
  // ==========================================

  //Procesa el envío del formulario
  async alEnviar(): Promise<void> {
    if (!this.formularioPaciente.valid) {
      this.marcarFormularioComoTocado(this.formularioPaciente);
      this.servicioAlerta.alertaPreventiva('Complete todos los campos requeridos');
      return;
    }

    this.cargando = true;
    this.error = '';

    try {
      const datosPaciente: Paciente = this.formularioPaciente.value;

      if (this.modoEdicion && this.pacienteSeleccionado?.idpaciente) {
        await this.actualizarPacienteConArchivos(this.pacienteSeleccionado.idpaciente, datosPaciente);
      } else {
        await this.crearPacienteConArchivos(datosPaciente);
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Error desconocido';
      this.servicioAlerta.alertaError(this.error);
      this.cargando = false;
    }
  }

  // Crea un nuevo paciente con archivos
  private async crearPacienteConArchivos(datosPaciente: Paciente): Promise<void> {
    try {
      const respuesta = await this.servicioUsuario.crearPaciente(datosPaciente)
        .toPromise()
        .then(resp => {
          if (!resp) {
            throw new Error('No se recibió respuesta del servidor');
          }
          return resp;
        });
      
      if (respuesta.exito) {
        const nuevoPaciente = respuesta.datos as Paciente;
        const pacienteId = nuevoPaciente.idpaciente;
        
        if (pacienteId && this.tieneArchivosParaSubir()) {
          const rutasArchivos = await this.subirTodosLosArchivos(pacienteId);
          
          // Actualizar el paciente con las rutas de los archivos
          if (Object.keys(rutasArchivos).length > 0) {
            const datosActualizados: any = {};
            if (rutasArchivos.rutaFotoPaciente) datosActualizados.rutafotoperfil = rutasArchivos.rutaFotoPaciente;
            if (rutasArchivos.rutaFotoEncargado) datosActualizados.rutafotoencargado = rutasArchivos.rutaFotoEncargado;
            if (rutasArchivos.rutaCartaAutorizacion) datosActualizados.rutacartaautorizacion = rutasArchivos.rutaCartaAutorizacion;
            
            // Actualizar paciente con las rutas
            await this.servicioUsuario.actualizarPaciente(pacienteId, datosActualizados).toPromise();
          }
          
          this.servicioAlerta.alertaExito('Paciente creado con archivos');
        } else {
          this.servicioAlerta.alertaExito('Paciente creado exitosamente');
        }
        
        this.cargarPacientes();
        this.mostrarLista();
      } else {
        throw new Error(respuesta.mensaje || 'Error al crear paciente');
      }
    } catch (error) {
      throw error;
    } finally {
      this.cargando = false;
      this.subiendoArchivos = false;
    }
  }

//Actualiza un paciente existente con archivos
private async actualizarPacienteConArchivos(pacienteId: number, datosPaciente: Paciente): Promise<void> {
  try {
    // Si hay archivos nuevos, subirlos primero
    let datosConArchivos = { ...datosPaciente };
    
    if (this.tieneArchivosParaSubir()) {
      const rutasArchivos = await this.subirTodosLosArchivos(pacienteId);
      
      // MANTENER ARCHIVOS EXISTENTES SI NO SE REEMPLAZAN
      const pacienteActual = this.pacienteSeleccionado;
      
      // Solo actualizar rutas si se subieron archivos nuevos
      if (rutasArchivos.rutaFotoPaciente) {
        datosConArchivos.rutafotoperfil = rutasArchivos.rutaFotoPaciente;
      } else if (pacienteActual?.rutafotoperfil) {
        datosConArchivos.rutafotoperfil = pacienteActual.rutafotoperfil;
      }
      
      if (rutasArchivos.rutaFotoEncargado) {
        datosConArchivos.rutafotoencargado = rutasArchivos.rutaFotoEncargado;
      } else if (pacienteActual?.rutafotoencargado) {
        datosConArchivos.rutafotoencargado = pacienteActual.rutafotoencargado;
      }
      
      if (rutasArchivos.rutaCartaAutorizacion) {
        datosConArchivos.rutacartaautorizacion = rutasArchivos.rutaCartaAutorizacion;
      } else if (pacienteActual?.rutacartaautorizacion) {
        datosConArchivos.rutacartaautorizacion = pacienteActual.rutacartaautorizacion;
      }
    } else {
      // SI NO HAY ARCHIVOS NUEVOS, MANTENER LOS EXISTENTES
      const pacienteActual = this.pacienteSeleccionado;
      if (pacienteActual?.rutafotoperfil) datosConArchivos.rutafotoperfil = pacienteActual.rutafotoperfil;
      if (pacienteActual?.rutafotoencargado) datosConArchivos.rutafotoencargado = pacienteActual.rutafotoencargado;
      if (pacienteActual?.rutacartaautorizacion) datosConArchivos.rutacartaautorizacion = pacienteActual.rutacartaautorizacion;
    }

    const respuesta = await this.servicioUsuario.actualizarPaciente(pacienteId, datosConArchivos)
      .toPromise()
      .then(resp => {
        if (!resp) {
          throw new Error('No se recibió respuesta del servidor');
        }
        return resp;
      });
    
    if (respuesta.exito) {
      const mensaje = this.tieneArchivosParaSubir() ? 'Paciente actualizado con archivos' : 'Paciente actualizado exitosamente';
      this.servicioAlerta.alertaExito(mensaje);
      
      // LIMPIAR ARCHIVOS SELECCIONADOS DESPUÉS DE ACTUALIZAR
      this.limpiarArchivosSeleccionados();
      
      this.cargarPacientes();
      this.mostrarLista();
    } else {
      throw new Error(respuesta.mensaje || 'Error al actualizar paciente');
    }
  } catch (error) {
    throw error;
  } finally {
    this.cargando = false;
    this.subiendoArchivos = false;
  }
}

//Método para limpiar archivos seleccionados
private limpiarArchivosSeleccionados(): void {
  this.selectedFotoPaciente = null;
  this.selectedFotoEncargado = null;
  this.selectedCartaAutorizacion = null;
}

  //Verifica si hay archivos para subir
  private tieneArchivosParaSubir(): boolean {
    return !!(this.selectedFotoPaciente || this.selectedFotoEncargado || this.selectedCartaAutorizacion);
  }
  
/**
 * Sube todos los archivos seleccionados con eliminación automática de anteriores
 */
private async subirTodosLosArchivos(pacienteId: number): Promise<{ 
  rutaFotoPaciente?: string, 
  rutaFotoEncargado?: string, 
  rutaCartaAutorizacion?: string 
}> {
  if (!this.tieneArchivosParaSubir()) {
    return {};
  }

  this.subiendoArchivos = true;

  try {
    const resultados: { 
      rutaFotoPaciente?: string, 
      rutaFotoEncargado?: string, 
      rutaCartaAutorizacion?: string 
    } = {};

    // OBTENER RUTAS ANTERIORES del paciente actual
    const pacienteActual = this.pacienteSeleccionado;
    const rutaFotoPacienteAnterior = pacienteActual?.rutafotoperfil || '';
    const rutaFotoEncargadoAnterior = pacienteActual?.rutafotoencargado || '';
    const rutaCartaAnterior = pacienteActual?.rutacartaautorizacion || '';

    // 1. SUBIR FOTO DEL PACIENTE (elimina anterior automáticamente)
    if (this.selectedFotoPaciente) {
      resultados.rutaFotoPaciente = await this.archivoService.subirFoto(
        'pacientes',
        pacienteId,
        this.selectedFotoPaciente,
        rutaFotoPacienteAnterior 
      );
    }

    // 2. SUBIR FOTO DEL ENCARGADO (elimina anterior automáticamente)
    if (this.selectedFotoEncargado) {
      resultados.rutaFotoEncargado = await this.archivoService.subirFoto(
        'pacientes',
        pacienteId,
        this.selectedFotoEncargado,
        rutaFotoEncargadoAnterior  
      );
    }

    // 3. SUBIR CARTA DE AUTORIZACIÓN (elimina anterior automáticamente)
    if (this.selectedCartaAutorizacion) {
      resultados.rutaCartaAutorizacion = await this.archivoService.subirDocumento(
        'pacientes',
        pacienteId,
        this.selectedCartaAutorizacion,
        rutaCartaAnterior 
      );
    }

    return resultados;
    
  } catch (error) {
    throw error;
  } finally {
    this.subiendoArchivos = false;
  }
}

  // RESTO DE MÉTODOS SIN CAMBIOS (solo los esenciales para que funcione)
  
  eliminarPaciente(id: number): void {
    this.servicioAlerta.alertaConfirmacion(
      '¿Eliminar paciente?',
      'Esta acción no se puede deshacer.',
      'Sí, eliminar',
      'Cancelar'
    ).then((confirmado: boolean) => {
      if (confirmado) {
        this.cargando = true;
        
        this.servicioUsuario.eliminarPaciente(id).subscribe({
          next: (respuesta) => {
            if (respuesta.exito) {
              this.servicioAlerta.alertaExito('Paciente eliminado');
              this.cargarPacientes();
            } else {
              this.servicioAlerta.alertaError(respuesta.mensaje || 'Error al eliminar');
            }
            this.cargando = false;
          },
          error: (error) => {
            this.servicioAlerta.alertaError('Error al eliminar paciente');
            this.cargando = false;
          }
        });
      }
    });
  }

  // Métodos de utilidad básicos
  calcularEdad(fechaNacimiento: string): number {
    if (!fechaNacimiento) return 0;
    const hoy = new Date();
    const fechaNac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const diferenciaM = hoy.getMonth() - fechaNac.getMonth();
    if (diferenciaM < 0 || (diferenciaM === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }
    return edad;
  }

  obtenerInformacionExpedientePaciente(paciente: Paciente): any {
    const primerExpediente = paciente.expedientes?.[0];
    return {
      tieneExpediente: !!primerExpediente,
      numeroExpediente: primerExpediente?.numeroexpediente,
      idExpediente: primerExpediente?.idexpediente
    };
  }

  // Métodos de archivos y formulario
  async alSeleccionarFoto(evento: any, tipo: 'perfil' | 'encargado' | 'carta'): Promise<void> {
    const archivo = evento.target.files[0];
    if (!archivo) return;

    try {
      let vistaPrevia: string | null = null;
      
      if (archivo.type.startsWith('image/')) {
        vistaPrevia = await this.archivoService.crearVistaPrevia(archivo);
      } else if (archivo.type === 'application/pdf') {
        this.esCartaPDF = true;
        vistaPrevia = `${archivo.name}`;
      }

      switch (tipo) {
        case 'perfil':
          this.selectedFotoPaciente = archivo;
          this.fotoSeleccionada = vistaPrevia;
          break;
        case 'encargado':
          this.selectedFotoEncargado = archivo;
          this.fotoEncargadoSeleccionada = vistaPrevia;
          break;
        case 'carta':
          this.selectedCartaAutorizacion = archivo;
          this.cartaSeleccionada = vistaPrevia;
          break;
      }
    } catch (error) {
      this.servicioAlerta.alertaError('Error al procesar archivo');
    }
  }

  eliminarFoto(tipo: 'perfil' | 'encargado' | 'carta'): void {
    switch (tipo) {
      case 'perfil':
        this.selectedFotoPaciente = null;
        this.fotoSeleccionada = null;
        break;
      case 'encargado':
        this.selectedFotoEncargado = null;
        this.fotoEncargadoSeleccionada = null;
        break;
      case 'carta':
        this.selectedCartaAutorizacion = null;
        this.cartaSeleccionada = null;
        this.esCartaPDF = false;
        break;
    }
  }

  llenarFormulario(paciente: Paciente): void {
    this.formularioPaciente.patchValue({
      nombres: paciente.nombres,
      apellidos: paciente.apellidos,
      cui: paciente.cui,
      fechanacimiento: paciente.fechanacimiento ? 
        new Date(paciente.fechanacimiento).toISOString().split('T')[0] : '',
      genero: paciente.genero,
      fkclinica: paciente.fkclinica || null,  
      tipoconsulta: paciente.tipoconsulta,
      tipodiscapacidad: paciente.tipodiscapacidad || 'Ninguna',
      telefonopersonal: paciente.telefonopersonal,
      nombrecontactoemergencia: paciente.nombrecontactoemergencia,
      telefonoemergencia: paciente.telefonoemergencia,
      nombreencargado: paciente.nombreencargado,
      dpiencargado: paciente.dpiencargado,
      telefonoencargado: paciente.telefonoencargado,
      municipio: paciente.municipio,
      aldea: paciente.aldea,
      direccion: paciente.direccion
    });
  }

  cargarFotosExistentes(paciente: Paciente): void {
    if (paciente.rutafotoperfil) {
      this.fotoSeleccionada = this.archivoService.obtenerUrlPublica(paciente.rutafotoperfil);
    }
    if (paciente.rutafotoencargado) {
      this.fotoEncargadoSeleccionada = this.archivoService.obtenerUrlPublica(paciente.rutafotoencargado);
    }
    if (paciente.rutacartaautorizacion) {
      this.cartaSeleccionada = this.archivoService.obtenerUrlPublica(paciente.rutacartaautorizacion);
      this.esCartaPDF = this.esArchivoPDF(paciente.rutacartaautorizacion);
    }
  }

  // Validaciones de formulario
  esCampoInvalido(nombreCampo: string): boolean {
    const campo = this.formularioPaciente.get(nombreCampo);
    return !!(campo && campo.invalid && (campo.dirty || campo.touched));
  }

  obtenerErrorCampo(nombreCampo: string): string {
    const campo = this.formularioPaciente.get(nombreCampo);
    if (campo?.errors) {
      if (campo.errors['required']) return 'Campo requerido';
      if (campo.errors['minlength']) return 'Muy corto';
      if (campo.errors['pattern'] && nombreCampo === 'cui') return 'CUI debe tener 13 dígitos';
    }
    return '';
  }

  private marcarFormularioComoTocado(grupoFormulario: FormGroup): void {
    Object.keys(grupoFormulario.controls).forEach(clave => {
      grupoFormulario.get(clave)?.markAsTouched();
    });
  }

  // Paginación básica
  updatePagination(): void {
    this.totalItems = this.pacientesFiltrados.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = Math.max(1, this.totalPages);
    }
    this.updatePaginatedPacientes();
  }

  updatePaginatedPacientes(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedPacientes = this.pacientesFiltrados.slice(startIndex, endIndex);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedPacientes();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedPacientes();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedPacientes();
    }
  }

  getPages(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  onItemsPerPageChange(): void {
    this.itemsPerPage = Number(this.itemsPerPage);
    this.currentPage = 1;
    this.updatePagination();
  }

  toggleSidebarMobile(): void {
    this.sidebarVisible = !this.sidebarVisible;
  }

  onSidebarToggle(isExpanded: boolean): void {
    this.sidebarVisible = isExpanded;
  }

  // Métodos del modal de acciones
  editarPacienteDesdeModal(paciente: Paciente): void {
    this.cerrarModalAcciones();
    this.editarPaciente(paciente);
  }

  eliminarPacienteDesdeModal(paciente: Paciente): void {
    this.cerrarModalAcciones();
    if (paciente.idpaciente) {
      this.eliminarPaciente(paciente.idpaciente);
    }
  }

/**
 * Maneja la navegación al historial clínico desde el modal
 */
verHistorialClinicoDesdeModal(paciente: Paciente): void {
  this.cerrarModalAcciones();
  this.verHistorialClinico(paciente);
}

  // Navega al historial clínico de un paciente específico
  verHistorialClinico(paciente: Paciente): void {
    if (!paciente.idpaciente) {
      this.servicioAlerta.alertaPreventiva('No se puede acceder al historial: ID de paciente no válido');
      return;
    }
    
    // Verificar si el paciente tiene al menos un expediente
    const informacionExpediente = this.obtenerInformacionExpedientePaciente(paciente);
    
    if (!informacionExpediente.tieneExpediente) {
      // IR DIRECTO A CREAR EXPEDIENTE (sin diálogo previo)
      this.crearExpedientePaciente(paciente);
      return;
    }

    // Guardar datos del paciente
    sessionStorage.setItem('datosPacienteHistorial', JSON.stringify(paciente));
    
    // Navegar al historial clínico
    this.router.navigate(['/historial', paciente.idpaciente]);
  }

 //Crear expediente para un paciente específico
  crearExpedientePaciente(paciente: Paciente): void {
    Swal.fire({
      title: 'Crear Expediente Médico',
      html: `
        <p>¿Desea crear un expediente médico para:</p>
        <strong>${paciente.nombres} ${paciente.apellidos}</strong>
        <br><small>CUI: ${paciente.cui}</small>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: '<i class="fas fa-plus"></i> Crear Expediente',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then((resultado: any) => {
      if (resultado.isConfirmed) {
        this.abrirModalExpediente(paciente);
      }
    });
  }

   //Abre el modal para crear expediente
  private abrirModalExpediente(paciente: Paciente): void {
    this.datosExpedientePaciente = {
      idpaciente: paciente.idpaciente,
      pacienteInfo: {
        nombres: paciente.nombres,
        apellidos: paciente.apellidos,
        cui: paciente.cui,
        fechanacimiento: paciente.fechanacimiento,
        genero: paciente.genero
      }
    };

    this.vistaActual = 'modal-expediente';
    
    setTimeout(() => {
      if (this.componenteExpediente) {
        this.componenteExpediente.abrirModalDesdePacientes(this.datosExpedientePaciente);
        
        // SUSCRIBIRSE AL EVENTO DE EXPEDIENTE CREADO
        this.componenteExpediente.expedienteCreado.subscribe(() => {
          this.cerrarModalExpediente();
        });
      }
    }, 100);
  }

  // Método vacío para expedientes (manteniendo compatibilidad)
  cerrarModalExpediente(): void {
    this.vistaActual = 'lista';
    this.datosExpedientePaciente = null;
    
    // RECARGAR PACIENTES DESPUÉS DE CERRAR EL MODAL
    this.cargarPacientes();
  }

  /**
   *  Maneja cambio en select de clínica
   */
  onClinicaChange(): void {
    this.currentPage = 1;
    this.cargarPacientes();
  }

  /**
   * Limpia el filtro de clínica
   */
  limpiarFiltroClinica(): void {
    this.clinicaSeleccionada = 0;
    this.currentPage = 1;
    this.cargarPacientes();
  }

  /**
   * Obtiene el nombre de la clínica de un paciente
   */
  obtenerNombreClinica(paciente: Paciente): string {
    return paciente.clinica?.nombreclinica || 'Sin clínica';
  }
}